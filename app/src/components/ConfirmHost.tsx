import { useEffect, useId, useRef, useState } from 'react';
import { answerConfirm, subscribeConfirm, type ConfirmRequest } from '../lib/confirm';

/**
 * The one "Are you sure?" dialog (see lib/confirm). It can open on top of another dialog, so it handles Tab and Escape itself, before
 * the dialog underneath sees them. Cancel has focus first: pressing Enter by habit must not delete anything.
 */
export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => subscribeConfirm(setRequest), []);

  useEffect(() => {
    if (!request) return;
    const opener = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => cancelRef.current?.focus());
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        answerConfirm(false);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        (document.activeElement === cancelRef.current ? confirmRef.current : cancelRef.current)?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown, true);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [request]);

  if (!request) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => answerConfirm(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-testid="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-surface-light dark:bg-surface-dark border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-5 space-y-4"
      >
        <div className="space-y-1">
          <h2 id={titleId} className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {request.title}
          </h2>
          <p id={bodyId} className="text-sm text-zinc-700 dark:text-zinc-300">
            {request.body}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => answerConfirm(false)}
            className="min-h-[44px] px-4 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-blue-500 cursor-pointer"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => answerConfirm(true)}
            className="min-h-[44px] px-4 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 cursor-pointer"
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
