import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Loader2 } from 'lucide-react';
import { LOADING_MESSAGE, getSignInProgress, isFinishingSignIn, subscribeFinishingSignIn, subscribeSignInProgress } from '../lib/signInProgress';

/**
 * A small note at the top of the screen while a sign-in into an existing account finishes (see
 * lib/signInProgress). Polite live region, not role="status": older tests expect one status element.
 */
export const SignInProgress: React.FC = () => {
  const [moving, setMoving] = useState<string | null>(() => getSignInProgress());
  // Shared with the sign-in buttons (lib/signInProgress): true after the sign-in reload until the account's plan has arrived.
  const loading = useSyncExternalStore(subscribeFinishingSignIn, isFinishingSignIn, () => false);

  useEffect(() => subscribeSignInProgress(setMoving), []);

  const message = moving ?? (loading ? LOADING_MESSAGE : null);
  return (
    <div aria-live="polite" className="pointer-events-none fixed top-3 left-1/2 -translate-x-1/2 z-[55]">
      {message && (
        <p
          data-testid="sign-in-progress"
          className="flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-800 px-4 py-2 text-sm text-zinc-800 dark:text-zinc-100 shadow-md"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {message}
        </p>
      )}
    </div>
  );
};
