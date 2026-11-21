import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Maximize2, Minimize2, Pencil, Pin, PinOff, Trash2, X } from 'lucide-react';
import type { Note } from '../types';
import { useDialog } from '../lib/useDialog';
import { NOTE_FORMAT } from '../utils/miniMarkdown';
import { ExportButtons } from './ExportButtons';
import { FormatButtons } from './FormatToolbar';
import { useFormatting } from '../lib/useFormatting';
import { MiniMarkdown } from './MiniMarkdown';
import { NoteReader } from './NoteReader';
import { useIsPhone } from '../lib/useIsPhone';

export const NOTE_TITLE_MAX = 120;
export const NOTE_BODY_MAX = 15000;
const COURSE_MAX = 50;

interface NoteDialogProps {
  /** The note to show, or null to write a new one. */
  note: Note | null;
  /** Course names the student already uses, offered as suggestions. */
  courses: string[];
  /** `keepOpen` is true when the note was edited from the full-screen reader: the note stays open and goes back to the reader. */
  onSave: (data: { title: string; body: string; course: string; pinned: boolean }, keepOpen?: boolean) => void;
  onDelete: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onClose: () => void;
}

const field =
  'w-full min-h-[44px] px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-surface-light dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500';

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Reads a note (with clickable links) or edits one. A new note opens straight in the editor. */
export const NoteDialog: React.FC<NoteDialogProps> = ({ note, courses, onSave, onDelete, onTogglePin, onClose }) => {
  const [mode, setMode] = useState<'view' | 'edit'>(note ? 'view' : 'edit');
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [course, setCourse] = useState(note?.course ?? '');
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [askDiscard, setAskDiscard] = useState(false);
  const [reading, setReading] = useState(false);
  // Editing that began in the full-screen reader: it stays full screen, opens where the student was reading, and goes back to the reader.
  const [fromReader, setFromReader] = useState(false);
  const [openAt, setOpenAt] = useState<number | null>(null);
  // Writing full screen: the same editor, filling the window. Escape steps back out of it before it would close the note.
  const [full, setFull] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // The same formatting buttons as the writing space for assignments.
  const format = useFormatting(bodyRef, body, (next) => setBody(next.slice(0, NOTE_BODY_MAX)));

  const dirty =
    mode === 'edit' && (title !== (note?.title ?? '') || body !== (note?.body ?? '') || course !== (note?.course ?? '') || pinned !== (note?.pinned ?? false));
  const canSave = title.trim().length > 0 || body.trim().length > 0;

  // Closing with unsaved changes asks first, so typed text is never lost by a stray tap or Escape.
  const backToReader = () => {
    setTitle(note?.title ?? '');
    setBody(note?.body ?? '');
    setCourse(note?.course ?? '');
    setPinned(note?.pinned ?? false);
    setAskDiscard(false);
    setFromReader(false);
    setFull(false);
    setMode('view');
    setReading(true);
  };
  // Leaving the editor: back to the full-screen reader if that is where it began, otherwise the note closes.
  const leaveEdit = () => (fromReader ? backToReader() : onClose());
  const requestClose = () => {
    if (dirty) setAskDiscard(true);
    else leaveEdit();
  };
  // The full-screen reader has its own focus handling while it is open. Escape leaves the edit first, then the full screen.
  const dialogRef = useDialog(!reading, full && !fromReader ? () => setFull(false) : requestClose);
  // On a phone, editing is a full-screen sheet: Cancel, title and Save in a top bar, the formatting buttons under it, then one scroll
  // area for the text. 100dvh follows the keyboard (see interactive-widget in index.html), so the bottom is never under it.
  const phone = useIsPhone();
  const sheet = phone && mode === 'edit';
  const isFull = (full && mode === 'edit') || sheet;

  const save = () => {
    if (!canSave) return;
    onSave({ title, body, course, pinned }, fromReader);
    if (fromReader) {
      // the note was saved in place; show it again in the full-screen reader
      setAskDiscard(false);
      setFromReader(false);
      setFull(false);
      setMode('view');
      setReading(true);
    }
  };

  // Opened from the reader: the cursor goes to the end of the text and the page is scrolled to where the student was reading.
  useEffect(() => {
    if (openAt === null || mode !== 'edit') return;
    const frame = requestAnimationFrame(() => {
      const el = bodyRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.scrollTop = openAt * Math.max(0, el.scrollHeight - el.clientHeight);
      setOpenAt(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [openAt, mode]);

  if (reading && note) {
    return (
      <NoteReader
        note={note}
        onClose={() => setReading(false)}
        onEdit={(scrolled) => {
          setReading(false);
          setMode('edit');
          setFromReader(true);
          setFull(true);
          setOpenAt(scrolled);
        }}
      />
    );
  }

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center ${isFull ? 'p-0' : 'p-4'}`}
      onClick={isFull ? undefined : requestClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-dialog-title"
        onClick={(e) => e.stopPropagation()}
        data-fullscreen={isFull || undefined}
        className={`bg-surface-light dark:bg-surface-dark overflow-y-auto ${
          isFull
            ? `w-full h-[100dvh] flex flex-col ${sheet ? 'gap-2 p-3 overflow-hidden' : 'gap-4 p-4 md:p-8'}`
            : 'w-full max-w-xl max-h-[calc(100dvh-2rem)] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-5 space-y-4'
        }`}
      >
        {sheet ? (
          <div className="flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={requestClose}
              className="min-h-[44px] px-3 -ml-2 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Cancel
            </button>
            <h2 id="note-dialog-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate min-w-0">
              {note ? 'Edit note' : 'New note'}
            </h2>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="min-h-[44px] px-4 -mr-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save note
            </button>
          </div>
        ) : (
        <div className="flex items-start justify-between gap-3">
          <h2 id="note-dialog-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-50 break-words min-w-0">
            {mode === 'edit' ? (note ? 'Edit note' : 'New note') : note?.title}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] -mt-2 -mr-2 flex items-center justify-center rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        )}

        {mode === 'view' && note ? (
          <>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {note.course ? `${note.course} · ` : ''}Edited {formatDate(note.editedAt)}
            </p>
            {note.body ? (
              <MiniMarkdown text={note.body} format={NOTE_FORMAT} />
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">This note has no text yet.</p>
            )}
            <div data-testid="note-actions" className="sticky bottom-0 -mx-5 -mb-5 px-5 pb-5 pt-2 bg-surface-light dark:bg-surface-dark flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setReading(true)}
                  className="min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-100 cursor-pointer"
                >
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  <span>Read full screen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  className="min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium cursor-pointer"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => onTogglePin(note)}
                  className="min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-100 cursor-pointer"
                >
                  {note.pinned ? <PinOff className="h-4 w-4" aria-hidden="true" /> : <Pin className="h-4 w-4" aria-hidden="true" />}
                  <span>{note.pinned ? 'Unpin' : 'Pin to top'}</span>
                </button>
                <ExportButtons title={note.title || 'Note'} text={note.body} format={NOTE_FORMAT} />
              </div>
              <button
                type="button"
                onClick={() => onDelete(note)}
                className="min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>Delete</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <label htmlFor="note-title" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Title
              </label>
              <input
                id="note-title"
                value={title}
                maxLength={NOTE_TITLE_MAX}
                placeholder="e.g. Week 3: Contract law"
                onChange={(e) => setTitle(e.target.value)}
                className={field}
                autoFocus={!fromReader}
              />
            </div>

            {/* Full screen is for writing: the course and pin fields wait (their values are kept) until the student steps back out. */}
            {!sheet && (            <div className={isFull ? 'hidden' : 'space-y-1'}>
              <label htmlFor="note-course" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Course (optional)
              </label>
              <input
                id="note-course"
                value={course}
                maxLength={COURSE_MAX}
                list="note-course-suggestions"
                placeholder="e.g. LAW 101"
                onChange={(e) => setCourse(e.target.value)}
                className={field}
              />
              <datalist id="note-course-suggestions">
                {courses.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            )}

            {sheet && (
              <details className="shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3">
                <summary className="min-h-[44px] flex items-center text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">Course and pin</summary>
                <div className="space-y-2 pb-3">
            {/* Full screen is for writing: the course and pin fields wait (their values are kept) until the student steps back out. */}
            <div className="space-y-1">
              <label htmlFor="note-course" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Course (optional)
              </label>
              <input
                id="note-course"
                value={course}
                maxLength={COURSE_MAX}
                list="note-course-suggestions"
                placeholder="e.g. LAW 101"
                onChange={(e) => setCourse(e.target.value)}
                className={field}
              />
              <datalist id="note-course-suggestions">
                {courses.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <label className={`flex items-center gap-2 min-h-[44px] text-sm text-zinc-800 dark:text-zinc-200 cursor-pointer`}>
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-4 w-4" />
              <span>Pin to the top</span>
            </label>

                </div>
              </details>
            )}

            <div className={isFull ? 'flex-1 min-h-0 flex flex-col gap-1' : 'space-y-1'}>
              <label htmlFor="note-body" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Note
              </label>
              <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1 -ml-1">
                <FormatButtons onFormat={format} />
                <span className="flex-1" />
                {!sheet && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setFull((v) => !v)}
                  aria-pressed={full}
                  aria-label={full ? 'Exit full screen' : 'Full screen'}
                  title={full ? 'Exit full screen (Esc)' : 'Full screen'}
                  className="flex items-center justify-center gap-1.5 min-h-[44px] px-2.5 rounded-md text-sm text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  {full ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
                  <span className="hidden sm:inline">{full ? 'Exit full screen' : 'Full screen'}</span>
                </button>
                )}
              </div>
              <textarea
                id="note-body"
                ref={bodyRef}
                rows={10}
                value={body}
                maxLength={NOTE_BODY_MAX}
                placeholder="Write here. Use the buttons for headings, bold, italic and lists. A link to slides or a reading becomes clickable when you view the note."
                onChange={(e) => setBody(e.target.value)}
                className={`${field} py-2 ${isFull ? 'flex-1 resize-none text-base leading-relaxed' : 'resize-y'}`}
              />
              {body.length > NOTE_BODY_MAX * 0.8 && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
                  {body.length.toLocaleString()} of {NOTE_BODY_MAX.toLocaleString()} characters
                </p>
              )}
            </div>

            {!sheet && (
            <label className={`${isFull ? 'hidden' : 'flex'} items-center gap-2 min-h-[44px] text-sm text-zinc-800 dark:text-zinc-200 cursor-pointer`}>
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-4 w-4" />
              <span>Pin to the top</span>
            </label>
            )}

            {askDiscard && (
              <div role="alert" className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                <p className="text-sm text-amber-900 dark:text-amber-200">You have changes that are not saved. Throw them away?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAskDiscard(false)}
                    className="min-h-[44px] px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium cursor-pointer"
                  >
                    Keep editing
                  </button>
                  <button
                    type="button"
                    onClick={leaveEdit}
                    className="min-h-[44px] px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-100 cursor-pointer"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            {!sheet && (
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={requestClose}
                className="min-h-[44px] px-4 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!canSave}
                className="min-h-[44px] px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save note
              </button>
            </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
