import { collection, deleteDoc, doc, getDocs, limit, query, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Everything stored for a student lives under users/{uid}. These are the collections inside it, and the single documents
 * that are not in a collection we can list. `accountDeletion.test.ts` reads firestore.rules and fails if a collection is
 * added there without being added here, so a new feature cannot quietly leave data behind after "Delete my account".
 */
export const ACCOUNT_COLLECTIONS = ['assignments', 'sessions', 'grades', 'notes', 'focusSessions'] as const;
/** [collection, document id] pairs the rules let us read and delete only by id (no listing). */
export const ACCOUNT_SINGLE_DOCS = [['liveState', 'timer']] as const;

const BATCH = 400;

/** Deletes one collection in batches until nothing is left. Returns how many documents it removed. */
async function deleteCollection(uid: string, name: string): Promise<number> {
  let removed = 0;
  for (;;) {
    const snap = await getDocs(query(collection(db, 'users', uid, name), limit(BATCH)));
    if (snap.empty) return removed;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    removed += snap.size;
  }
}

/**
 * Removes every document stored for this account, then the profile document itself. Safe to run again after a failure:
 * it only ever deletes what is still there. The sign-in account is removed separately, afterwards.
 */
export async function deleteAllUserData(uid: string): Promise<{ documents: number }> {
  let documents = 0;
  for (const name of ACCOUNT_COLLECTIONS) documents += await deleteCollection(uid, name);
  for (const [name, id] of ACCOUNT_SINGLE_DOCS) await deleteDoc(doc(db, 'users', uid, name, id));
  await deleteDoc(doc(db, 'users', uid));
  return { documents };
}
