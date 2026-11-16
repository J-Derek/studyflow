/**
 * "Are you sure?" for actions that cannot be undone (signing out, deleting a course or a class, clearing everything).
 * Callers await confirmAction(); <ConfirmHost /> shows the question and answers. It works the same way as the age question
 * (lib/ageGate), so a button inside a menu that closes can still ask.
 *
 * Actions that can be undone (deleting an assignment or a note) keep their Undo instead of asking first.
 */
export interface ConfirmRequest {
  title: string;
  body: string;
  /** The words on the button that does it, for example "Sign out" or "Delete". Never "OK" or "Yes". */
  confirmLabel: string;
}

type Listener = (request: ConfirmRequest | null) => void;
let current: { request: ConfirmRequest; resolve: (ok: boolean) => void } | null = null;
const listeners = new Set<Listener>();

export function currentConfirm(): ConfirmRequest | null {
  return current?.request ?? null;
}

export function subscribeConfirm(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentConfirm());
  return () => listeners.delete(listener);
}

/** Resolves true when the student confirms, false when they cancel (or another question replaces this one). */
export function confirmAction(request: ConfirmRequest): Promise<boolean> {
  current?.resolve(false);
  return new Promise<boolean>((resolve) => {
    current = { request, resolve };
    listeners.forEach((l) => l(request));
  });
}

/** Called by the dialog. */
export function answerConfirm(ok: boolean): void {
  const c = current;
  if (!c) return;
  current = null;
  listeners.forEach((l) => l(null));
  c.resolve(ok);
}
