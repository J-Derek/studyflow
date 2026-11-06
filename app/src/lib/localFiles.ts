/**
 * PDFs a student attaches to a note. They are kept in this browser only (IndexedDB), never uploaded:
 * Firebase Storage needs the paid plan, and lecture material may be copyrighted. Because of that they
 * do not sync to other devices, and they are removed when the student signs out or switches account.
 */

export interface LocalFileMeta {
  id: string;
  noteId: string;
  name: string;
  size: number;
  addedAt: string;
}

interface LocalFileRecord extends LocalFileMeta {
  blob: Blob;
}

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES_PER_NOTE = 10;

const DB_NAME = 'studyflow_files';
const STORE = 'files';

/** Real PDFs start with "%PDF". Checked on the bytes, not the name, before anything is stored or shown. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser cannot keep files on the device.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('noteId', 'noteId', { unique: false });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open the file store.'));
  });
}

/** Runs one transaction and always closes the connection, so a later sign-out can delete the database. */
async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error ?? new Error('File store error.'));
      tx.onabort = () => reject(tx.error ?? new Error('File store was cancelled (it may be full).'));
    });
  } finally {
    db.close();
  }
}

const toMeta = ({ id, noteId, name, size, addedAt }: LocalFileRecord): LocalFileMeta => ({ id, noteId, name, size, addedAt });

export async function listFiles(noteId: string): Promise<LocalFileMeta[]> {
  const rows = (await withStore<LocalFileRecord[]>('readonly', (s) => s.index('noteId').getAll(noteId))) ?? [];
  return rows.map(toMeta).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

export async function getFileBlob(id: string): Promise<Blob | null> {
  const row = await withStore<LocalFileRecord | undefined>('readonly', (s) => s.get(id));
  return row?.blob ?? null;
}

/** Stores a PDF for a note. Throws an Error with a message that is safe to show to the student. */
export async function addFile(noteId: string, file: File): Promise<LocalFileMeta> {
  if (file.size === 0) throw new Error('That file is empty.');
  if (file.size > MAX_FILE_BYTES) throw new Error(`That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_FILE_BYTES)}.`);
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (!looksLikePdf(head)) throw new Error('Only PDF files can be added for now.');
  if ((await listFiles(noteId)).length >= MAX_FILES_PER_NOTE) throw new Error(`A note can hold up to ${MAX_FILES_PER_NOTE} files.`);

  const record: LocalFileRecord = {
    id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    noteId,
    name: file.name.slice(0, 120) || 'document.pdf',
    size: file.size,
    addedAt: new Date().toISOString(),
    blob: new Blob([file], { type: 'application/pdf' })
  };
  try {
    await withStore('readwrite', (s) => s.put(record));
  } catch (err) {
    throw new Error(err instanceof Error && /quota|full/i.test(err.message) ? 'There is no space left on this device for that file.' : 'Could not save that file on this device.');
  }
  // Ask the browser not to clear the files when it is short of space. Best effort, may be refused.
  void navigator.storage?.persist?.().catch(() => undefined);
  return toMeta(record);
}

export async function deleteFile(id: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(id));
}

export async function deleteFilesForNote(noteId: string): Promise<void> {
  const files = await listFiles(noteId);
  await Promise.all(files.map((f) => deleteFile(f.id)));
}

/** Removes every attached file. Used on sign-out and account switch so nothing is left for the next person. */
export async function deleteAllFiles(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
