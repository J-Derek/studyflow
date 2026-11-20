import React, { useEffect, useMemo, useState } from 'react';
import { deleteFilesForNote } from '../lib/localFiles';
import { FileText, Link2, Pin, Plus, Search } from 'lucide-react';
import { EmptyIllustration } from '../components/EmptyIllustration';
import { useStudyFlowStore } from '../store/studyFlowStore';
import type { Assignment, Note } from '../types';
import { NoteDialog } from '../components/NoteDialog';
import { ShareNoteDialog } from '../components/ShareNoteDialog';
import { WritingSpace } from '../components/WritingSpace';
import { assignmentWritings, courseCode } from '../utils/assignmentWriting';
import { NOTE_FORMAT, plainText } from '../utils/miniMarkdown';

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/** About four lines of a note, fading out when there is more, so a long note never runs down the page. */
const Preview: React.FC<{ text: string }> = ({ text }) => {
  const long = text.length > 180 || text.split('\n').length > 4;
  return (
    <span
      data-testid="note-preview"
      data-clamped={long ? 'true' : undefined}
      className={`mt-1 w-full text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap [overflow-wrap:anywhere] line-clamp-4 ${
        long ? '[mask-image:linear-gradient(to_bottom,black_55%,transparent)]' : ''
      }`}
    >
      {text}
    </span>
  );
};

