import { createPortal } from 'react-dom';
import React, { useId, useMemo, useState } from 'react';
import { Archive, Check, X } from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { useDialog } from '../lib/useDialog';
import { PERIOD_LABELS, periodWord, periodWordCapital, planArchive } from '../utils/periods';
import { kindOf } from '../utils/kinds';
import { KindBadge } from './KindBadge';
import type { PeriodLabel } from '../types';

/**
 * "Start a new semester": the review screen. Nothing is deleted. Everything the student does not carry over is archived into "Past
 * semesters", where it can still be read. Unfinished work is ticked to carry by default (most of it still matters); notes, the timetable and
 * the courses are left for the student to choose.
 */
export const NewSemesterDialog: React.FC<{ onClose: () => void; onOpenPast: () => void }> = ({ onClose, onOpenPast }) => {
  const { assignments, sessions, grades, notes, user, startNewPeriod } = useStudyFlowStore();
  const titleId = useId();
  const dialogRef = useDialog(true, onClose);
  const nowLabel = user.periodLabel ?? 'semester';
  const [label, setLabel] = useState<PeriodLabel>(nowLabel);
  const [name, setName] = useState('');
  const unfinished = useMemo(() => assignments.filter((a) => a.status !== 'completed'), [assignments]);
  const [carryA, setCarryA] = useState<Set<string>>(() => new Set(unfinished.map((a) => a.id)));
  const [carryN, setCarryN] = useState<Set<string>>(() => new Set());
  const [keepTimetable, setKeepTimetable] = useState(false);
  const [keepCourses, setKeepCourses] = useState(false);
  const [done, setDone] = useState<{ archived: number; kept: number; endedName: string } | null>(null);

  const word = periodWord(label);
  const plan = useMemo(
    () => planArchive({ assignments, sessions, grades, notes }, { assignmentIds: carryA, noteIds: carryN, keepTimetable, keepCourses }, 'preview'),
    [assignments, sessions, grades, notes, carryA, carryN, keepTimetable, keepCourses]
  );
  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const confirm = () => {
    const endedName = user.semester;
    startNewPeriod({ name: name.trim() || `New ${word}`, label, carry: { assignmentIds: carryA, noteIds: carryN, keepTimetable, keepCourses } });
    setDone({ archived: plan.counts.archived, kept: plan.counts.kept, endedName });
  };

  const box = 'flex items-center gap-3 min-h-[44px] px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-800 dark:text-zinc-100 cursor-pointer focus-within:ring-2 focus-within:ring-blue-500';

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="new-semester"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface-light dark:bg-surface-dark border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-5 space-y-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Start a new {word}</h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Nothing is deleted. What you do not carry over is kept in Past {word}s.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex items-center justify-center min-h-[44px] min-w-[44px] -mt-2 -mr-2 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div data-testid="new-semester-done" className="space-y-4">
            <p role="status" className="flex items-start gap-2 text-sm text-emerald-900 dark:text-emerald-200 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2">
              <Check className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                Archived {done.archived} {done.archived === 1 ? 'item' : 'items'} from “{done.endedName}”. {done.kept} carried over. Your new {word} has started.
              </span>
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button type="button" onClick={onClose} className="min-h-[44px] px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-100 cursor-pointer">Close</button>
              <button type="button" onClick={onOpenPast} className="min-h-[44px] px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium cursor-pointer">See Past {word}s</button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="sm:col-span-2 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Name of the new {word}
                <input
                  type="text"
                  value={name}
                  maxLength={50}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`e.g. ${periodWordCapital(label)} 2, 2027`}
                  className="mt-1 w-full min-h-[44px] px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Called a
                <select
                  value={label}
                  onChange={(e) => setLabel(e.target.value as PeriodLabel)}
                  className="mt-1 w-full min-h-[44px] px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-900 text-sm capitalize text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PERIOD_LABELS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </label>
            </div>

            <section aria-label="Unfinished work" className="space-y-2">
              <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Unfinished work to carry over ({carryA.size} of {unfinished.length})</h3>
              {unfinished.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Nothing unfinished. Finished work is always archived.</p>
              ) : (
                <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                  {unfinished.map((a) => (
                    <li key={a.id}>
                      <label className={box}>
                        <input type="checkbox" checked={carryA.has(a.id)} onChange={() => toggle(carryA, a.id, setCarryA)} className="h-4 w-4 accent-blue-600" />
                        <span className="flex-1 min-w-0 [overflow-wrap:anywhere]">{a.title}<span className="block text-xs text-zinc-600 dark:text-zinc-400">{a.course.split('—')[0]!.trim()} · due {a.dueDate}</span></span>
                        {kindOf(a) !== 'assignment' && <KindBadge kind={kindOf(a)} />}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="Notes" className="space-y-2">
              <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Notes to carry over ({carryN.size} of {notes.length})</h3>
              {notes.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">No notes.</p>
              ) : (
                <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                  {notes.map((n) => (
                    <li key={n.id}>
                      <label className={box}>
                        <input type="checkbox" checked={carryN.has(n.id)} onChange={() => toggle(carryN, n.id, setCarryN)} className="h-4 w-4 accent-blue-600" />
                        <span className="flex-1 min-w-0 [overflow-wrap:anywhere]">{n.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="Timetable and courses" className="space-y-1.5">
              <label className={box}>
                <input type="checkbox" checked={keepTimetable} onChange={(e) => setKeepTimetable(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                Keep my timetable ({sessions.length} {sessions.length === 1 ? 'class' : 'classes'})
              </label>
              <label className={box}>
                <input type="checkbox" checked={keepCourses} onChange={(e) => setKeepCourses(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                Keep my courses ({grades.length}), with the scores cleared
              </label>
            </section>

            <p data-testid="archive-summary" aria-live="polite" className="text-sm text-zinc-800 dark:text-zinc-200 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2">
              <strong>{plan.counts.archived}</strong> {plan.counts.archived === 1 ? 'item' : 'items'} will be archived under “{user.semester}”, and <strong>{plan.counts.kept}</strong> carried over.
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button type="button" onClick={onClose} className="min-h-[44px] px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer">
                Cancel
              </button>
              <button type="button" onClick={confirm} className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium cursor-pointer">
                <Archive className="h-4 w-4" aria-hidden="true" />
                Archive and start the new {word}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
