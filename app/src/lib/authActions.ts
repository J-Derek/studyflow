/**
 * Lazy entry points for the sign-in code, so the Firebase SDK is not part of the first load.
 * `friendlyAuthMessage` is plain text logic and stays in the main bundle.
 */
export function friendlyAuthMessage(err: unknown): string | null {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/in-app-browser-blocked':
      return 'Google sign-in does not work inside this app. Open StudyFlow in Chrome or Safari and try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Allow pop-ups for this site, then try again.';
    case 'auth/operation-not-supported-in-this-environment':
      return 'This browser cannot open Google sign-in. Open StudyFlow in Chrome or Safari and try again.';
    case 'auth/network-request-failed':
      return 'No connection. Check your internet and try again.';
    default:
      return 'Could not sign in with Google. Please try again.';
  }
}

export const signInOrLinkWithGoogle = () => import('./auth').then((m) => m.signInOrLinkWithGoogle());
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
