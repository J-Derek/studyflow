import type { SoundscapeType, TimerSettings } from '../types';
import { TIMER_LIMITS_MIN } from '../lib/timerEngine';

export const DEVICE_PREFS_KEY = 'studyflow_device_prefs';

export interface DevicePrefs {
  timerSettings: TimerSettings;
  soundscape: SoundscapeType;
  breakSoundscape: SoundscapeType;
  soundscapeVolume: number;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const SOUNDS: SoundscapeType[] = ['off', 'rain', 'waves', 'pad', 'keys', 'brown', 'breeze', 'chimes'];

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // storage blocked (private window, site data blocked)
  }
}

const isSound = (v: unknown): v is SoundscapeType => typeof v === 'string' && (SOUNDS as string[]).includes(v);

function seconds(v: unknown, maxMinutes: number): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(maxMinutes * 60, Math.max(1, Math.round(v))) : undefined;
}

function readRaw(storage: StorageLike | null): Record<string, unknown> | null {
  try {
    const text = storage?.getItem(DEVICE_PREFS_KEY);
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** True once this device has saved any of these choices (so older saves can be carried over once). */
export function hasSavedDevicePrefs(storage: StorageLike | null = browserStorage()): boolean {
  return readRaw(storage) !== null;
}

/**
 * Timer lengths, auto-start choices and sound choices are about this device, not about an account, so
 * they are kept in their own entry. Signing out wipes the student's data from the browser; this entry is
 * deliberately left alone. Only valid values come back, so a damaged entry can never break the timer.
 */
export function readDevicePrefs(storage: StorageLike | null = browserStorage()): Partial<DevicePrefs> {
  const raw = readRaw(storage);
  if (!raw) return {};
  const out: Partial<DevicePrefs> = {};

  const t = raw.timerSettings;
  if (t && typeof t === 'object') {
    const r = t as Record<string, unknown>;
    const focus = seconds(r.focusDuration, TIMER_LIMITS_MIN.focus);
    const short = seconds(r.shortBreakDuration, TIMER_LIMITS_MIN.shortBreak);
    const long = seconds(r.longBreakDuration, TIMER_LIMITS_MIN.longBreak);
    if (focus !== undefined && short !== undefined && long !== undefined) {
      out.timerSettings = {
        focusDuration: focus,
        shortBreakDuration: short,
        longBreakDuration: long,
        autoStartBreaks: r.autoStartBreaks === true,
        autoStartFocus: r.autoStartFocus === true
      };
    }
  }
  if (isSound(raw.soundscape)) out.soundscape = raw.soundscape;
  if (isSound(raw.breakSoundscape)) out.breakSoundscape = raw.breakSoundscape;
  if (typeof raw.soundscapeVolume === 'number' && Number.isFinite(raw.soundscapeVolume)) {
    out.soundscapeVolume = Math.min(1, Math.max(0, raw.soundscapeVolume));
  }
  return out;
}

/** Saves some of the choices, keeping the ones not mentioned. */
export function saveDevicePrefs(patch: Partial<DevicePrefs>, storage: StorageLike | null = browserStorage()): void {
  try {
    const next = { ...(readRaw(storage) ?? {}), ...patch };
    storage?.setItem(DEVICE_PREFS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the choices still apply until the page is closed */
  }
}
