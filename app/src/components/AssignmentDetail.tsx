import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Circle, Edit3, Maximize2, X } from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import type { Assignment } from '../types';
import { getDaysRemaining } from '../utils/formatters';
import { LIMITS } from '../utils/limits';
import { kindOf } from '../utils/kinds';
import { MAX_DRAFT_BODY } from '../services/firestoreMappers';
import { useDraftText } from '../lib/useDraftText';
import { useFormatting } from '../lib/useFormatting';
import { navigate } from '../lib/route';
import { useAccountDataReady } from '../lib/useAccountDataReady';
import { AssignmentModal } from './AssignmentModal';
import { WritingSpace } from './WritingSpace';
import { KindBadge } from './KindBadge';
import { FormatButtons } from './FormatToolbar';
import { ExportButtons } from './ExportButtons';
import { celebrate } from './CelebrateBurst';

const button =
  'inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-md border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer';

const BackLink: React.FC = () => (
  <button
    type="button"
    onClick={() => navigate('/assignments')}
    className="inline-flex items-center gap-1.5 min-h-[44px] -ml-2 px-2 rounded-md text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
  >
    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
    All assignments
  </button>
);

/** "15 Jan 2030, 23:59" from the stored day and time. */
function dueText(a: Assignment): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a.dueDate ?? '');
  if (!m) return '';
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return a.dueTime ? `${day}, ${a.dueTime}` : day;
}

