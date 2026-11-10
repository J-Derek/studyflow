import { useSyncExternalStore } from 'react';

/**
 * "Install StudyFlow". Chrome, Edge and Android offer an install prompt through the `beforeinstallprompt` event, which has to be kept and
 * shown from a button. iPhones and iPads have no such event: there the way is Share, then Add to Home Screen, so the Help screen says so.
 */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
let snapshot = { canInstall: false, installed: false };

function publish(): void {
  snapshot = { canInstall: deferred !== null, installed };
  listeners.forEach((l) => l());
}

let started = false;
export function initInstallPrompt(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    publish();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    publish();
  });
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      installed = true;
      publish();
    }
  } catch {
    /* no matchMedia: not installed as far as we can tell */
  }
}

/** Shows the browser's own install prompt. Resolves to what the student chose. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred;
  if (!event) return 'unavailable';
  deferred = null; // an event can be used once
  publish();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useInstallPrompt(): { canInstall: boolean; installed: boolean; install: typeof promptInstall } {
  const s = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  return { canInstall: s.canInstall, installed: s.installed, install: promptInstall };
}
