/**
 * Ad blockers and pop-up blockers often replace `window.open` with their own function, so a page can
 * never open the Google sign-in window, whatever the browser's pop-up setting says. A real, untouched
 * `window.open` prints as "[native code]"; a replacement prints its own source.
 */
export function windowOpenIsReplaced(win: { open: unknown } = window): boolean {
  try {
    return !/\[native code\]/.test(Function.prototype.toString.call(win.open));
  } catch {
    return false; // cannot tell: try the pop-up and fall back if it fails
  }
}

/** Remembers that the page is leaving for Google, so the return trip can tell a cancelled sign-in from a normal visit. */
export const REDIRECT_PENDING_KEY = 'studyflow_redirect_signin_pending';

export function markRedirectPending(storage: Pick<Storage, 'setItem'> | null = safeSession()): void {
  try {
    storage?.setItem(REDIRECT_PENDING_KEY, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
}

/** True once if the page was sent to Google a moment ago (within 15 minutes). Clears the mark. */
export function takeRedirectPending(storage: Pick<Storage, 'getItem' | 'removeItem'> | null = safeSession(), now = Date.now()): boolean {
  try {
    const raw = storage?.getItem(REDIRECT_PENDING_KEY);
    if (!raw) return false;
    storage?.removeItem(REDIRECT_PENDING_KEY);
    const at = Number(raw);
    return Number.isFinite(at) && now - at >= 0 && now - at < 15 * 60 * 1000;
  } catch {
    return false;
  }
}

/** Like takeRedirectPending, but leaves the mark in place. Used at start-up to know the student is just back from Google. */
export function peekRedirectPending(storage: Pick<Storage, 'getItem'> | null = safeSession(), now = Date.now()): boolean {
  try {
    const raw = storage?.getItem(REDIRECT_PENDING_KEY);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && now - at >= 0 && now - at < 15 * 60 * 1000;
  } catch {
    return false;
  }
}

function safeSession(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}
