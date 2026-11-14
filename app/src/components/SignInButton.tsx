import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Loader2 } from 'lucide-react';
import { GoogleIcon } from './GoogleIcon';
import { friendlyAuthMessage, signInOrLinkWithGoogle, warmUpGoogleSignIn } from '../lib/authActions';
import { isFinishingSignIn, subscribeFinishingSignIn } from '../lib/signInProgress';

/** If a finished sign-in somehow leaves this button on screen, it comes back after this long. */
const STAY_BUSY_MS = 20_000;

let warmedUp = false;
/** Gets Google's sign-in ready once the page is idle, so the pop-up opens instantly when clicked. */
function warmUpWhenIdle(): void {
  if (warmedUp || typeof window === 'undefined') return;
  warmedUp = true;
  const run = () => void warmUpGoogleSignIn();
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2500);
}

interface SignInButtonProps {
  /** "header" is the compact top-bar button, "block" fills its container. */
  variant?: 'header' | 'block';
  /** Where an error message opens. Use "above" for a button at the bottom of the screen, so it is not cut off. */
  errorPlacement?: 'below' | 'above';
  className?: string;
}

/** The one obvious "Sign in with Google" button. Opens Google's window directly. */
export const SignInButton: React.FC<SignInButtonProps> = ({ variant = 'block', errorPlacement = 'below', className = '' }) => {
  const [pressed, setPressed] = useState(false);
  // After the sign-in reload the page starts as a guest page again until the account has loaded: stay busy through that too.
  const finishing = useSyncExternalStore(subscribeFinishingSignIn, isFinishingSignIn, () => false);
  const busy = pressed || finishing;
  const [error, setError] = useState<string | null>(null);
  const releaseTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    warmUpWhenIdle();
    return () => window.clearTimeout(releaseTimer.current);
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 9000);
    return () => window.clearTimeout(t);
  }, [error]);

  const start = async () => {
    setError(null);
    setPressed(true);
    try {
      await signInOrLinkWithGoogle();
      // Google has answered, but the app is still moving work into the account and reloading. Staying busy hides that wait:
      // the button used to flip back to "Sign in with Google" for a few seconds before the page changed.
      releaseTimer.current = window.setTimeout(() => setPressed(false), STAY_BUSY_MS);
    } catch (err) {
      setError(friendlyAuthMessage(err));
      setPressed(false);
    }
  };

  return (
    <span className={`relative inline-flex ${variant === 'block' ? 'w-full' : ''}`}>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        aria-label="Sign in with Google"
        className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-zinc-300 dark:border-zinc-600 bg-surface-light dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 font-medium transition-colors disabled:opacity-60 cursor-pointer ${
          variant === 'header' ? 'min-h-[44px] px-3 text-sm' : 'w-full min-h-[44px] px-3.5 text-sm'
        } ${className}`}
      >
        {busy ? (
          <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <GoogleIcon className="h-[18px] w-[18px] shrink-0" />
        )}
        {variant === 'header' ? (
          <>
            <span className="xl:hidden">{busy ? 'Signing in…' : 'Sign in'}</span>
            <span className="hidden xl:inline">{busy ? 'Signing in…' : 'Sign in with Google'}</span>
          </>
        ) : (
          <span>{busy ? 'Signing in…' : 'Sign in with Google'}</span>
        )}
      </button>
      {error && (
        <span
          role="alert"
          className={`absolute z-40 w-72 max-w-[calc(100vw-2rem)] ${
            errorPlacement === 'above' ? 'left-0 bottom-full mb-2' : 'right-0 top-full mt-2'
          } rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-xs text-red-700 dark:text-red-300 shadow-md`}
        >
          {error}
        </span>
      )}
    </span>
  );
};
