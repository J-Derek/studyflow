import React, { useEffect, useState } from 'react';
import { GoogleIcon } from './GoogleIcon';
import { friendlyAuthMessage, signInOrLinkWithGoogle, warmUpGoogleSignIn } from '../lib/authActions';

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
  className?: string;
}

/** The one obvious "Sign in with Google" button. Opens Google's window directly. */
export const SignInButton: React.FC<SignInButtonProps> = ({ variant = 'block', className = '' }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    warmUpWhenIdle();
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 9000);
    return () => window.clearTimeout(t);
  }, [error]);

  const start = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInOrLinkWithGoogle();
    } catch (err) {
      setError(friendlyAuthMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className={`relative inline-flex ${variant === 'block' ? 'w-full' : ''}`}>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className={`inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-surface-light dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 font-medium transition-colors disabled:opacity-60 cursor-pointer ${
          variant === 'header' ? 'min-h-[44px] px-3 text-sm' : 'w-full min-h-[44px] px-3.5 text-sm'
        } ${className}`}
      >
        <GoogleIcon className="h-[18px] w-[18px] shrink-0" />
        <span>{busy ? 'Opening Google…' : 'Sign in with Google'}</span>
      </button>
      {error && (
        <span
          role="alert"
          className="absolute right-0 top-full mt-2 z-40 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-xs text-red-700 dark:text-red-300 shadow-md"
        >
          {error}
        </span>
      )}
    </span>
  );
};
