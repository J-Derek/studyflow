import { collection, deleteField, doc, getDoc, getDocs, limit, query, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Note } from '../types';
import { MAX_SHARED_BODY, MAX_SHARED_BY, MAX_SHARED_COURSE, MAX_SHARED_TITLE, cleanSharedText, isShareId, newShareId } from '../utils/shareNote';

/**
 * A note shared by link: a read-only copy at sharedNotes/{id} that anyone with the link can open, and a marker at
 * users/{uid}/shares/{id} that says whose it is. The copy never holds the uid or email; the rules use the marker.
 */

export interface SharedNote {
  id: string;
  title: string;
  body: string;
  course: string;
  sharedAt: string; // ISO
  sharedBy?: string;
}

function copyOf(note: Note, sharedBy: string | null) {
  const name = sharedBy ? cleanSharedText(sharedBy, MAX_SHARED_BY).trim() : '';
  return {
    title: cleanSharedText(note.title, MAX_SHARED_TITLE).trim() || 'Untitled note',
    body: cleanSharedText(note.body, MAX_SHARED_BODY),
    course: cleanSharedText(note.course, MAX_SHARED_COURSE).trim(),
    ...(name ? { sharedBy: name } : {}),
    updatedAt: serverTimestamp()
  };
}

/** Publishes a copy of the note and returns its new link id. */
export async function shareNote(uid: string, note: Note, sharedBy: string | null): Promise<string> {
  const id = newShareId();
  const batch = writeBatch(db);
  batch.set(doc(db, 'sharedNotes', id), { ...copyOf(note, sharedBy), sharedAt: serverTimestamp() });
  batch.set(doc(db, 'users', uid, 'shares', id), { id, noteId: note.id, sharedAt: serverTimestamp() });
  await batch.commit();
  return id;
}

/** Replaces the shared copy with the note as it is now (same link). */
export async function updateSharedNote(shareId: string, note: Note, sharedBy: string | null): Promise<void> {
  const batch = writeBatch(db);
  // A merge keeps sharedAt; the name is removed when it is no longer shown.
  const data = copyOf(note, sharedBy);
  batch.set(doc(db, 'sharedNotes', shareId), 'sharedBy' in data ? data : { ...data, sharedBy: deleteField() }, { merge: true });
  await batch.commit();
}

/** Deletes the shared copy and its marker: the link stops working at once. */
export async function stopSharing(uid: string, shareId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'sharedNotes', shareId));
  batch.delete(doc(db, 'users', uid, 'shares', shareId));
  await batch.commit();
}

/** Stops every link this account has shared (account deletion). Returns how many it removed. */
export async function stopAllSharing(uid: string): Promise<number> {
  let removed = 0;
  for (;;) {
    const snap = await getDocs(query(collection(db, 'users', uid, 'shares'), limit(200)));
    if (snap.empty) return removed;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.delete(doc(db, 'sharedNotes', d.id));
      batch.delete(d.ref);
    });
    await batch.commit();
    removed += snap.size;
  }
}

/** Reads a shared note for the public page. null when the link was stopped, never existed, or is malformed. */
export async function fetchSharedNote(shareId: string): Promise<SharedNote | null> {
  if (!isShareId(shareId)) return null;
  const snap = await getDoc(doc(db, 'sharedNotes', shareId));
  if (!snap.exists()) return null;
  const d = snap.data();
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const at = d.sharedAt instanceof Timestamp ? d.sharedAt.toDate().toISOString() : '';
  return {
    id: shareId,
    title: str(d.title) || 'Untitled note',
    body: str(d.body),
    course: str(d.course),
    sharedAt: at,
    ...(str(d.sharedBy) ? { sharedBy: str(d.sharedBy) } : {})
  };
}
