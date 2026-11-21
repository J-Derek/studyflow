import type { TimerMode } from '../types';

/**
 * What the timer does when a block ends. Two moods, never a celebration:
 *  - focus ends, a break starts: relief (a soft warm rising two-note chime, one long gentle vibration, "Good work. Take 5.")
 *  - a break ends, focus starts: a firm nudge (one low steady knock, two short vibration taps, "Break's over. Back to it.")
 */
export type CueKind = 'relief' | 'nudge';

/** The cue for a block that just ended in this mode. */
export const cueFor = (endedMode: TimerMode): CueKind => (endedMode === 'focus' ? 'relief' : 'nudge');

/** After every fourth finished focus block the break is the long one. */
export const LONG_BREAK_EVERY = 4;

/** The mode that follows a block that just ended. `focusDone` counts finished focus blocks including the one that just ended. */
export function nextModeAfter(endedMode: TimerMode, focusDone: number): TimerMode {
  if (endedMode !== 'focus') return 'focus';
  return focusDone > 0 && focusDone % LONG_BREAK_EVERY === 0 ? 'longBreak' : 'shortBreak';
}

/** The words, on screen and in a notification: the same for both. `breakMinutes` is the length of the break that starts. */
export function cueMessage(kind: CueKind, breakMinutes: number): string {
  return kind === 'relief' ? `Good work. Take ${breakMinutes}.` : "Break's over. Back to it.";
}

/** Vibration, in milliseconds on / off / on: one long gentle pulse, or two short taps. */
export function vibrationFor(kind: CueKind): number[] {
  return kind === 'relief' ? [600] : [80, 110, 80];
}

export interface CueDeps {
  playRelief: () => void;
  playNudge: () => void;
  vibrate: (pattern: number[]) => void;
  notify: (message: string) => void;
}

/**
 * Runs a cue. Muting silences the sound (both cues); the words and the vibration are not sound, so they stay.
 * Everything is best effort: a device without audio, vibration or notifications simply skips that part.
 */
export function performCue(kind: CueKind, message: string, muted: boolean, deps: CueDeps): void {
  if (!muted) {
    try {
      (kind === 'relief' ? deps.playRelief : deps.playNudge)();
    } catch {
      /* no audio */
    }
  }
  try {
    deps.vibrate(vibrationFor(kind));
  } catch {
    /* no vibration */
  }
  try {
    deps.notify(message);
  } catch {
    /* no notifications */
  }
}

const MUTE_KEY = 'studyflow_timer_cues_muted';

/** The mute choice lives on this device (a phone in a library is not the laptop at home). */
export function readCuesMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeCuesMuted(muted: boolean): void {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, '1');
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    /* kept for this visit only */
  }
}

/** The browser's real vibration and notification, used by the app (a page in the background gets the notification, only if allowed before). */
export const browserCueDeps = (playRelief: () => void, playNudge: () => void): CueDeps => ({
  playRelief,
  playNudge,
  vibrate: (pattern) => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  },
  notify: (message) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (typeof document !== 'undefined' && !document.hidden) return; // on screen, the words are already there
    new Notification('StudyFlow', { body: message, silent: true });
  }
});
