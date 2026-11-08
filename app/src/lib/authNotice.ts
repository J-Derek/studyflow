/**
 * A short message for the student that does not belong to any button: for example, when they come back
 * from Google and the sign-in did not finish. Sent from the sign-in code, shown by <AuthNotice />.
 */
export const AUTH_NOTICE_EVENT = 'studyflow:auth-notice';

let pending: string | null = null;

export function postAuthNotice(message: string): void {
  pending = message;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(AUTH_NOTICE_EVENT, { detail: message }));
}

/** The latest message that nobody has shown yet (the sign-in code may finish before the page has drawn). */
export function takePendingAuthNotice(): string | null {
  const m = pending;
  pending = null;
  return m;
}
