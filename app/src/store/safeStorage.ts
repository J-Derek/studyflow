import type { StateStorage } from 'zustand/middleware';

/**
 * localStorage for the store, made safe.
 *
 * Why: Zustand's persist writes the saved copy on every state change and does not catch errors. When the browser's storage
 * is full, `localStorage.setItem` throws, the throw escapes from the action that changed the state, and the cloud save that
 * the action makes AFTER changing the state never runs. The student sees the change on screen, it never reaches their account,
 * and it is gone after a reload, with no message. (Audit finding F1.)
 *
 * This wrapper never throws. A failed write is reported once (through `onWriteError`), and writes that would not change
 * anything (the timer updates the clock every second) are skipped.
 */
export function createSafeStorage(
  getStorage: () => Storage | undefined,
  onWriteError: (err: unknown) => void
): StateStorage {
  const lastWritten = new Map<string, string>();
  let reported = false;
  return {
    getItem: (name) => {
      try {
        return getStorage()?.getItem(name) ?? null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      if (lastWritten.get(name) === value) return; // nothing changed (for example a clock tick)
      try {
        getStorage()?.setItem(name, value);
        lastWritten.set(name, value);
        reported = false; // a later failure is worth telling again
      } catch (err) {
        lastWritten.delete(name);
        if (!reported) {
          reported = true;
          onWriteError(err);
        }
      }
    },
    removeItem: (name) => {
      lastWritten.delete(name);
      try {
        getStorage()?.removeItem(name);
      } catch {
        /* nothing to do */
      }
    }
  };
}

/** True for the browser's "storage is full" error, whatever the browser calls it. */
export function isQuotaError(err: unknown): boolean {
  const e = err as { name?: string; code?: number } | null;
  return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
}
