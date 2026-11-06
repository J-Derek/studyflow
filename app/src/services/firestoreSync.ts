import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  getDocs,
  limit,
  query,
  serverTimestamp,
  deleteField,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Assignment, CourseGrade, Note, StudySession } from '../types';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { fromCloud, sameRun, type TimerState } from '../lib/timerEngine';
import { assignmentToDoc, docToAssignment, docToGrade, docToNote, docToProfile, docToSession, gradeToDoc, noteToDoc, profileToDoc, sessionToDoc } from './firestoreMappers';
import { isLegacySeedId } from '../utils/sampleData';

const LIST_CAP = 500;

let activeUnsubscribes: Unsubscribe[] = [];

// Cloud timer bookkeeping. `cloudRev` is the revision of the stored timer document; every write
// must be exactly one higher (compare-and-swap in firestore.rules), so two devices cannot both win.
let cloudRev = 0;
let cloudStatus: 'idle' | 'running' | 'paused' | 'none' = 'none';
let cloudMode: string | null = null;
let lastLocalRev = 0;

/**
 * Cleanly terminates all active Firestore snapshot listeners across collections.
 */
export function unsubscribeAllFirestoreSync(): void {
  cloudRev = 0;
  cloudStatus = 'none';
  cloudMode = null;
  lastLocalRev = 0;
  activeUnsubscribes.forEach((unsub) => {
    try {
      unsub();
    } catch {
      /* listener already closed */
    }
  });
  activeUnsubscribes = [];
}

function isCurrentUser(uid: string): boolean {
  return useStudyFlowStore.getState().userId === uid;
}

/**
 * Starts listeners for the signed-in user. Every callback re-checks that `uid` is still the active
 * user, so a late snapshot from a previous account can never repopulate the store.
 */