export const NotesPage: React.FC = () => {
  const { notes, drafts, assignments, grades, addNote, updateNote, deleteNote, restoreNote } = useStudyFlowStore();
  const [query, setQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  // null: closed. { id: null }: writing a new note. { id }: reading or editing that note.
  const [open, setOpen] = useState<{ id: string | null } | null>(null);
  // The last deleted note stays recoverable for a few seconds.
  const [justDeleted, setJustDeleted] = useState<Note | null>(null);
  // The assignment whose writing is open in the writing space (the same one the Assignments page opens).
  const [writingFor, setWritingFor] = useState<Assignment | null>(null);
  // The note whose share-by-link dialog is open.
  const [sharingId, setSharingId] = useState<string | null>(null);
  const sharingNote = sharingId ? notes.find((n) => n.id === sharingId) ?? null : null;

  useEffect(() => {
    if (!justDeleted) return;
    const gone = justDeleted;
    const t = window.setTimeout(() => {
      // The undo window is over: the note's PDFs (kept on this device only) go with it.
      deleteFilesForNote(gone.id).catch(() => undefined);
      setJustDeleted(null);
    }, 8000);
    return () => window.clearTimeout(t);
  }, [justDeleted]);

  // Courses the student already uses elsewhere, offered as suggestions when filing a note.
  const suggestions = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => n.course && set.add(n.course));
    grades.forEach((g) => g.courseCode && set.add(g.courseCode));
    assignments.forEach((a) => {
      const code = a.course.split('—')[0]?.trim();
      if (code) set.add(code);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [notes, grades, assignments]);

  // Writing done for assignments is listed here too, so everything the student wrote can be found in one place.
  const allWritings = useMemo(() => assignmentWritings(drafts, assignments, { query: '', course: 'all' }), [drafts, assignments]);
  const writings = useMemo(() => assignmentWritings(drafts, assignments, { query, course: courseFilter }), [drafts, assignments, query, courseFilter]);
  const hasAnything = notes.length > 0 || allWritings.length > 0;

  const noteCourses = useMemo(
    () => [...new Set([...notes.map((n) => n.course), ...allWritings.map((w) => courseCode(w.assignment.course))].filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [notes, allWritings]
  );
  const hasUncategorised = notes.some((n) => !n.course);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter((n) => (courseFilter === 'all' ? true : courseFilter === 'none' ? !n.course : n.course === courseFilter))
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || n.course.toLowerCase().includes(q))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.editedAt.localeCompare(a.editedAt));
  }, [notes, query, courseFilter]);

  const openNote = open?.id ? notes.find((n) => n.id === open.id) ?? null : null;
  // If the note being read is deleted somewhere else, the dialog goes away instead of turning into a blank new note.
  const dialogOpen = open !== null && (open.id === null || openNote !== null);

  const close = () => setOpen(null);

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="sr-only md:not-sr-only text-3xl md:text-4xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Notes</h1>
          <p className="hidden md:block text-sm text-zinc-600 dark:text-zinc-400">Keep what you learn in one place, by course.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen({ id: null })}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium cursor-pointer"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>New note</span>
        </button>
      </div>

      {hasAnything && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 dark:text-zinc-400" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search notes"
              placeholder="Search your notes"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full min-h-[44px] pl-9 pr-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-surface-light dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {(noteCourses.length > 0 || hasUncategorised) && noteCourses.length > 0 && (
            <select
              aria-label="Filter by course"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="min-h-[44px] px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-surface-light dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
            >
              <option value="all">All courses</option>
              {noteCourses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              {hasUncategorised && <option value="none">No course</option>}
            </select>
          )}
        </div>
      )}

      {notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center space-y-3">
          <EmptyIllustration kind="notes" className="h-28 w-36" />
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">No notes yet</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
            Write down what the lecturer said, a summary of a reading, or a link to the slides. Try “Week 3: key points” or “Exam tips”.
          </p>
          <button
            type="button"
            onClick={() => setOpen({ id: null })}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add your first note</span>
          </button>
        </div>
      ) : visible.length === 0 ? (
        writings.length === 0 && <p className="text-sm text-zinc-600 dark:text-zinc-400 py-6 text-center">No notes match. Try a different word or course.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map((n) => (
            <li key={n.id} className="relative">
              <button
                type="button"
                onClick={() => setOpen({ id: n.id })}
                className="w-full h-full flex flex-col items-start justify-start text-left p-4 pr-24 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors cursor-pointer"
              >
                <span className="flex w-full flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  {n.course && <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">{n.course}</span>}
                  <span>{formatDate(n.editedAt)}</span>
                </span>
                <span className="mt-1.5 font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50 [overflow-wrap:anywhere] line-clamp-2">{n.title}</span>
                {n.body && <Preview text={plainText(n.body, NOTE_FORMAT)} />}
              </button>
              <button
                type="button"
                aria-pressed={n.pinned}
                aria-label={n.pinned ? `Unpin note ${n.title}` : `Pin note ${n.title}`}
                title={n.pinned ? 'Unpin' : 'Pin to top'}
                onClick={() => updateNote(n.id, { pinned: !n.pinned }, { touch: false })}
                className="absolute top-1 right-1 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <Pin className={`h-4 w-4 ${n.pinned ? 'fill-current text-blue-700 dark:text-blue-400' : ''}`} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={n.shareId ? `Shared by link: manage the link for ${n.title}` : `Share note ${n.title}`}
                title={n.shareId ? 'Shared by link' : 'Share by link'}
                onClick={() => setSharingId(n.id)}
                className="absolute top-1 right-12 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <Link2 className={`h-4 w-4 ${n.shareId ? 'text-blue-700 dark:text-blue-400' : ''}`} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {writings.length > 0 && (
        <section aria-labelledby="from-assignments-heading" className="space-y-3">
          <div className="space-y-0.5">
            <h2 id="from-assignments-heading" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              From Assignments
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">What you wrote in the writing space for an assignment. It opens where you wrote it.</p>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {writings.map(({ assignment, draft }) => (
              <li key={draft.id}>
                <button
                  type="button"
                  onClick={() => setWritingFor(assignment)}
                  className="w-full h-full flex flex-col items-start justify-start text-left p-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-surface-light dark:bg-surface-dark hover:border-zinc-500 dark:hover:border-zinc-500 transition-colors cursor-pointer"
                >
                  <span className="flex w-full flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200">
                      <FileText className="h-3 w-3" aria-hidden="true" />
                      Assignment writing
                    </span>
                    {courseCode(assignment.course) && <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">{courseCode(assignment.course)}</span>}
                    <span>{formatDate(draft.editedAt)}</span>
                  </span>
                  <span className="mt-1.5 font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50 [overflow-wrap:anywhere] line-clamp-2">
                    From Assignments: {assignment.title}
                  </span>
                  <Preview text={plainText(draft.body)} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sharingNote && <ShareNoteDialog note={sharingNote} onClose={() => setSharingId(null)} />}

      {writingFor && <WritingSpace assignment={writingFor} onClose={() => setWritingFor(null)} />}

      {dialogOpen && (
        <NoteDialog
          key={open?.id ?? 'new'}
          note={openNote}
          courses={suggestions}
          onClose={close}
          onSave={(data) => {
            if (openNote) updateNote(openNote.id, data);
            else addNote(data);
            close();
          }}
          onDelete={(n) => {
            // A second delete replaces the undo toast, so finish removing the first note's PDFs now.
            if (justDeleted) deleteFilesForNote(justDeleted.id).catch(() => undefined);
            deleteNote(n.id);
            setJustDeleted(n);
            close();
          }}
          onTogglePin={(n) => {
            updateNote(n.id, { pinned: !n.pinned }, { touch: false });
            close();
          }}
        />
      )}

      {justDeleted && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-40 flex items-center gap-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 text-sm shadow-lg max-w-[calc(100vw-2rem)]"
        >
          <span className="truncate">Deleted “{justDeleted.title}”</span>
          <button
            type="button"
            onClick={() => {
              restoreNote(justDeleted);
              setJustDeleted(null);
            }}
            className="min-h-[44px] px-2 font-semibold underline underline-offset-2 cursor-pointer shrink-0"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
};
