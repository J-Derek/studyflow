import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  getDoc,
  getDocFromServer,
  getDocs,
  limit,
  query,
  startAfter,
  where,
  serverTimestamp,
  deleteField,
  type QueryDocumentSnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Assignment, CourseGrade, Draft, Note, Period, StudySession } from '../types';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { fromCloud, sameRun, type TimerState } from '../lib/timerEngine';
import { ageToDoc, assignmentToDoc, docToAssignment, docToDraft, docToPeriod, draftToDoc, periodToDoc, docToGrade, docToNote, docToProfile, docToSession, gradeToDoc, noteToDoc, profileToDoc, sessionToDoc, docToTimerPrefs, timerPrefsToDoc } from './firestoreMappers';
import { RECENT_WRITE_MS, createRecentWrites, mergeById } from './mergeById';
import { isDefaultTimerPrefs, type TimerPrefs } from '../utils/devicePrefs';
import { cleanUpProfile } from '../utils/placeholderProfile';
import { cleanAgeRecord, readDeviceAge } from '../utils/ageGate';
import { isLegacySeedId } from '../utils/sampleData';
import { announceAccountLoaded } from '../lib/signInProgress';

const LIST_CAP = 500;

/** Items this device wrote a moment ago: a snapshot worked out just before such a write must not put the old version back (see mergeById). */
const recentWrites = createRecentWrites();

let activeUnsubscribes: Unsubscribe[] = [];

/**
 * A change from elsewhere that arrives within moments of this device writing the same item is held back (see mergeById). It must not be
 * lost: when the short window has passed, the latest snapshot is applied again. A newer snapshot for the same list replaces the wait.
 */
const holdTimers = new Map<string, ReturnType<typeof setTimeout>>();
function holdBackThenApply(key: string, remote: { item: { id: string }; pendingWrite: boolean }[], apply: () => void, generation: number): void {
  const old = holdTimers.get(key);
  if (old) clearTimeout(old);
  holdTimers.delete(key);
  if (!remote.some((x) => !x.pendingWrite && recentWrites.wroteJustNow(x.item.id))) return;
  holdTimers.set(
    key,
    setTimeout(() => {
      holdTimers.delete(key);
      if (generation === syncGeneration) apply();
    }, RECENT_WRITE_MS + 50)
  );
}
/** Bumped whenever listeners are torn down, so a list that was waiting to start for an earlier sign-in never attaches late. */
let syncGeneration = 0;

// Cloud timer bookkeeping. `cloudRev` is the revision of the stored timer document; every write
// must be exactly one higher (compare-and-swap in firestore.rules), so two devices cannot both win.
let cloudRev = 0;
let cloudStatus: 'idle' | 'running' | 'paused' | 'none' = 'none';
let cloudMode: string | null = null;
let lastLocalRev = 0;

/**
 * Which collections still have changes on their way to the cloud. The "Saved" badge must say "Saving" while ANY of
 * them does, not just assignments.
 */
const pendingWrites = new Set<string>();
function trackPending(collectionName: string, hasPending: boolean): void {
  if (hasPending) pendingWrites.add(collectionName);
  else pendingWrites.delete(collectionName);
  const syncing = pendingWrites.size > 0;
  if (useStudyFlowStore.getState().isSyncing !== syncing) useStudyFlowStore.setState({ isSyncing: syncing });
}

/**
 * Cleanly terminates all active Firestore snapshot listeners across collections.
 */