export function initFirestoreSync(uid: string): () => void {
  unsubscribeAllFirestoreSync();

  const userDocRef = doc(db, 'users', uid);

  // The profile follows the student across devices. Read first, then decide: a stored profile wins on a
  // new device; if there is none yet, this device's profile is the one that gets stored.
  let profileSeeded = false;
  let photoShared = false;
  const unsubUser = onSnapshot(
    userDocRef,
    (snap) => {
      if (!isCurrentUser(uid)) return;
      const data = snap.data();
      const dismissed = data?.onboarding?.dismissed === true;
      if (dismissed !== useStudyFlowStore.getState().onboardingDismissed) {
        useStudyFlowStore.setState({ onboardingDismissed: dismissed });
      }

      if (data && typeof data.name === 'string') {
        const remote = docToProfile(data);
        useStudyFlowStore.setState((st) => ({
          user: { ...st.user, ...remote.user },
          customPhotoUrl: remote.photo ?? st.customPhotoUrl
        }));
        // This device has a picture the stored profile lacks: share it (once).
        if (remote.photo === null && useStudyFlowStore.getState().customPhotoUrl && !photoShared) {
          photoShared = true;
          syncProfile(uid).catch((err) => console.warn('Profile picture sync warning:', err));
        }
      } else if (!snap.metadata.fromCache && !profileSeeded) {
        // Nothing stored yet, and this answer came from the server: store this device's profile.
        profileSeeded = true;
        syncProfile(uid).catch((err) => console.warn('Profile sync warning:', err));
      }
    },
    (err) => console.warn('Firestore profile listener warning:', err.message)
  );
  activeUnsubscribes.push(unsubUser);

  // Timer: follow changes made on another device. Our own writes are recognised by revision number.
  const unsubTimer = onSnapshot(
    doc(db, 'users', uid, 'liveState', 'timer'),
    (snap) => {
      if (!isCurrentUser(uid)) return;
      const d = snap.data();
      if (!d || snap.metadata.hasPendingWrites) return;
      cloudRev = typeof d.rev === 'number' ? d.rev : 0;
      cloudStatus = d.status;
      cloudMode = d.mode;
      if (cloudRev <= lastLocalRev) return; // our own write echoing back
      lastLocalRev = cloudRev;
      const startedAtMs = d.startedAt && typeof d.startedAt.toMillis === 'function' ? d.startedAt.toMillis() : null;
      const remote = fromCloud({
        mode: d.mode,
        status: d.status,
        durationSeconds: d.durationSeconds,
        startedAtMs,
        remainingSeconds: d.remainingSeconds ?? null
      });
      // Our own timer (for example after a refresh) already matches; only follow a different run.
      if (!sameRun(useStudyFlowStore.getState().timer, remote)) {
        useStudyFlowStore.getState().adoptRemoteTimer(remote);
      }
    },
    (err) => console.warn('Firestore timer listener warning:', err.message)
  );
  activeUnsubscribes.push(unsubTimer);

  // Assignments. Upload happens only once, on the first server snapshot, when the cloud is empty and
  // the device holds records made before sign-in. Never re-seed after the student deletes things.
  let assignmentsSeeded = false;
  const unsubAssignments = onSnapshot(
    query(collection(db, 'users', uid, 'assignments'), limit(LIST_CAP)),
    async (snapshot) => {
      if (!isCurrentUser(uid)) return;
      useStudyFlowStore.setState({ isSyncing: snapshot.metadata.hasPendingWrites });

      if (snapshot.metadata.fromCache && snapshot.empty) return; // wait for the server

      if (snapshot.empty && !assignmentsSeeded) {
        assignmentsSeeded = true;
        const local = useStudyFlowStore.getState().assignments;
        if (local.length > 0) {
          const batch = writeBatch(db);
          for (const asg of local.slice(0, LIST_CAP)) {
            batch.set(doc(db, 'users', uid, 'assignments', asg.id), {
              ...assignmentToDoc(asg),
              updatedAt: serverTimestamp()
            });
          }
          await batch.commit().catch((err) => console.warn('Batched assignment upload warning:', err));
        }
        return;
      }
      assignmentsSeeded = true;

      const remote: Assignment[] = [];
      snapshot.forEach((d) => {
        const a = docToAssignment(d.id, d.data());
        remote.push(isLegacySeedId('assignment', a.id) ? { ...a, sample: true } : a);
      });
      remote.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      if (isCurrentUser(uid)) useStudyFlowStore.setState({ assignments: remote });
    },
    (err) => console.warn('Firestore assignments listener warning (using offline cache):', err.message)
  );
  activeUnsubscribes.push(unsubAssignments);

  let notesSeeded = false;
  const unsubNotes = onSnapshot(
    query(collection(db, 'users', uid, 'notes'), limit(LIST_CAP)),
    async (snapshot) => {
      if (!isCurrentUser(uid)) return;
      if (snapshot.metadata.fromCache && snapshot.empty) return;

      if (snapshot.empty && !notesSeeded) {
        notesSeeded = true;
        const local = useStudyFlowStore.getState().notes;
        if (local.length > 0) {
          const batch = writeBatch(db);
          for (const n of local.slice(0, LIST_CAP)) {
            batch.set(doc(db, 'users', uid, 'notes', n.id), { ...noteToDoc(n), updatedAt: serverTimestamp() });
          }
          await batch.commit().catch((err) => console.warn('Batched note upload warning:', err));
        }
        return;
      }
      notesSeeded = true;

      const remote: Note[] = [];
      snapshot.forEach((d) => remote.push(docToNote(d.id, d.data())));
      remote.sort((a, b) => b.editedAt.localeCompare(a.editedAt));
      if (isCurrentUser(uid)) useStudyFlowStore.setState({ notes: remote });
    },
    (err) => console.warn('Firestore notes listener warning (using offline cache):', err.message)
  );
  activeUnsubscribes.push(unsubNotes);

  let sessionsSeeded = false;
  const unsubSessions = onSnapshot(
    query(collection(db, 'users', uid, 'sessions'), limit(LIST_CAP)),
    async (snapshot) => {
      if (!isCurrentUser(uid)) return;
      if (snapshot.metadata.fromCache && snapshot.empty) return;

      if (snapshot.empty && !sessionsSeeded) {
        sessionsSeeded = true;
        const local = useStudyFlowStore.getState().sessions;
        if (local.length > 0) {
          const batch = writeBatch(db);
          for (const s of local.slice(0, LIST_CAP)) {
            batch.set(doc(db, 'users', uid, 'sessions', s.id), {
              ...sessionToDoc(s),
              updatedAt: serverTimestamp()
            });
          }
          await batch.commit().catch((err) => console.warn('Batched session upload warning:', err));
        }
        return;
      }
      sessionsSeeded = true;

      const remote: StudySession[] = [];
      snapshot.forEach((d) => {
        const s = docToSession(d.id, d.data());
        remote.push(isLegacySeedId('session', s.id) ? { ...s, sample: true } : s);
      });
      if (isCurrentUser(uid)) useStudyFlowStore.setState({ sessions: remote });
    },
    (err) => console.warn('Firestore sessions listener warning (using offline cache):', err.message)
  );
  activeUnsubscribes.push(unsubSessions);

  let gradesSeeded = false;
  const unsubGrades = onSnapshot(
    query(collection(db, 'users', uid, 'grades'), limit(LIST_CAP)),
    async (snapshot) => {
      if (!isCurrentUser(uid)) return;
      if (snapshot.metadata.fromCache && snapshot.empty) return;

      if (snapshot.empty && !gradesSeeded) {
        gradesSeeded = true;
        const local = useStudyFlowStore.getState().grades;
        if (local.length > 0) {
          const batch = writeBatch(db);
          for (const g of local.slice(0, LIST_CAP)) {
            batch.set(doc(db, 'users', uid, 'grades', g.id), { ...gradeToDoc(g), updatedAt: serverTimestamp() });
          }
          await batch.commit().catch((err) => console.warn('Batched grade upload warning:', err));
        }
        return;
      }
      gradesSeeded = true;

      const remote: CourseGrade[] = [];
      snapshot.forEach((d) => {
        const g = docToGrade(d.id, d.data());
        remote.push(isLegacySeedId('grade', g.id) ? { ...g, sample: true } : g);
      });
      if (isCurrentUser(uid)) useStudyFlowStore.setState({ grades: remote });
    },
    (err) => console.warn('Firestore grades listener warning (using offline cache):', err.message)
  );
  activeUnsubscribes.push(unsubGrades);

  return () => {
    unsubscribeAllFirestoreSync();
  };
}

