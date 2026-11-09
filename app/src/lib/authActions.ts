/**
 * Lazy entry points for the sign-in code, so the Firebase SDK is not part of the first load.
 * `friendlyAuthMessage` is plain text logic and stays in the main bundle.
 */
import { ensureAgeConfirmed } from './ageGate';

export function friendlyAuthMessage(err: unknown): string | null {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/in-app-browser-blocked':
      return 'Google sign-in does not work inside this app. Open StudyFlow in Chrome or Safari and try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Click the blocked pop-up icon at the right end of the address bar, choose "Always allow", then press Sign in again.';
    case 'auth/operation-not-supported-in-this-environment':
      return 'This browser cannot open Google sign-in. Open StudyFlow in Chrome or Safari and try again.';
    case 'auth/user-mismatch':
      return 'That is a different Google account. Choose the account you are signed in with.';
    case 'auth/no-account':
      return 'There is no signed-in account to delete.';
    case 'auth/merge-failed':
      return 'You are signed in, but your guest records could not be moved yet. They are safe on this device and will be moved the next time you open StudyFlow with a connection.';
    case 'auth/network-request-failed':
      return 'No connection. Check your internet and try again.';
    default:
      return 'Could not sign in with Google. Please try again.';
  }
}

/**
 * Every sign-in button goes through here. The age question (see lib/ageGate) comes first; if it is not answered or the answer is
 * "under 13", the sign-in quietly stops (the dialog has already said why).
 */
export const signInOrLinkWithGoogle = async () => {
  if (!(await ensureAgeConfirmed())) {
    throw Object.assign(new Error('The age question was not completed.'), { code: 'auth/cancelled-popup-request' });
  }
  return import('./auth').then((m) => m.signInOrLinkWithGoogle());
};
export const deleteMyAccount = () => import('./auth').then((m) => m.deleteMyAccount());
export const warmUpGoogleSignIn = () => import('./auth').then((m) => m.warmUpGoogleSignIn());
export const signOutUser = () => import('./auth').then((m) => m.signOutUser());
export const startAuthSessionLazy = (): (() => void) => {
  let stop: (() => void) | null = null;
  let cancelled = false;
  import('./auth').then((m) => {
    if (!cancelled) stop = m.startAuthSession();
  });
  return () => {
    cancelled = true;
    stop?.();
  };
};
