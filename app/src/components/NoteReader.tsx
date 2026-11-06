import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ExternalLink, FileText, Paperclip, Pencil, Trash2, X } from 'lucide-react';
import type { Note } from '../types';
import { useDialog } from '../lib/useDialog';
import { addFile, deleteFile, formatBytes, getFileBlob, listFiles, MAX_FILE_BYTES, type LocalFileMeta } from '../lib/localFiles';
import { LinkedText } from './LinkedText';

interface NoteReaderProps {
  note: Note;
  onClose: () => void;
  onEdit: () => void;
}

const barButton =
  'min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer';

/**
 * A full-screen place to read a note, with the PDFs the student attached on this device. PDFs are
 * never uploaded: they live in this browser only, so they do not appear on the student's other devices.
 */
export const NoteReader: React.FC<NoteReaderProps> = ({ note, onClose, onEdit }) => {
  const [files, setFiles] = useState<LocalFileMeta[]>([]);
  const [filesReady, setFilesReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<{ meta: LocalFileMeta; url: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useDialog(true, onClose);

  const refresh = useCallback(async () => {
    try {
      setFiles(await listFiles(note.id));
    } catch {
      setFiles([]);
    } finally {
      setFilesReady(true);
    }
  }, [note.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // A blob address holds the file in memory until it is released.
  useEffect(() => {
    return () => {
      if (viewing) URL.revokeObjectURL(viewing.url);
    };
  }, [viewing]);

  const attach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (picked.length === 0) return;
    setError('');
    setBusy(true);
    try {
      for (const file of picked) await addFile(note.id, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that file.');
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const open = async (meta: LocalFileMeta) => {
    setError('');
    try {
      const blob = await getFileBlob(meta.id);
      if (!blob) {
        setError('That file is no longer on this device.');
        await refresh();
        return;
      }
      setViewing({ meta, url: URL.createObjectURL(blob) });
    } catch {
      setError('Could not open that file.');
    }
  };

  const remove = async (meta: LocalFileMeta) => {
    if (!window.confirm(`Remove “${meta.name}” from this device? The note itself is not changed.`)) return;
    try {
      await deleteFile(meta.id);
    } catch {
      setError('Could not remove that file.');
    }
    if (viewing?.meta.id === meta.id) setViewing(null);
    await refresh();
  };

  // Rendered on the page itself so no animated parent can shrink or move the full-screen layer.
  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-reader-title"
      className="fixed inset-0 z-50 flex flex-col bg-surface-light dark:bg-surface-dark"
    >
      <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        {viewing ? (
          <button type="button" onClick={() => setViewing(null)} className={barButton}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to note</span>
          </button>
        ) : (
          <button type="button" onClick={onEdit} className={barButton}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            <span>Edit</span>
          </button>
        )}
        <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate min-w-0">{viewing ? viewing.meta.name : note.course || 'Note'}</p>
        <button type="button" onClick={onClose} aria-label="Close reader" className={`${barButton} !px-2.5`}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {viewing ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <iframe title={viewing.meta.name} src={viewing.url} className="flex-1 w-full min-h-0 bg-zinc-100 dark:bg-zinc-900" />
          <p className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-800">
            Not showing on your phone?{' '}
            <a href={viewing.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 underline underline-offset-2">
              Open in a new tab <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <article className="mx-auto w-full max-w-[65ch] px-4 sm:px-6 py-8 sm:py-12">
            <h1 id="note-reader-title" className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 break-words">
              {note.title || 'Untitled note'}
            </h1>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              {note.course ? `${note.course} · ` : ''}Edited {new Date(note.editedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            {note.body ? (
              <LinkedText text={note.body} className="mt-8 text-base sm:text-lg leading-relaxed text-zinc-800 dark:text-zinc-200" />
            ) : (
              <p className="mt-8 text-base text-zinc-600 dark:text-zinc-400">This note has no text yet.</p>
            )}

            <section aria-labelledby="note-files-heading" className="mt-12 pt-6 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-3">
                <h2 id="note-files-heading" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" aria-hidden="true" />
                  PDFs on this device
                </h2>
                <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className={`${barButton} border border-zinc-300 dark:border-zinc-600 disabled:opacity-60`}>
                  {busy ? 'Adding…' : 'Add a PDF'}
                </button>
                <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple onChange={attach} className="sr-only" aria-label="Choose PDF files" tabIndex={-1} />
              </div>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                Kept only on this device (up to {formatBytes(MAX_FILE_BYTES)} each). They are not uploaded, do not appear on your other devices, and are removed when you sign out.
              </p>

              {error && (
                <p role="alert" className="mt-3 text-xs font-medium text-rose-700 dark:text-rose-300">
                  {error}
                </p>
              )}

              {filesReady && files.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">No PDFs yet. For slides or documents kept online, paste the Google Drive link into the note.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 pl-3">
                      <FileText className="h-4 w-4 shrink-0 text-zinc-600 dark:text-zinc-400" aria-hidden="true" />
                      <button type="button" onClick={() => open(f)} className="flex-1 min-w-0 min-h-[44px] text-left text-sm text-zinc-900 dark:text-zinc-100 cursor-pointer">
                        <span className="block truncate font-medium">{f.name}</span>
                        <span className="block text-xs text-zinc-600 dark:text-zinc-400">{formatBytes(f.size)} · tap to read</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(f)}
                        aria-label={`Remove ${f.name} from this device`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </article>
        </div>
      )}
    </div>,
    document.body
  );
};
