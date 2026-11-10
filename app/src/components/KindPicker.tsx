import React, { useId } from 'react';
import type { AssignmentKind } from '../types';
import { ASSIGNMENT_KINDS, KIND_META } from '../utils/kinds';
import { useStudyFlowStore } from '../store/studyFlowStore';

/** The "easy to forget" nudge is for a student's first few items only; after that it is noise. */
const NUDGE_UNTIL = 3;

/**
 * "What is it?" Choose assignment, exam, test, reading or project. The line under the choices says what the chosen one is for, and
 * nudges students to add the things they tend to forget: exams, tests and readings.
 */
export const KindPicker: React.FC<{ value: AssignmentKind; onChange: (kind: AssignmentKind) => void }> = ({ value, onChange }) => {
  const name = useId();
  const itemCount = useStudyFlowStore((s) => s.assignments.length);
  return (
    <fieldset>
      <legend className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">What is it?</legend>
      <div className="flex flex-wrap gap-1.5">
        {ASSIGNMENT_KINDS.map((k) => (
          <label
            key={k}
            className="inline-flex items-center justify-center min-h-[44px] px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-200 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 has-[:checked]:bg-zinc-900 has-[:checked]:text-white has-[:checked]:border-zinc-900 dark:has-[:checked]:bg-zinc-100 dark:has-[:checked]:text-zinc-900 dark:has-[:checked]:border-zinc-100 focus-within:ring-2 focus-within:ring-blue-500"
          >
            <input type="radio" name={name} value={k} checked={value === k} onChange={() => onChange(k)} className="sr-only" />
            {KIND_META[k].label}
          </label>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400">
        {KIND_META[value].hint}
        {itemCount < NUDGE_UNTIL && ' Exams, tests and readings are easy to forget: add them here too.'}
      </p>
    </fieldset>
  );
};
