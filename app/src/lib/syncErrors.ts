import { useSyncExternalStore } from 'react';

/**
 * Failed cloud saves. A save that the cloud refuses used to leave only a line in the developer console, so the
 * student saw their change on screen and had no idea it never reached their account. Now every failure is
 * recorded here, shown as a message with a Retry button, and counted by the "Saved" badge.
 */
export interface SyncErrorEntry {
  id: string;
  /** What could not be saved, in words for a student, e.g. "your assignment". */
  what: string;
  /** A short reason, when the cloud gave one we can explain. */
  reason: string;
  at: number;
}

type Retry = () => Promise<unknown>;

const MAX_ENTRIES = 5;
let entries: SyncErrorEntry[] = [];
const retries = new Map<string, Retry>();
const listeners = new Set<() => void>();

const emit = () => {
  entries = [...entries]; // a new array each time, so subscribers see the change
  listeners.forEach((l) => l());
};

/** Turns a Firestore error into a short reason a student can act on. */
export function explainSyncError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? '';
  if (code.includes('permission-denied')) return 'The cloud refused it. A title or note may be too long, or you may need to sign in again.';
  if (code.includes('invalid-argument')) return 'Something in it is not in a form the cloud accepts.';
  if (code.includes('resource-exhausted')) return 'The cloud is busy or a limit was reached. Try again in a moment.';
  if (code.includes('unauthenticated')) return 'You are not signed in any more. Sign in and try again.';
  if (code.includes('unavailable') || code.includes('network')) return 'There was no connection.';
  return 'The cloud could not save it.';
}

/** Records a failed save. `retry` repeats the same save; leave it out when the change was rolled back instead. */
export function reportSyncError(what: string, err: unknown, retry?: Retry): void {
  console.warn(`Sync error (${what}):`, err);
  const existing = entries.find((e) => e.what === what);
  const id = existing?.id ?? `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const entry: SyncErrorEntry = { id, what, reason: explainSyncError(err), at: Date.now() };
  entries = [entry, ...entries.filter((e) => e.id !== id)].slice(0, MAX_ENTRIES);
  if (retry) retries.set(id, retry);
  else retries.delete(id);
  emit();
}

export function dismissSyncError(id: string): void {
  entries = entries.filter((e) => e.id !== id);
  retries.delete(id);
  emit();
}

export function clearSyncErrors(): void {
  if (entries.length === 0) return;
  entries = [];
  retries.clear();
  emit();
}

export function canRetry(id: string): boolean {
  return retries.has(id);
}

/** Repeats a failed save. It disappears when the save works, and stays (with the new reason) if it fails again. */
export async function retrySyncError(id: string): Promise<boolean> {
  const retry = retries.get(id);
  const entry = entries.find((e) => e.id === id);
  if (!retry || !entry) return false;
  try {
    await retry();
    dismissSyncError(id);
    return true;
  } catch (err) {
    // The student may have dismissed the message while the retry was on its way: do not bring it back.
    if (entries.some((e) => e.id === id)) reportSyncError(entry.what, err, retry);
    return false;
  }
}

export function getSyncErrors(): SyncErrorEntry[] {
  return entries;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The current failed saves, newest first. Updates the screen when they change. */
export function useSyncErrors(): SyncErrorEntry[] {
  return useSyncExternalStore(subscribe, getSyncErrors, getSyncErrors);
}