export function unsubscribeAllFirestoreSync(): void {
  syncGeneration++;
  holdTimers.forEach((t) => clearTimeout(t));
  holdTimers.clear();
  pendingWrites.clear();
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

let timerPrefsChecked: string | null = null;

/**
 * The account's timer choices win over whatever is on this device. If the account has none yet and this
 * device holds non-default ones (for example carried over from an older version), they are stored once.
 */
function applyStoredTimerPrefs(uid: string, raw: unknown, fromCache: boolean): void {
  const stored = docToTimerPrefs(raw);
  if (raw && typeof raw === 'object') {
    useStudyFlowStore.getState().applyAccountTimerPrefs(stored);
    timerPrefsChecked = uid;
    return;
  }
  if (fromCache || timerPrefsChecked === uid) return;
  timerPrefsChecked = uid;
  const s = useStudyFlowStore.getState();
  const local: TimerPrefs = {
    timerSettings: s.timerSettings,
    soundscape: s.soundscape,
    breakSoundscape: s.breakSoundscape,
    soundscapeVolume: s.soundscapeVolume
  };
  if (!isDefaultTimerPrefs(local)) syncTimerPrefs(uid).catch((err) => console.warn('Timer settings sync warning:', err));
}

/** Splits what the cloud sent into the current items and the archived ones (those with an `archivedPeriod`). */
function splitArchived<T extends { archivedPeriod?: string }>(list: T[]): { current: T[]; archived: T[] } {
  return { current: list.filter((x) => !x.archivedPeriod), archived: list.filter((x) => !!x.archivedPeriod) };
}

function isCurrentUser(uid: string): boolean {
  return useStudyFlowStore.getState().userId === uid;
}

const PAGE = 400;
const FLAGGED_COLLECTIONS = ['assignments', 'sessions', 'grades', 'notes'] as const;
/** A short fingerprint, so the device never stores a user id outside the account's own data (sign-out checks for it). */
const fingerprint = (text: string) => {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};
export const archivedFlagKey = (uid: string) => `studyflow_archived_flag_v1_${fingerprint(uid)}`;
const flagKey = archivedFlagKey;

function archivedFlagsDone(uid: string): boolean {
  try {
    return localStorage.getItem(flagKey(uid)) === '1';
  } catch {
    return false;
  }
}

/** Gives one collection's older documents the `archived` flag (false, or true when they carry an archivedPeriod). False when the server could not be reached. */
async function flagOneCollection(uid: string, name: string): Promise<boolean> {
  let last: QueryDocumentSnapshot | undefined;
  for (;;) {
    const col = collection(db, 'users', uid, name);
    const snap = await getDocs(last ? query(col, startAfter(last), limit(PAGE)) : query(col, limit(PAGE)));
    if (snap.metadata?.fromCache) return false; // an empty cache must never count as "nothing to flag"
    const missing = snap.docs.filter((d) => d.data().archived === undefined);
    for (let i = 0; i < missing.length; i += PAGE) {
      const batch = writeBatch(db);
      missing.slice(i, i + PAGE).forEach((d) => {
        const period = d.data().archivedPeriod;
        batch.update(d.ref, { archived: typeof period === 'string' && period.length > 0, updatedAt: serverTimestamp() });
      });
      await batch.commit();
    }
    if (snap.docs.length < PAGE) return true;
    last = snap.docs[snap.docs.length - 1];
  }
}

/**
 * Makes sure every assignment, class, course and note in the account has the `archived` flag, once per device and account. Documents saved
 * by an older version of the app lack it, and a query for current items would not return them. Returns true when all are flagged.
 */
export async function ensureArchivedFlags(uid: string): Promise<boolean> {
  if (archivedFlagsDone(uid)) return true;
  const results = await Promise.all(FLAGGED_COLLECTIONS.map((name) => flagOneCollection(uid, name)));
  const ok = results.every(Boolean);
  if (ok) {
    try {
      localStorage.setItem(flagKey(uid), '1');
    } catch {
      /* private mode: it simply runs again next time */
    }
  }
  return ok;
}

function startListsWhenReady(uid: string, generation: number, start: (filtered: boolean) => void): void {
  if (archivedFlagsDone(uid)) {
    start(true);
    return;
  }
  ensureArchivedFlags(uid)
    .catch((err) => {
      console.warn('Archive flag check warning (listing everything instead):', err);
      return false;
    })
    .then((ok) => {
      if (generation !== syncGeneration || !isCurrentUser(uid)) return;
      start(ok);
    });
}

/** True only when the server confirms the collection has no documents at all (current or archived). Used before uploading this device's copy. */
async function cloudHoldsNothing(uid: string, name: string): Promise<boolean> {
  try {
    const snap = await getDocs(query(collection(db, 'users', uid, name), limit(1)));
    return !snap.metadata?.fromCache && snap.docs.length === 0;
  } catch {
    return false;
  }
}

/**
 * Loads everything the student has archived (past semesters) from the account, a page at a time, and adds it to the store. The lists
 * above only carry current items, so the Past semesters screen, the backup download and the restore and clear flows call this first.
 */
export async function loadArchivedFromCloud(uid: string): Promise<void> {
  async function fetchAll<T extends { id: string }>(name: string, map: (id: string, data: Record<string, unknown>) => T): Promise<T[]> {
    const out: T[] = [];
    let last: QueryDocumentSnapshot | undefined;
    for (;;) {
      const col = collection(db, 'users', uid, name);
      const q = query(col, where('archived', '==', true));
      const snap = await getDocs(last ? query(q, startAfter(last), limit(PAGE)) : query(q, limit(PAGE)));
      snap.docs.forEach((d) => out.push(map(d.id, d.data())));
      if (snap.docs.length < PAGE) return out;
      last = snap.docs[snap.docs.length - 1];
    }
  }
  const [assignments, sessions, grades, notes] = await Promise.all([
    fetchAll('assignments', docToAssignment),
    fetchAll('sessions', docToSession),
    fetchAll('grades', docToGrade),
    fetchAll('notes', docToNote)
  ]);
  if (!isCurrentUser(uid)) return;
  // Items archived a moment ago may not be on the server yet: keep what is on screen and let the cloud's version win for the rest.
  const union = <T extends { id: string }>(local: T[], cloud: T[]) => {
    const ids = new Set(cloud.map((x) => x.id));
    return [...cloud, ...local.filter((x) => !ids.has(x.id))];
  };
  useStudyFlowStore.setState((st) => ({
    archived: {
      assignments: union(st.archived.assignments, assignments),
      sessions: union(st.archived.sessions, sessions),
      grades: union(st.archived.grades, grades),
      notes: union(st.archived.notes, notes)
    }
  }));
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
  let ageShared = false;
  const unsubUser = onSnapshot(
    userDocRef,
    (snap) => {
      if (!isCurrentUser(uid)) return;
      trackPending('profile', snap.metadata.hasPendingWrites);
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
        // The age answer given on this device, for an account that does not have one stored yet (once).
        if (!snap.metadata.fromCache && !snap.metadata.hasPendingWrites && !ageShared && cleanAgeRecord(data.ageConfirmed) === null && readDeviceAge()) {
          ageShared = true;
          syncAgeConfirmed(uid).catch((err) => console.warn('Age answer sync warning:', err));
        }
        // Our own unsaved edit echoing back must not overwrite a newer choice.
        if (!snap.metadata.hasPendingWrites) applyStoredTimerPrefs(uid, data.timerPrefs, snap.metadata.fromCache);
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

  // Past semesters (the names and counts); the archived items themselves arrive with their own collections above.
  let periodsSeeded = false;
  const unsubPeriods = onSnapshot(
    query(collection(db, 'users', uid, 'semesters'), limit(LIST_CAP)),
    async (snapshot) => {
      if (!isCurrentUser(uid)) return;
      trackPending('semesters', snapshot.metadata.hasPendingWrites);
      if (snapshot.metadata.fromCache && snapshot.empty) return;

      if (snapshot.empty && !periodsSeeded) {
        periodsSeeded = true;
        const local = useStudyFlowStore.getState().periods;
        if (local.length > 0) {
          const batch = writeBatch(db);
          for (const p of local.slice(0, LIST_CAP)) batch.set(doc(db, 'users', uid, 'semesters', p.id), { ...periodToDoc(p), updatedAt: serverTimestamp() });
          await batch.commit().catch((err) => console.warn('Batched semester upload warning:', err));
        }
        return;
      }
      periodsSeeded = true;

      const remote: Period[] = [];
      snapshot.forEach((d) => remote.push(docToPeriod(d.id, d.data())));
      remote.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
      if (isCurrentUser(uid)) useStudyFlowStore.setState({ periods: remote });
    },
    (err) => console.warn('Firestore semesters listener warning (using offline cache):', err.message)
  );
  activeUnsubscribes.push(unsubPeriods);

  // Drafts from the writing space, one per assignment. Same pattern as notes.
  let draftsSeeded = false;
  const unsubDrafts = onSnapshot(
    query(collection(db, 'users', uid, 'drafts'), limit(LIST_CAP)),
    async (snapshot) => {
      if (!isCurrentUser(uid)) return;
      trackPending('drafts', snapshot.metadata.hasPendingWrites);
      if (snapshot.metadata.fromCache && snapshot.empty) return;

      if (snapshot.empty && !draftsSeeded) {
        draftsSeeded = true;
        const local = useStudyFlowStore.getState().drafts;
        if (local.length > 0) {
          const batch = writeBatch(db);
          for (const d of local.slice(0, LIST_CAP)) {
            batch.set(doc(db, 'users', uid, 'drafts', d.id), { ...draftToDoc(d), updatedAt: serverTimestamp() });
          }
          await batch.commit().catch((err) => console.warn('Batched draft upload warning:', err));
        }
        return;
      }
      draftsSeeded = true;

      const remote: Draft[] = [];
      snapshot.forEach((d) => remote.push(docToDraft(d.id, d.data())));
      if (isCurrentUser(uid)) useStudyFlowStore.setState({ drafts: remote });
    },
    (err) => console.warn('Firestore drafts listener warning (using offline cache):', err.message)
  );
  activeUnsubscribes.push(unsubDrafts);

  // The four lists that can grow large. When every document in the account carries the `archived` flag, only CURRENT items are
  // listened to (so the 500-document cap no longer counts past semesters). Until then the old unfiltered listener is used, so nothing
  // can disappear from view. Past semesters load on demand (loadArchivedFromCloud).
  const startLists = (filtered: boolean) => {
    const listQuery = (name: string) =>
      filtered ? query(collection(db, 'users', uid, name), where('archived', '==', false), limit(LIST_CAP)) : query(collection(db, 'users', uid, name), limit(LIST_CAP));
    // Assignments. Upload happens only once, on the first server snapshot, when the cloud is empty and
    // the device holds records made before sign-in. Never re-seed after the student deletes things.
    let assignmentsSeeded = false;
    const unsubAssignments = onSnapshot(
      listQuery('assignments'),
      async (snapshot) => {
        if (!isCurrentUser(uid)) return;
        trackPending('assignments', snapshot.metadata.hasPendingWrites);

        if (snapshot.metadata.fromCache && snapshot.empty) return; // wait for the server
        // Ends "Signing you in…" after a reload. With the current-items list the server has already been read (the archive-flag check), so a first snapshot from the local copy counts too.
        if (!snapshot.metadata.fromCache || filtered) announceAccountLoaded();

        if (snapshot.empty && !assignmentsSeeded && (!filtered || (await cloudHoldsNothing(uid, 'assignments')))) {
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

        const remote: { item: Assignment; pendingWrite: boolean }[] = [];
        snapshot.forEach((d) => {
          const a = docToAssignment(d.id, d.data());
          remote.push({ item: isLegacySeedId('assignment', a.id) ? { ...a, sample: true } : a, pendingWrite: d.metadata.hasPendingWrites });
        });
        const apply = () => {
          if (!isCurrentUser(uid)) return;
          useStudyFlowStore.setState((st) => {
            const merged = mergeById(remote, filtered ? st.assignments : [...st.assignments, ...st.archived.assignments], recentWrites.wroteJustNow).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
            const { current, archived } = splitArchived(merged);
            return filtered ? { assignments: current } : { assignments: current, archived: { ...st.archived, assignments: archived } };
          });
        };
        apply();
        holdBackThenApply('assignments', remote, apply, syncGeneration);
      },
      (err) => console.warn('Firestore assignments listener warning (using offline cache):', err.message)
    );
    activeUnsubscribes.push(unsubAssignments);

    let notesSeeded = false;
    const unsubNotes = onSnapshot(
      listQuery('notes'),
      async (snapshot) => {
        if (!isCurrentUser(uid)) return;
        trackPending('notes', snapshot.metadata.hasPendingWrites);
        if (snapshot.metadata.fromCache && snapshot.empty) return;

        if (snapshot.empty && !notesSeeded && (!filtered || (await cloudHoldsNothing(uid, 'notes')))) {
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

        const remote: { item: Note; pendingWrite: boolean }[] = [];
        snapshot.forEach((d) => remote.push({ item: docToNote(d.id, d.data()), pendingWrite: d.metadata.hasPendingWrites }));
        const apply = () => {
          if (!isCurrentUser(uid)) return;
          useStudyFlowStore.setState((st) => {
            const merged = mergeById(remote, filtered ? st.notes : [...st.notes, ...st.archived.notes], recentWrites.wroteJustNow).sort((a, b) => b.editedAt.localeCompare(a.editedAt));
            const { current, archived } = splitArchived(merged);
            return filtered ? { notes: current } : { notes: current, archived: { ...st.archived, notes: archived } };
          });
        };
        apply();
        holdBackThenApply('notes', remote, apply, syncGeneration);
      },
      (err) => console.warn('Firestore notes listener warning (using offline cache):', err.message)
    );
    activeUnsubscribes.push(unsubNotes);
    let sessionsSeeded = false;
    const unsubSessions = onSnapshot(
      listQuery('sessions'),
      async (snapshot) => {
        if (!isCurrentUser(uid)) return;
        trackPending('sessions', snapshot.metadata.hasPendingWrites);
        if (snapshot.metadata.fromCache && snapshot.empty) return;

        if (snapshot.empty && !sessionsSeeded && (!filtered || (await cloudHoldsNothing(uid, 'sessions')))) {
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

        const remote: { item: StudySession; pendingWrite: boolean }[] = [];
        snapshot.forEach((d) => {
          const s = docToSession(d.id, d.data());
          remote.push({ item: isLegacySeedId('session', s.id) ? { ...s, sample: true } : s, pendingWrite: d.metadata.hasPendingWrites });
        });
        const apply = () => {
          if (!isCurrentUser(uid)) return;
          useStudyFlowStore.setState((st) => {
            const { current, archived } = splitArchived(mergeById(remote, filtered ? st.sessions : [...st.sessions, ...st.archived.sessions], recentWrites.wroteJustNow));
            return filtered ? { sessions: current } : { sessions: current, archived: { ...st.archived, sessions: archived } };
          });
        };
        apply();
        holdBackThenApply('sessions', remote, apply, syncGeneration);
      },
      (err) => console.warn('Firestore sessions listener warning (using offline cache):', err.message)
    );
    activeUnsubscribes.push(unsubSessions);

    let gradesSeeded = false;
    const unsubGrades = onSnapshot(
      listQuery('grades'),
      async (snapshot) => {
        if (!isCurrentUser(uid)) return;
        trackPending('grades', snapshot.metadata.hasPendingWrites);
        if (snapshot.metadata.fromCache && snapshot.empty) return;

        if (snapshot.empty && !gradesSeeded && (!filtered || (await cloudHoldsNothing(uid, 'grades')))) {
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

        const remote: { item: CourseGrade; pendingWrite: boolean }[] = [];
        snapshot.forEach((d) => {
          const g = docToGrade(d.id, d.data());
          remote.push({ item: isLegacySeedId('grade', g.id) ? { ...g, sample: true } : g, pendingWrite: d.metadata.hasPendingWrites });
        });
        const apply = () => {
          if (!isCurrentUser(uid)) return;
          useStudyFlowStore.setState((st) => {
            const { current, archived } = splitArchived(mergeById(remote, filtered ? st.grades : [...st.grades, ...st.archived.grades], recentWrites.wroteJustNow));
            return filtered ? { grades: current } : { grades: current, archived: { ...st.archived, grades: archived } };
          });
        };
        apply();
        holdBackThenApply('grades', remote, apply, syncGeneration);
      },
      (err) => console.warn('Firestore grades listener warning (using offline cache):', err.message)
    );
    activeUnsubscribes.push(unsubGrades);
  };
  startListsWhenReady(uid, syncGeneration, startLists);

  return () => {
    unsubscribeAllFirestoreSync();
  };
}

/** Writes the whole document (no merge) so removed fields really disappear. */
export async function syncAssignmentToFirestore(uid: string, assignment: Assignment): Promise<void> {
  recentWrites.note(assignment.id);
  await setDoc(doc(db, 'users', uid, 'assignments', assignment.id), {
    ...assignmentToDoc(assignment),
    updatedAt: serverTimestamp()
  });
}

export async function deleteAssignmentFromFirestore(uid: string, assignmentId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'assignments', assignmentId));
}

export async function syncSessionToFirestore(uid: string, session: StudySession): Promise<void> {
  recentWrites.note(session.id);
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
  const data: Record<string, unknown> = { ...profileToDoc(uid, s.user, s.customPhotoUrl, readDeviceAge()), updatedAt: serverTimestamp() };
  for (const key of ['semesterStart', 'semesterEnd', 'timeZone', 'photo']) {
    if (data[key] === undefined) data[key] = deleteField();
  }
  await setDoc(doc(db, 'users', uid), data, { merge: true });
}

/** Stores the age answer from this device in the account (a merge, so nothing else in the profile moves). */
export async function syncAgeConfirmed(uid: string): Promise<void> {
  const age = readDeviceAge();
  if (!age) return;
  await setDoc(doc(db, 'users', uid), { ageConfirmed: ageToDoc(age), updatedAt: serverTimestamp() }, { merge: true });
}

let profileCleanedFor: string | null = null;

/**
 * A placeholder name in the account's STORED profile ("Student", or the old sample "Alex Vance") gives way to
 * the Google name, and the old sample's university and programme to neutral wording. It reads the stored copy
 * from the server and changes only those fields, so a real name stored by another device is never touched.
 * Runs once per account per page load; the profile listener then shows the result.
 */
export async function cleanUpStoredProfile(uid: string, googleName: string | null): Promise<void> {
  if (profileCleanedFor === uid) return;
  profileCleanedFor = uid;
  const ref = doc(db, 'users', uid);
  const snap = await getDocFromServer(ref);
  if (!snap.exists() || !isCurrentUser(uid)) return;
  const stored = docToProfile(snap.data()).user;
  const fixed = cleanUpProfile({ name: stored.name ?? '', university: stored.university ?? '', program: stored.program ?? '' }, googleName);
  if (!fixed) return;
  await setDoc(ref, { ...fixed, updatedAt: serverTimestamp() }, { merge: true });
}

/** Saves the timer lengths and sound choices to the account (a merge, so nothing else in the profile moves). */
export async function syncTimerPrefs(uid: string): Promise<void> {
  const s = useStudyFlowStore.getState();
  const timerPrefs = timerPrefsToDoc({
    timerSettings: s.timerSettings,
    soundscape: s.soundscape,
    breakSoundscape: s.breakSoundscape,
    soundscapeVolume: s.soundscapeVolume
  });
  const ref = doc(db, 'users', uid);
  // A brand-new account has no profile yet, and the rules need one to create the document: store it together.
  if (!(await getDoc(ref)).exists()) {
    const data: Record<string, unknown> = { ...profileToDoc(uid, s.user, s.customPhotoUrl, readDeviceAge()), timerPrefs, updatedAt: serverTimestamp() };
    await setDoc(ref, data);
    return;
  }
  await setDoc(ref, { timerPrefs, updatedAt: serverTimestamp() }, { merge: true });
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
  recentWrites.note(note.id);
  await setDoc(doc(db, 'users', uid, 'notes', note.id), { ...noteToDoc(note), updatedAt: serverTimestamp() });
}

export async function deleteNoteFromFirestore(uid: string, noteId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'notes', noteId));
}

export async function syncPeriodToFirestore(uid: string, period: Period): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'semesters', period.id), { ...periodToDoc(period), updatedAt: serverTimestamp() });
}

