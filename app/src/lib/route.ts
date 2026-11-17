import { useSyncExternalStore } from 'react';

/**
 * The address bar, for the few places that need more than the tab (an assignment's own page, /assignments/<id>).
 * The tab itself stays in the store (getTabFromPath); this only tells listeners that the path changed: on navigate(), on the store's
 * setActiveTab, and on the browser's Back and Forward.
 */
const listeners = new Set<() => void>();

export function notifyPathChange(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

const currentPath = () => window.location.pathname;

/** The current path, kept up to date. */
export function usePath(): string {
  return useSyncExternalStore(subscribe, currentPath, () => '/');
}

/** Goes to a path inside the app (a new history entry, so Back returns). */
export function navigate(path: string): void {
  if (window.location.pathname !== path) window.history.pushState({}, '', path);
  window.scrollTo(0, 0);
  notifyPathChange();
}

/** "/assignments/abc" -> "abc"; anything else -> null. */
export function assignmentIdFromPath(path: string): string | null {
  const m = /^\/assignments\/([^/]+)\/?$/i.exec(path);
  return m ? decodeURIComponent(m[1]) : null;
}

export const assignmentPath = (id: string) => `/assignments/${encodeURIComponent(id)}`;
