import type { SoundscapeType, TimerSettings } from '../types';
import { TIMER_LIMITS_MIN } from '../lib/timerEngine';

/**
 * Timer lengths, auto-start choices and sound choices belong to the signed-in account (they sync through
 * the user document). This module holds the shared validation for them, and reads the old per-device
 * entry once so a device's earlier choices can be moved to the account that owns them.
 */
export const LEGACY_DEVICE_PREFS_KEY = 'studyflow_device_prefs';

export interface TimerPrefs {
  timerSettings: TimerSettings;
  soundscape: SoundscapeType;
  breakSoundscape: SoundscapeType;
  soundscapeVolume: number;
}

export const SOUNDS: SoundscapeType[] = ['off', 'rain', 'waves', 'pad', 'keys', 'brown', 'breeze', 'chimes'];

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  focusDuration: 25 * 60,
  shortBreakDuration: 5 * 60,
  longBreakDuration: 15 * 60,
  autoStartBreaks: false,
  autoStartFocus: false
};
export const DEFAULT_SOUND: SoundscapeType = 'off';
export const DEFAULT_VOLUME = 0.35;

const isSound = (v: unknown): v is SoundscapeType => typeof v === 'string' && (SOUNDS as string[]).includes(v);

function seconds(v: unknown, maxMinutes: number): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(maxMinutes * 60, Math.max(1, Math.round(v))) : undefined;
}

/**
 * Keeps only valid values from something read off a device or out of a stored document, so a damaged
 * entry can never break the timer. Lengths are all-or-nothing; each sound choice stands alone.
 */
export function sanitizeTimerPrefs(raw: unknown): Partial<TimerPrefs> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<TimerPrefs> = {};

  const t = r.timerSettings;
  if (t && typeof t === 'object') {
    const s = t as Record<string, unknown>;
    const focus = seconds(s.focusDuration, TIMER_LIMITS_MIN.focus);
    const short = seconds(s.shortBreakDuration, TIMER_LIMITS_MIN.shortBreak);
    const long = seconds(s.longBreakDuration, TIMER_LIMITS_MIN.longBreak);
    if (focus !== undefined && short !== undefined && long !== undefined) {
      out.timerSettings = {
        focusDuration: focus,
        shortBreakDuration: short,
        longBreakDuration: long,
        autoStartBreaks: s.autoStartBreaks === true,
        autoStartFocus: s.autoStartFocus === true
      };
    }
  }
  if (isSound(r.soundscape)) out.soundscape = r.soundscape;
  if (isSound(r.breakSoundscape)) out.breakSoundscape = r.breakSoundscape;
  if (typeof r.soundscapeVolume === 'number' && Number.isFinite(r.soundscapeVolume)) {
    out.soundscapeVolume = Math.min(1, Math.max(0, r.soundscapeVolume));
  }
  return out;
}

type StorageLike = Pick<Storage, 'getItem' | 'removeItem'>;

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // storage blocked (private window, site data blocked)
  }
}

/**
 * Reads the choices an earlier version kept for the whole device, and removes that entry so it is only
 * ever used once. Returns nothing when there was none.
 */
export function takeLegacyDevicePrefs(storage: StorageLike | null = browserStorage()): Partial<TimerPrefs> | null {
  try {
    const text = storage?.getItem(LEGACY_DEVICE_PREFS_KEY);
    if (!text) return null;
    storage?.removeItem(LEGACY_DEVICE_PREFS_KEY);
    return sanitizeTimerPrefs(JSON.parse(text));
  } catch {
    return null;
  }
}

/** True when these choices are all the defaults (nothing worth storing on an account). */
export function isDefaultTimerPrefs(p: TimerPrefs): boolean {
  const d = DEFAULT_TIMER_SETTINGS;
  const t = p.timerSettings;
  return (
    t.focusDuration === d.focusDuration &&
    t.shortBreakDuration === d.shortBreakDuration &&
    t.longBreakDuration === d.longBreakDuration &&
    t.autoStartBreaks === d.autoStartBreaks &&
    t.autoStartFocus === d.autoStartFocus &&
    p.soundscape === DEFAULT_SOUND &&
    p.breakSoundscape === DEFAULT_SOUND &&
    p.soundscapeVolume === DEFAULT_VOLUME
  );
}
