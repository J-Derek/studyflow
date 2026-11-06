import React, { useState } from 'react';
import { BookOpen, Pencil, Pin, PinOff, Trash2, X } from 'lucide-react';
import type { Note } from '../types';
import { useDialog } from '../lib/useDialog';
import { LinkedText } from './LinkedText';
import { NoteReader } from './NoteReader';

export const NOTE_TITLE_MAX = 120;
export const NOTE_BODY_MAX = 15000;
const COURSE_MAX = 50;

interface NoteDialogProps {
  /** The note to show, or null to write a new one. */
  note: Note | null;
  /** Course names the student already uses, offered as suggestions. */
  courses: string[];
  onSave: (data: { title: string; body: string; course: string; pinned: boolean }) => void;
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

  const dirty =
    mode === 'edit' && (title !== (note?.title ?? '') || body !== (note?.body ?? '') || course !== (note?.course ?? '') || pinned !== (note?.pinned ?? false));
  const canSave = title.trim().length > 0 || body.trim().length > 0;

  // Closing with unsaved changes asks first, so typed text is never lost by a stray tap or Escape.
  const requestClose = () => {
    if (dirty) setAskDiscard(true);
    else onClose();
  };
  // The full-screen reader has its own focus handling while it is open.
  const dialogRef = useDialog(!reading, requestClose);

  const save = () => {
    if (!canSave) return;
    onSave({ title, body, course, pinned });
  };

  if (reading && note) {
    return (
      <NoteReader
        note={note}
        onClose={() => setReading(false)}
        onEdit={() => {
          setReading(false);
          setMode('edit');
        }}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={requestClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface-light dark:bg-surface-dark border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-5 space-y-4"
      >
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

        {mode === 'view' && note ? (
          <>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {note.course ? `${note.course} · ` : ''}Edited {formatDate(note.editedAt)}
            </p>
            {note.body ? (
              <LinkedText text={note.body} className="text-sm text-zinc-800 dark:text-zinc-200" />
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">This note has no text yet.</p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
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
                autoFocus
              />
            </div>

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

            <div className="space-y-1">
              <label htmlFor="note-body" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Note
              </label>
              <textarea
                id="note-body"
                rows={10}
                value={body}
                maxLength={NOTE_BODY_MAX}
                placeholder="Write here. Paste a link to slides or a reading and it becomes clickable when you view the note."
                onChange={(e) => setBody(e.target.value)}
                className={`${field} py-2 resize-y`}
              />
              {body.length > NOTE_BODY_MAX * 0.8 && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
                  {body.length.toLocaleString()} of {NOTE_BODY_MAX.toLocaleString()} characters
                </p>
              )}
            </div>

            <label className="flex items-center gap-2 min-h-[44px] text-sm text-zinc-800 dark:text-zinc-200 cursor-pointer">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-4 w-4" />
              <span>Pin to the top</span>
            </label>

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
                    onClick={onClose}
                    className="min-h-[44px] px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-100 cursor-pointer"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

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
          </>
        )}
      </div>
    </div>
  );
};
