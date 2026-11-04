import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  limit,
  query,
  serverTimestamp,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Assignment, StudySession } from '../types';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { assignmentToDoc, docToAssignment, docToSession, sessionToDoc } from './firestoreMappers';
import { isLegacySeedId } from '../utils/sampleData';

const LIST_CAP = 500;

let activeUnsubscribes: Unsubscribe[] = [];

/**
 * Cleanly terminates all active Firestore snapshot listeners across collections.
 */
export function unsubscribeAllFirestoreSync(): void {
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
  const { user } = useStudyFlowStore.getState();
  setDoc(
    userDocRef,
    {
      uid,
      name: user.name,
      university: user.university,
      program: user.program,
      semester: user.semester,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  ).catch((err) => console.warn('User root doc write warning:', err));

  const unsubUser = onSnapshot(
    userDocRef,
    (snap) => {
      if (!isCurrentUser(uid)) return;
      const dismissed = snap.data()?.onboarding?.dismissed === true;
      if (dismissed !== useStudyFlowStore.getState().onboardingDismissed) {
        useStudyFlowStore.setState({ onboardingDismissed: dismissed });
      }
    },
    (err) => console.warn('Firestore profile listener warning:', err.message)
  );
  activeUnsubscribes.push(unsubUser);

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

export async function syncOnboardingDismissed(uid: string): Promise<void> {
  await setDoc(
    doc(db, 'users', uid),
    { onboarding: { dismissed: true }, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
