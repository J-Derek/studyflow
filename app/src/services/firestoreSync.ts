import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Assignment, StudySession, TimerMode } from '../types';
import { useStudyFlowStore } from '../store/studyFlowStore';

export interface FirestoreTimerState {
  mode: TimerMode;
  secondsLeft: number;
  isRunning: boolean;
  updatedAt: any;
}

let activeUnsubscribes: Unsubscribe[] = [];

/**
 * Cleanly terminates all active Firestore snapshot listeners across collections.
 */
export function unsubscribeAllFirestoreSync(): void {
  activeUnsubscribes.forEach((unsub) => {
    try {
      unsub();
    } catch {}
  });
  activeUnsubscribes = [];
}

/**
 * Initializes bidirectional synchronization between Zustand store and Firestore.
 * Automatically seeds default items to the user's isolated subcollection on first run.
 */
export function initFirestoreSync(uid: string): () => void {
  // Tear down previous listeners if any
  unsubscribeAllFirestoreSync();

  const store = useStudyFlowStore.getState();

  // 0. Ensure root user document exists
  const userDocRef = doc(db, 'users', uid);
  setDoc(userDocRef, {
    uid,
    name: store.user.name,
    university: store.user.university,
    program: store.user.program,
    semester: store.user.semester,
    updatedAt: serverTimestamp()
  }, { merge: true }).catch((err) => console.warn('User root doc write warning:', err));

  // 1. Sync Assignments
  const assignmentsColRef = collection(db, 'users', uid, 'assignments');
  const unsubAssignments = onSnapshot(assignmentsColRef, async (snapshot) => {
    // Guard against late in-flight snapshot race if user switched / signed out
    if (useStudyFlowStore.getState().userId !== uid) return;

    // Track real Firestore pending writes
    const hasPendingWrites = snapshot.metadata.hasPendingWrites;
    useStudyFlowStore.setState({ isSyncing: hasPendingWrites });

    if (snapshot.empty && store.assignments.length > 0) {
      // First-time guest initialization: seed initial assignments atomically
      const batch = writeBatch(db);
      for (const asg of store.assignments) {
        const asgDocRef = doc(db, 'users', uid, 'assignments', asg.id);
        batch.set(asgDocRef, { ...asg, updatedAt: serverTimestamp() }, { merge: true });
      }
      await batch.commit().catch((err) => console.warn('Batched assignment seed warning:', err));
    } else if (!snapshot.empty) {
      const remoteAssignments: Assignment[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        remoteAssignments.push({
          id: docSnap.id,
          title: data.title || '',
          course: data.course || '',
          dueDate: data.dueDate || '',
          dueTime: data.dueTime,
          priority: data.priority || 'medium',
          status: data.status || 'pending',
          progress: typeof data.progress === 'number' ? data.progress : 0,
          notes: data.notes || '',
          createdAt: data.createdAt || new Date().toISOString(),
          completedAt: data.completedAt
        });
      });
      // Sort: high priority first, then due date
      remoteAssignments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      useStudyFlowStore.setState({ assignments: remoteAssignments });
    }
  }, (err) => {
    console.warn('Firestore assignments listener warning (using offline cache):', err.message);
  });
  activeUnsubscribes.push(unsubAssignments);

  // 2. Sync Study Sessions (Calendar)
  const sessionsColRef = collection(db, 'users', uid, 'sessions');
  const unsubSessions = onSnapshot(sessionsColRef, async (snapshot) => {
    // Guard against late in-flight snapshot race if user switched / signed out
    if (useStudyFlowStore.getState().userId !== uid) return;

    if (snapshot.empty && store.sessions.length > 0) {
      // Seed default study schedule atomically
      const batch = writeBatch(db);
      for (const session of store.sessions) {
        const sessionDocRef = doc(db, 'users', uid, 'sessions', session.id);
        batch.set(sessionDocRef, { ...session, updatedAt: serverTimestamp() }, { merge: true });
      }
      await batch.commit().catch((err) => console.warn('Batched session seed warning:', err));
    } else if (!snapshot.empty) {
      const remoteSessions: StudySession[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        remoteSessions.push({
          id: docSnap.id,
          title: data.title || '',
          course: data.course || '',
          dayOfWeek: data.dayOfWeek ?? 1,
          startTime: data.startTime || '09:00',
          endTime: data.endTime || '10:00',
          type: data.type || 'study',
          color: data.color
        });
      });
      useStudyFlowStore.setState({ sessions: remoteSessions });
    }
  }, (err) => {
    console.warn('Firestore sessions listener warning (using offline cache):', err.message);
  });
  activeUnsubscribes.push(unsubSessions);

  return () => {
    unsubscribeAllFirestoreSync();
  };
}

/**
 * Persists an assignment to Firestore (and offline cache)
 */
export async function syncAssignmentToFirestore(uid: string, assignment: Assignment): Promise<void> {
  const asgDocRef = doc(db, 'users', uid, 'assignments', assignment.id);
  await setDoc(asgDocRef, {
    ...assignment,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/**
 * Deletes an assignment from Firestore
 */
export async function deleteAssignmentFromFirestore(uid: string, assignmentId: string): Promise<void> {
  const asgDocRef = doc(db, 'users', uid, 'assignments', assignmentId);
  await deleteDoc(asgDocRef);
}

/**
 * Persists a study session to Firestore
 */
export async function syncSessionToFirestore(uid: string, session: StudySession): Promise<void> {
  const sessionDocRef = doc(db, 'users', uid, 'sessions', session.id);
  await setDoc(sessionDocRef, {
    ...session,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/**
 * Deletes a study session from Firestore
 */
export async function deleteSessionFromFirestore(uid: string, sessionId: string): Promise<void> {
  const sessionDocRef = doc(db, 'users', uid, 'sessions', sessionId);
  await deleteDoc(sessionDocRef);
}
