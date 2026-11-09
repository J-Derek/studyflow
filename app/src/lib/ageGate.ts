import { readDeviceAge, saveDeviceAge, type AgeRecord } from '../utils/ageGate';

/**
 * Lets the sign-in code ask the student the age question without knowing about screens: it calls ensureAgeConfirmed() and waits.
 * <AgeGateDialog /> listens, shows the question, and answers. Nothing is shown when this device already has an answer.
 */
type Listener = (open: boolean) => void;
let pending: { resolve: (ok: boolean) => void } | null = null;
const listeners = new Set<Listener>();

export function subscribeAgeRequest(l: Listener): () => void {
  listeners.add(l);
  l(pending !== null);
  return () => listeners.delete(l);
}

/** Resolves true when sign-in may go ahead (an answer exists or was just given), false when the student did not or could not. */
export function ensureAgeConfirmed(): Promise<boolean> {
  if (readDeviceAge()) return Promise.resolve(true);
  if (pending) pending.resolve(false); // a second request replaces a forgotten first one
  return new Promise<boolean>((resolve) => {
    pending = { resolve };
    listeners.forEach((l) => l(true));
  });
}

/** Called by the dialog: a record means "allowed" (and is kept on the device); null means "not allowed or cancelled". */
export function answerAgeRequest(record: AgeRecord | null): void {
  if (record) saveDeviceAge(record);
  const p = pending;
  pending = null;
  listeners.forEach((l) => l(false));
  p?.resolve(record !== null);
}