/** Writes the whole document (no merge) so removed fields really disappear. */
export async function syncAssignmentToFirestore(uid: string, assignment: Assignment): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'assignments', assignment.id), {
    ...assignmentToDoc(assignment),
    updatedAt: serverTimestamp()
  });
}

export async function deleteAssignmentFromFirestore(uid: string, assignmentId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'assignments', assignmentId));
}

export async function syncSessionToFirestore(uid: string, session: StudySession): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'sessions', session.id), {
    ...sessionToDoc(session),
    updatedAt: serverTimestamp()
  });
}

export async function deleteSessionFromFirestore(uid: string, sessionId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'sessions', sessionId));
}

/** Saves the student's profile (and chosen picture) to their account. Unset optional fields are removed. */
export async function syncProfile(uid: string): Promise<void> {
  const s = useStudyFlowStore.getState();
  const data: Record<string, unknown> = { ...profileToDoc(uid, s.user, s.customPhotoUrl), updatedAt: serverTimestamp() };
  for (const key of ['semesterStart', 'semesterEnd', 'timeZone', 'photo']) {
    if (data[key] === undefined) data[key] = deleteField();
  }
  await setDoc(doc(db, 'users', uid), data, { merge: true });
}

export async function syncOnboardingDismissed(uid: string): Promise<void> {
  await setDoc(
    doc(db, 'users', uid),
    { onboarding: { dismissed: true }, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * Copies a guest's own records into an existing account. Records whose id already exists in the
 * account are left untouched, so a merge can never overwrite what the account already holds.
 */
export function planMerge<T extends { id: string }>(existingIds: Set<string>, guestItems: T[]): T[] {
  return guestItems.filter((item) => !existingIds.has(item.id));
}

export async function mergeGuestDataIntoAccount(
  uid: string,
  guest: { assignments: Assignment[]; sessions: StudySession[]; grades?: CourseGrade[]; notes?: Note[] }
): Promise<void> {
  const guestGrades = guest.grades ?? [];
  const guestNotes = guest.notes ?? [];
  if (guest.assignments.length === 0 && guest.sessions.length === 0 && guestGrades.length === 0 && guestNotes.length === 0) return;
  const [asgSnap, sesSnap, gradeSnap] = await Promise.all([
    getDocs(query(collection(db, 'users', uid, 'assignments'), limit(LIST_CAP))),
    getDocs(query(collection(db, 'users', uid, 'sessions'), limit(LIST_CAP))),
    getDocs(query(collection(db, 'users', uid, 'grades'), limit(LIST_CAP)))
  ]);
  const newGrades = planMerge(new Set(gradeSnap.docs.map((d) => d.id)), guestGrades);
  const newAssignments = planMerge(new Set(asgSnap.docs.map((d) => d.id)), guest.assignments);
  const newSessions = planMerge(new Set(sesSnap.docs.map((d) => d.id)), guest.sessions);

  const batch = writeBatch(db);
  newGrades.slice(0, LIST_CAP).forEach((g) =>
    batch.set(doc(db, 'users', uid, 'grades', g.id), { ...gradeToDoc(g), updatedAt: serverTimestamp() })
  );
  newAssignments.slice(0, LIST_CAP).forEach((a) =>
    batch.set(doc(db, 'users', uid, 'assignments', a.id), { ...assignmentToDoc(a), updatedAt: serverTimestamp() })
  );
  newSessions.slice(0, LIST_CAP).forEach((x) =>
    batch.set(doc(db, 'users', uid, 'sessions', x.id), { ...sessionToDoc(x), updatedAt: serverTimestamp() })
  );
  await batch.commit();

  // Notes go in their own batch, so one collection can never block the others.
  if (guestNotes.length > 0) {
    const noteSnap = await getDocs(query(collection(db, 'users', uid, 'notes'), limit(LIST_CAP)));
    const newNotes = planMerge(new Set(noteSnap.docs.map((d) => d.id)), guestNotes);
    if (newNotes.length > 0) {
      const noteBatch = writeBatch(db);
      newNotes.slice(0, LIST_CAP).forEach((n) =>
        noteBatch.set(doc(db, 'users', uid, 'notes', n.id), { ...noteToDoc(n), updatedAt: serverTimestamp() })
      );
      await noteBatch.commit();
    }
  }
}

function timerDocBody(t: TimerState, rev: number): Record<string, unknown> {
  const body: Record<string, unknown> = {
    rev,
    status: t.status,
    mode: t.mode,
    durationSeconds: t.durationSec,
    updatedAt: serverTimestamp()
  };
  if (t.status === 'running') body.startedAt = serverTimestamp();
  if (t.status === 'paused') {
    body.remainingSeconds = Math.max(0, Math.min(t.durationSec, Math.ceil((t.durationSec * 1000 - t.elapsedBeforeMs) / 1000)));
  }
  return body;
}

/**
 * Publishes a timer transition. The first write creates the document at rev 1; later writes must be
 * exactly one revision higher. If another device wrote first, the rules reject this write and the
 * listener above brings us back in line, so a failure is not an error.
 */
export function pushTimerState(uid: string, t: TimerState): void {
  const rev = cloudRev + 1;
  cloudRev = rev;
  lastLocalRev = rev;
  cloudStatus = t.status;
  cloudMode = t.mode;
  setDoc(doc(db, 'users', uid, 'liveState', 'timer'), timerDocBody(t, rev)).catch((err) => {
    console.warn('Timer sync skipped (another device wrote first, or offline):', err?.code ?? err);
  });
}

function localDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Records a finished focus block. The rules only allow this in the same batch that stops a running
 * timer, with the session id tied to the timer revision, and only once enough server time has passed.
 */
export function completeFocusSession(uid: string, t: TimerState): void {
  if (cloudStatus !== 'running' || cloudMode !== 'focus') {
    // The cloud never saw this block running (offline start, or another device took over).
    pushTimerState(uid, { ...t, status: 'idle', startedAtMs: null, elapsedBeforeMs: 0 });
    return;
  }
  const runRev = cloudRev;
  const nextRev = runRev + 1;
  cloudRev = nextRev;
  lastLocalRev = nextRev;
  cloudStatus = 'idle';
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'focusSessions', `run-${runRev}`), {
    durationSeconds: t.durationSec,
    mode: 'focus',
    completedAt: serverTimestamp(),
    localDate: localDateString(new Date())
  });
  batch.set(doc(db, 'users', uid, 'liveState', 'timer'), timerDocBody({ ...t, status: 'idle', startedAtMs: null, elapsedBeforeMs: 0 }, nextRev));
  batch.commit().catch((err) => {
    console.warn('Focus session not recorded in the cloud:', err?.code ?? err);
  });
}

export async function syncNoteToFirestore(uid: string, note: Note): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'notes', note.id), { ...noteToDoc(note), updatedAt: serverTimestamp() });
}

export async function deleteNoteFromFirestore(uid: string, noteId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'notes', noteId));
}

export async function syncGradeToFirestore(uid: string, grade: CourseGrade): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'grades', grade.id), { ...gradeToDoc(grade), updatedAt: serverTimestamp() });
}

export async function deleteGradeFromFirestore(uid: string, gradeId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'grades', gradeId));
}
