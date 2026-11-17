import React, { useId, useState } from 'react';
import { X } from 'lucide-react';
import { useDialog } from '../lib/useDialog';
import { useStudyFlowStore } from '../store/studyFlowStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

const input =
  'w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500';

/** The first and last day of the semester. Weekly classes show only between them; exams and reviews keep their own dates. */
export const SemesterDatesDialog: React.FC<Props> = ({ open, onClose }) => (open ? <SemesterDatesForm onClose={onClose} /> : null);

/** Mounted only while open, so it starts from the saved dates every time. */
const SemesterDatesForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const user = useStudyFlowStore((s) => s.user);
  const updateUser = useStudyFlowStore((s) => s.updateUser);
  const [start, setStart] = useState(user.semesterStart ?? '');
  const [end, setEnd] = useState(user.semesterEnd ?? '');
  const titleId = useId();
  const dialogRef = useDialog(true, onClose);

  const backwards = !!start && !!end && end < start;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (backwards) return;
    updateUser({ semesterStart: start || undefined, semesterEnd: end || undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-light dark:bg-surface-dark rounded-xl w-full max-w-sm shadow-2xl border border-zinc-200/80 dark:border-zinc-800/80"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800/80">
          <h2 id={titleId} className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
            Semester dates
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={save} noValidate className="p-5 space-y-3.5">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Weekly classes show only between these days. Exams and reviews keep their own dates.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              First day
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={`mt-1 ${input}`} />
            </label>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Last day
              <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} className={`mt-1 ${input}`} />
            </label>
          </div>
          {backwards && (
            <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300">
              The last day must be after the first day.
            </p>
          )}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800">
            <button type="button" onClick={onClose} className="px-3 py-1.5 min-h-[44px] md:min-h-0 rounded-md text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              Cancel
            </button>
            <button type="submit" className="px-3.5 py-1.5 min-h-[44px] md:min-h-0 rounded-md text-xs font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white/90">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
