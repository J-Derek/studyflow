import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Assessment, CourseGrade } from '../types';
import { clampWeight, MAX_ASSESSMENTS, MAX_ASSESSMENT_NAME, totalWeight } from '../utils/assessments';

interface DraftRow {
  id: string;
  name: string;
  weight: string; // what the student typed
}

interface GradingEditorProps {
  course: CourseGrade;
  onSave: (assessments: Assessment[]) => void;
  onCancel: () => void;
}

const field =
  'min-h-[44px] px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-surface-light dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500';

/** Lets a student rename assessments, set any weights, and add or remove them for one course. */
export const GradingEditor: React.FC<GradingEditorProps> = ({ course, onSave, onCancel }) => {
  const [rows, setRows] = useState<DraftRow[]>(() =>
    course.assessments.map((a) => ({ id: a.id, name: a.name, weight: String(a.weight) }))
  );

  const asAssessments = (): Assessment[] =>
    rows.map((r) => {
      const original = course.assessments.find((a) => a.id === r.id);
      const next: Assessment = { id: r.id, name: r.name, weight: clampWeight(Number(r.weight)) };
      if (original?.score !== undefined) next.score = original.score; // scores stay with their assessment
      return next;
    });

  // A row that has a score asks for a second click before it is removed, so a score is never lost by accident.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const scoreOf = (id: string) => course.assessments.find((a) => a.id === id)?.score;
  const total = totalWeight(asAssessments());
  const update = (id: string, patch: Partial<DraftRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Edit grading for {course.courseCode}</p>

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.id} className="space-y-1">
          <div className="flex items-center gap-2">
            <input
              aria-label={`Name of assessment ${i + 1}`}
              value={r.name}
              maxLength={MAX_ASSESSMENT_NAME}
              placeholder="e.g. CAT 1"
              onChange={(e) => update(r.id, { name: e.target.value })}
              className={`${field} flex-1 min-w-0`}
            />
            <input
              aria-label={`Weight of assessment ${i + 1}, percent`}
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={0.5}
              value={r.weight}
              onChange={(e) => update(r.id, { weight: e.target.value })}
              className={`${field} w-20 text-right tabular-nums`}
            />
            <span className="text-xs text-zinc-600 dark:text-zinc-400">%</span>
            <button
              type="button"
              disabled={rows.length <= 1}
              onClick={() => {
                if (scoreOf(r.id) !== undefined && confirmId !== r.id) {
                  setConfirmId(r.id);
                  return;
                }
                setConfirmId(null);
                setRows((rs) => rs.filter((x) => x.id !== r.id));
              }}
              aria-label={`${confirmId === r.id ? 'Confirm: remove' : 'Remove'} assessment ${i + 1}${r.name.trim() ? `, ${r.name.trim()}` : ''}${confirmId === r.id ? ' and its score' : ''}`}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-600 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {scoreOf(r.id) !== undefined && (
            <p className={`text-xs ${confirmId === r.id ? 'text-rose-700 dark:text-rose-300' : 'text-zinc-600 dark:text-zinc-400'}`}>
              {confirmId === r.id ? `Press remove again to delete this assessment and its score (${scoreOf(r.id)}%).` : `Your score: ${scoreOf(r.id)}%`}
            </p>
          )}
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={rows.length >= MAX_ASSESSMENTS}
        onClick={() => setRows((rs) => [...rs, { id: `a-${Date.now()}-${rs.length + 1}`, name: '', weight: '0' }])}
        className="min-h-[44px] inline-flex items-center gap-1.5 px-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40 cursor-pointer"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Add assessment</span>
      </button>

      <p
        role="status"
        className={`text-xs ${total === 100 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-300'}`}
      >
        {total === 100
          ? 'Adds up to 100%.'
          : total === 0
          ? 'The weights add up to 0%. Give at least one assessment a weight before saving.'
          : `Adds up to ${total}%. Most courses add up to 100%, so check your course outline.`}
      </p>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] px-4 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={total <= 0}
          onClick={() => onSave(asAssessments())}
          className="min-h-[44px] px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save grading
        </button>
      </div>
    </div>
  );
};
