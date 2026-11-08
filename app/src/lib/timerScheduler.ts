import { useStudyFlowStore } from '../store/studyFlowStore';
import { isFinished } from './timerEngine';

const STORAGE_KEY = 'studyflow_storage_v1'; // same key as lib/auth.ts (not imported: that file pulls in Firebase)

let started = false;

/**
 * One scheduler for the whole app, outside React. It only reads the clock: the timer's state is
 * timestamps, so a missed tick (background tab, sleep) costs nothing. It refreshes `nowMs` once a
 * second while a block runs and finishes the block exactly once when its time is used up. Because it
 * does not depend on any page being mounted, a block finishes even if the student is on another tab
 * of the app.
 */
export function startTimerScheduler(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  // Another tab may sign out and sign in as someone else. The saved copy is then theirs, and this tab's
  // once-a-second saves would overwrite it with the previous person's data. Reload to pick up the new owner.
  let foreignOwner = false;
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const owner = (JSON.parse(e.newValue) as { state?: { dataOwnerUid?: string | null } }).state?.dataOwnerUid;
      const mine = useStudyFlowStore.getState().dataOwnerUid;
      if (owner && mine && owner !== mine) {
        foreignOwner = true;
        window.location.reload();
      }
    } catch {
      /* unreadable entry: ignore */
    }
  });

  const tick = () => {
    if (foreignOwner) return;
    const state = useStudyFlowStore.getState();
    if (state.timer.status !== 'running') return;
    const now = Date.now();
    if (isFinished(state.timer, now)) {
      state.completeTimer();
    } else {
      state.setNowMs(now);
    }
  };

  window.setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
  });
  window.addEventListener('focus', tick);
  window.addEventListener('online', tick);
  tick(); // a block that finished while the app was closed completes on load
}
