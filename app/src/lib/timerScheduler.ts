import { useStudyFlowStore } from '../store/studyFlowStore';
import { isFinished } from './timerEngine';

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

  const tick = () => {
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
