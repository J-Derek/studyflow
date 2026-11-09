import React, { useEffect, useId, useState } from 'react';
import { answerAgeRequest, subscribeAgeRequest } from '../lib/ageGate';
import { decideAge, type AgeChoice } from '../utils/ageGate';
import { useDialog } from '../lib/useDialog';
import { useStudyFlowStore } from '../store/studyFlowStore';

const OPTIONS: { value: AgeChoice; label: string }[] = [
  { value: 'under13', label: 'Under 13' },
  { value: '13-17', label: '13 to 17' },
  { value: '18+', label: '18 or older' }
];

/**
 * The one-time age question shown before signing in (see utils/ageGate). Under 13: no account, with a kind way to carry on as a guest.
 * 13 to 17: a tick that a parent or guardian knows and agrees. We ask for an age band, never a date of birth.
 */
export const AgeGateDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<AgeChoice | null>(null);
  const [guardian, setGuardian] = useState(false);
  const titleId = useId();
  const setActiveTab = useStudyFlowStore((s) => s.setActiveTab);

  useEffect(() => subscribeAgeRequest(setOpen), []);
  // A fresh question each time.
  useEffect(() => {
    if (open) {
      setChoice(null);
      setGuardian(false);
    }
  }, [open]);

  const cancel = () => answerAgeRequest(null);
  const dialogRef = useDialog(open, cancel);
  if (!open) return null;

  const decision = decideAge(choice, guardian);
  const under13 = choice === 'under13';

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={cancel}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="age-gate"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface-light dark:bg-surface-dark border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-5 space-y-4"
      >
        <div>
          <h2 id={titleId} className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Before you sign in</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            We ask your age so we can look after younger students properly. We do not ask for your date of birth and we do not check it.
          </p>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">How old are you?</legend>
          {OPTIONS.map((o) => (
            <label
              key={o.value}
              className="flex items-center gap-3 min-h-[44px] px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-800 dark:text-zinc-100 cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:has-[:checked]:bg-blue-950/40 focus-within:ring-2 focus-within:ring-blue-500"
            >
              <input type="radio" name="age" value={o.value} checked={choice === o.value} onChange={() => setChoice(o.value)} className="h-4 w-4 accent-blue-600" />
              {o.label}
            </label>
          ))}
        </fieldset>

        {choice === '13-17' && (
          <label className="flex items-start gap-3 min-h-[44px] px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 text-sm text-zinc-800 dark:text-zinc-100 cursor-pointer focus-within:ring-2 focus-within:ring-blue-500">
            <input type="checkbox" checked={guardian} onChange={(e) => setGuardian(e.target.checked)} className="h-4 w-4 mt-0.5 accent-blue-600" />
            <span>My parent or guardian knows I am creating this account and agrees.</span>
          </label>
        )}

        {under13 && (
          <p data-testid="age-under13" role="alert" className="text-sm rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 px-3 py-2">
            StudyFlow accounts are for people aged 13 and over. You can keep using StudyFlow as a guest on this device: your plan stays here, and we do not ask for your name or email.
          </p>
        )}

        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Read{' '}
          <a
            href="/children"
            className="underline underline-offset-2 text-blue-700 dark:text-blue-300"
            onClick={(e) => {
              e.preventDefault();
              cancel();
              setActiveTab('children');
            }}
          >
            Children and parents
          </a>
          .
        </p>

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={cancel}
            className="min-h-[44px] px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
          >
            {under13 ? 'Keep using as a guest' : 'Cancel'}
          </button>
          {!under13 && (
            <button
              type="button"
              disabled={!decision.ok}
              onClick={() => answerAgeRequest(decision.record)}
              className="min-h-[44px] px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              Continue to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
