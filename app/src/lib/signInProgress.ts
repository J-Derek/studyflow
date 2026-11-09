/**
 * "Signing you in…" for the slow kind of sign-in.
 *
 * When a guest signs in to a Google account that already exists, the app copies the guest's records into
 * the account, clears this device and reloads, then fetches the account's plan from the cloud. That takes a
 * few seconds after Google's window has closed, and nothing on screen said so: it felt slow and broken.
 * The sign-in code sets a message here; <SignInProgress /> shows it. A flag in sessionStorage carries it
 * across the reload, until the account's assignments have arrived.
 */
const RELOAD_KEY = 'studyflow_signing_in';
/** A flag older than this is stale (the reload happened long ago, or the tab was restored later). */
const RELOAD_FLAG_MAX_AGE_MS = 60_000;

export const MOVING_MESSAGE = 'Signing you in… moving your guest work into your account';
export const LOADING_MESSAGE = 'Signing you in… loading your plan';

type Listener = (message: string | null) => void;
let current: string | null = null;
const listeners = new Set<Listener>();

export function getSignInProgress(): string | null {
  return current;
}

export function setSignInProgress(message: string | null): void {
  if (message === current) return;
  current = message;
  listeners.forEach((l) => l(message));
}

export function subscribeSignInProgress(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Called right before the reload that finishes a sign-in (after the device was cleared). */
export function markSigningInAcrossReload(now = Date.now()): void {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    /* storage unavailable: the message just does not survive the reload */
  }
}

/** On page load: was this page opened by that reload? Reads and removes the flag. */
export function takeSigningInAcrossReload(now = Date.now()): boolean {
  try {
    const raw = sessionStorage.getItem(RELOAD_KEY);
    if (raw === null) return false;
    sessionStorage.removeItem(RELOAD_KEY);
    const at = Number(raw);
    return Number.isFinite(at) && now - at >= 0 && now - at < RELOAD_FLAG_MAX_AGE_MS;
  } catch {
    return false;
  }
}

/** Fired by the sync code when the signed-in account's assignments have come from the cloud. */
export const ACCOUNT_LOADED_EVENT = 'studyflow:account-loaded';

export function announceAccountLoaded(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(ACCOUNT_LOADED_EVENT));
}
