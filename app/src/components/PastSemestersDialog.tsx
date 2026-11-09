import { createPortal } from 'react-dom';
import React, { useId, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { useDialog } from '../lib/useDialog';
import { periodWord } from '../utils/periods';
import { calculateCoursePercentage } from '../utils/academicCalculations';
import { kindOf, CLASS_TYPE_META } from '../utils/kinds';
import { KindBadge } from './KindBadge';
import type { Period } from '../types';

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Everything archived, grouped by the semester or term it belonged to. Read-only: this is a record, not a place to edit. */
export const PastSemestersDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { periods, archived, user } = useStudyFlowStore();
  const titleId = useId();
  const dialogRef = useDialog(true, onClose);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = periods.find((p) => p.id === openId) ?? null;
  const word = periodWord(user.periodLabel);

  const items = (p: Period) => ({
    assignments: archived.assignments.filter((x) => x.archivedPeriod === p.id),
    sessions: archived.sessions.filter((x) => x.archivedPeriod === p.id),
    grades: archived.grades.filter((x) => x.archivedPeriod === p.id),
    notes: archived.notes.filter((x) => x.archivedPeriod === p.id)
  });
  const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="past-semesters"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface-light dark:bg-surface-dark border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{open ? open.name : `Past ${word}s`}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex items-center justify-center min-h-[44px] min-w-[44px] -mt-2 -mr-2 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {open ? (
          <div className="space-y-4">
            <button type="button" onClick={() => setOpenId(null)} className="inline-flex items-center gap-1.5 min-h-[44px] -ml-2 px-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All past {word}s
            </button>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Archived {date(open.archivedAt)}. This is a record: it cannot be edited.</p>
            {(() => {
              const it = items(open);
              return (
                <>
                  <section aria-label="Work" className="space-y-1.5">
                    <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Work ({it.assignments.length})</h3>
                    {it.assignments.length === 0 ? <p className="text-sm text-zinc-600 dark:text-zinc-400">None.</p> : (
                      <ul className="space-y-1">
                        {it.assignments.map((a) => (
                          <li key={a.id} className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200 [overflow-wrap:anywhere]">
                            <span className={a.status === 'completed' ? 'line-through text-zinc-600 dark:text-zinc-400' : ''}>{a.title}</span>
                            {kindOf(a) !== 'assignment' && <KindBadge kind={kindOf(a)} />}
                            <span className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">{a.course.split('—')[0]!.trim()} · {a.dueDate}{a.status === 'completed' ? ' · done' : ''}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <section aria-label="Courses and grades" className="space-y-1.5">
                    <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Courses and grades ({it.grades.length})</h3>
                    {it.grades.length === 0 ? <p className="text-sm text-zinc-600 dark:text-zinc-400">None.</p> : (
                      <ul className="space-y-1">
                        {it.grades.map((g) => {
                          const { currentPct, gradedWeight } = calculateCoursePercentage(g);
                          return (
                            <li key={g.id} className="text-sm text-zinc-800 dark:text-zinc-200">
                              {g.courseCode} {g.courseName} <span className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">· {g.credits} credits · {gradedWeight > 0 ? `${Math.round(currentPct * 10) / 10}%` : 'no grades'}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                  <section aria-label="Classes" className="space-y-1.5">
                    <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Classes ({it.sessions.length})</h3>
                    {it.sessions.length === 0 ? <p className="text-sm text-zinc-600 dark:text-zinc-400">None.</p> : (
                      <ul className="space-y-1">
                        {it.sessions.map((s) => (
                          <li key={s.id} className="text-sm text-zinc-800 dark:text-zinc-200">
                            {s.title} <span className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">· {DAY[s.dayOfWeek]} {s.startTime} - {s.endTime} · {CLASS_TYPE_META[s.type]?.label ?? s.type}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <section aria-label="Notes" className="space-y-1.5">
                    <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Notes ({it.notes.length})</h3>
                    {it.notes.length === 0 ? <p className="text-sm text-zinc-600 dark:text-zinc-400">None.</p> : (
                      <ul className="space-y-1">
                        {it.notes.map((n) => (
                          <li key={n.id} className="text-sm text-zinc-800 dark:text-zinc-200 [overflow-wrap:anywhere]">{n.title}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              );
            })()}
          </div>
        ) : periods.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No past {word}s yet. When you start a new {word}, the old one is kept here.</p>
        ) : (
          <ul className="space-y-2">
            {periods.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(p.id)}
                  data-period={p.name}
                  className="w-full min-h-[44px] text-left px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 [overflow-wrap:anywhere]">{p.name}</span>
                  <span className="block text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
                    {date(p.archivedAt)} · {p.counts.assignments} work · {p.counts.grades} courses · {p.counts.notes} notes · {p.counts.sessions} classes
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body
  );
};