/** One assignment on its own page (/assignments/<id>): what it is, when it is due, its checklist and its notes. */
export const AssignmentDetail: React.FC<{ id: string }> = ({ id }) => {
  const asg = useStudyFlowStore((s) => s.assignments.find((a) => a.id === id));
  const { toggleAssignmentComplete, toggleSubtask, addSubtask, deleteSubtask, saveDraft, updateAssignment } = useStudyFlowStore();
  const [editing, setEditing] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [fullScreen, setFullScreen] = useState(false);
  const flushNotes = useRef<() => void>(() => {});
  // The notes editor (and its Full screen button) is unmounted while full screen is open, so focus is put back on the new button when it returns.
  const fullScreenButton = useRef<HTMLButtonElement | null>(null);
  const cameFromFullScreen = useRef(false);
  useEffect(() => {
    if (fullScreen || !cameFromFullScreen.current) return;
    cameFromFullScreen.current = false;
    const frame = requestAnimationFrame(() => fullScreenButton.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [fullScreen]);
  const dataReady = useAccountDataReady();

  // There used to be two kinds of note: a short one on the card and the longer writing. The short one is put at the top of the notes once.
  const hasOldNote = !!asg?.notes?.trim();
  useEffect(() => {
    if (!hasOldNote) return;
    const s = useStudyFlowStore.getState();
    const old = s.assignments.find((a) => a.id === id)?.notes?.trim();
    if (!old) return;
    const draft = s.drafts.find((d) => d.id === id)?.body ?? '';
    saveDraft(id, draft.trim() ? `${old}\n\n${draft}` : old);
    updateAssignment(id, { notes: '' });
  }, [hasOldNote, id, saveDraft, updateAssignment]);

  if (!asg && !dataReady) {
    return (
      <div className="space-y-3 animate-fade-in" role="status" aria-live="polite">
        <BackLink />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading your assignment…</p>
      </div>
    );
  }

  if (!asg) {
    return (
      <div className="space-y-3 animate-fade-in">
        <BackLink />
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">This assignment isn't here</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">It may have been deleted, or the link is not quite right.</p>
      </div>
    );
  }

  const isCompleted = asg.status === 'completed';
  const { label, isUrgent } = getDaysRemaining(asg.dueDate);
  const subtasks = asg.subtasks ?? [];
  const kind = kindOf(asg);

  const toggleDone = () => {
    toggleAssignmentComplete(asg.id);
    if (!isCompleted) celebrate(asg.title);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 max-w-4xl">
      <BackLink />

      <header className="space-y-2">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{asg.course}</p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 [overflow-wrap:anywhere]">{asg.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <KindBadge kind={kind} />
          {isCompleted ? (
            <span data-testid="done-badge" className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Done
            </span>
          ) : (
            <span className={isUrgent ? 'text-red-600 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-400'}>
              {label}
              {dueText(asg) && <span className="text-zinc-600 dark:text-zinc-400"> · {dueText(asg)}</span>}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={toggleDone} className={button}>
            {isCompleted ? <Circle className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
            {isCompleted ? 'Mark not done' : 'Mark done'}
          </button>
          <button type="button" onClick={() => setEditing(true)} className={button}>
            <Edit3 className="h-4 w-4" aria-hidden="true" />
            Edit
          </button>
        </div>
      </header>

      <section aria-labelledby="asg-checklist" className="space-y-2">
        <h2 id="asg-checklist" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Checklist
          {subtasks.length > 0 && (
            <span className="ml-2 font-normal text-zinc-600 dark:text-zinc-400 tabular-nums">
              {subtasks.filter((s) => s.completed).length} of {subtasks.length} done
            </span>
          )}
        </h2>
        {subtasks.length > 0 && (
          <ul className="space-y-0.5">
            {subtasks.map((st) => (
              <li key={st.id} className="flex items-center gap-1">
                <label className="flex-1 min-w-0 min-h-[44px] flex items-center gap-2 px-1 rounded hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={st.completed}
                    onChange={() => {
                      toggleSubtask(asg.id, st.id);
                      // ticking the last open item finishes the assignment
                      if (!st.completed && !isCompleted && subtasks.filter((x) => !x.completed).length === 1) celebrate(asg.title);
                    }}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 cursor-pointer"
                  />
                  <span className={`[overflow-wrap:anywhere] ${st.completed ? 'line-through text-zinc-600 dark:text-zinc-400' : 'text-zinc-800 dark:text-zinc-200'}`}>{st.title}</span>
                </label>
                <button
                  type="button"
                  onClick={() => deleteSubtask(asg.id, st.id)}
                  aria-label={`Remove "${st.title}"`}
                  className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          type="text"
          aria-label={`Add a subtask to ${asg.title}`}
          maxLength={LIMITS.subtaskTitle}
          placeholder="Add a subtask and press Enter"
          value={newSubtask}
          onChange={(e) => setNewSubtask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newSubtask.trim()) {
              e.preventDefault();
              addSubtask(asg.id, newSubtask.trim());
              setNewSubtask('');
            }
          }}
          className="min-h-[44px] w-full max-w-md px-3 py-2 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </section>

      {/* Waits for an older short note to be folded in, so the box starts with it. Hidden while full screen is open (one editor, and one
          print copy, at a time); it reads the text back when full screen closes. */}
      {!hasOldNote && !fullScreen && (
        <NotesEditor
          assignment={asg}
          registerFlush={(f) => (flushNotes.current = f)}
          fullScreenButton={fullScreenButton}
          onFullScreen={() => {
            flushNotes.current();
            cameFromFullScreen.current = true;
            setFullScreen(true);
          }}
        />
      )}

      <AssignmentModal isOpen={editing} onClose={() => setEditing(false)} assignmentToEdit={asg} />
      {fullScreen && (
        <WritingSpace
          assignment={asg}
          onClose={() => setFullScreen(false)}
        />
      )}
    </div>
  );
};

/** The assignment's notes, on the page: the same text as the full-screen view, with the same formatting buttons and export. */
const NotesEditor: React.FC<{ assignment: Assignment; registerFlush: (f: () => void) => void; onFullScreen: () => void; fullScreenButton: React.RefObject<HTMLButtonElement | null> }> = ({
  assignment,
  registerFlush,
  fullScreenButton,
  onFullScreen
}) => {
  const { text, change, flush, status, wordCount } = useDraftText(assignment.id);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const format = useFormatting(areaRef, text, change);
  const boxId = useId();
  useEffect(() => registerFlush(flush), [flush, registerFlush]);
  // The notes box grows with the text, so the page is the only thing that scrolls (a box with its own scroll inside a scrolling page is hard to use on a phone).
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(280, el.scrollHeight + 2)}px`;
  }, [text]);

  return (
    <section aria-labelledby={`${boxId}-h`} className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${boxId}-h`} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <label htmlFor={boxId}>Notes</label>
        </h2>
        <p aria-live="polite" data-testid="notes-status" className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
          {status === 'saving' ? 'Saving…' : 'Saved'} · {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </p>
      </div>
      <div role="toolbar" aria-label="Formatting and export" className="flex flex-wrap items-center gap-1">
        <FormatButtons onFormat={format} />
        <span className="flex-1" />
        <ExportButtons title={assignment.title} text={text} onBeforeExport={flush} />
        <button type="button" ref={fullScreenButton} onClick={onFullScreen} className={button}>
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
          Full screen
        </button>
      </div>
      <textarea
        id={boxId}
        ref={areaRef}
        value={text}
        onChange={(e) => change(e.target.value)}
        maxLength={MAX_DRAFT_BODY}
        spellCheck
        rows={14}
        placeholder="What the lecturer said, page numbers, your draft. Use the buttons above for headings, bold, italic and lists."
        className="w-full min-h-[280px] resize-y rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-900 p-3 text-sm leading-relaxed text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </section>
  );
};