/**
 * Writes an archive to the account in batches of 400 (Firestore allows 500 per batch). Every write sets a whole document, so running it
 * again after a failure simply writes the same values; nothing is ever deleted here. The period record goes in last, so a half-finished
 * archive never shows up as a past semester.
 */
export async function commitArchive(
  uid: string,
  period: Period,
  items: { assignments: Assignment[]; sessions: StudySession[]; grades: CourseGrade[]; notes: Note[] },
  keptGrades: CourseGrade[]
): Promise<void> {
  const ops: Array<(b: ReturnType<typeof writeBatch>) => void> = [];
  const stamp = { updatedAt: serverTimestamp() };
  for (const a of items.assignments) ops.push((b) => b.set(doc(db, 'users', uid, 'assignments', a.id), { ...assignmentToDoc(a), ...stamp }));
  for (const s of items.sessions) ops.push((b) => b.set(doc(db, 'users', uid, 'sessions', s.id), { ...sessionToDoc(s), ...stamp }));
  for (const g of items.grades) ops.push((b) => b.set(doc(db, 'users', uid, 'grades', g.id), { ...gradeToDoc(g), ...stamp }));
  for (const n of items.notes) ops.push((b) => b.set(doc(db, 'users', uid, 'notes', n.id), { ...noteToDoc(n), ...stamp }));
  // Courses that stay (their scores cleared for the new period)
  for (const g of keptGrades) ops.push((b) => b.set(doc(db, 'users', uid, 'grades', g.id), { ...gradeToDoc(g), ...stamp }));
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach((op) => op(batch));
    await batch.commit();
  }
  await syncPeriodToFirestore(uid, period);
}

export async function syncDraftToFirestore(uid: string, draft: Draft): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'drafts', draft.id), { ...draftToDoc(draft), updatedAt: serverTimestamp() });
}

export async function deleteDraftFromFirestore(uid: string, draftId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'drafts', draftId));
}

export async function syncGradeToFirestore(uid: string, grade: CourseGrade): Promise<void> {
  recentWrites.note(grade.id);
  await setDoc(doc(db, 'users', uid, 'grades', grade.id), { ...gradeToDoc(grade), updatedAt: serverTimestamp() });
}

export async function deleteGradeFromFirestore(uid: string, gradeId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'grades', gradeId));
}
