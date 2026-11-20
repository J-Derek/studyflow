import type { TimerMode, TimerSettings } from '../types';
import { DEFAULT_TIMER_SETTINGS } from '../utils/devicePrefs';
import { clampMinutes, TIMER_LIMITS_MIN } from './timerEngine';

/** Which saved length belongs to a timer mode. */
export const LENGTH_KEY: Record<TimerMode, 'focusDuration' | 'shortBreakDuration' | 'longBreakDuration'> = {
  focus: 'focusDuration',
  shortBreak: 'shortBreakDuration',
  longBreak: 'longBreakDuration'
};

export const MODE_NAME: Record<TimerMode, string> = { focus: 'focus', shortBreak: 'short break', longBreak: 'long break' };

const LIMIT_KEY: Record<TimerMode, keyof typeof TIMER_LIMITS_MIN> = { focus: 'focus', shortBreak: 'shortBreak', longBreak: 'longBreak' };

/** The longest this mode can be, in minutes. */
export const limitFor = (mode: TimerMode): number => TIMER_LIMITS_MIN[LIMIT_KEY[mode]];

/** The app's own length for this mode (25, 5 or 15), in minutes. */
export const defaultMinutes = (mode: TimerMode): number => Math.round(DEFAULT_TIMER_SETTINGS[LENGTH_KEY[mode]] / 60);

/** The saved length for this mode, in whole minutes. */
export const savedMinutes = (mode: TimerMode, settings: Pick<TimerSettings, 'focusDuration' | 'shortBreakDuration' | 'longBreakDuration'>): number =>
  Math.max(1, Math.round(settings[LENGTH_KEY[mode]] / 60));

export interface ResolvedLength {
  /** What will be saved: whole minutes, between 1 and the mode's limit. */
  minutes: number;
  /** A short sentence when what was typed is not what will be saved; null when it is exactly what will be saved. */
  note: string | null;
}

/** Turns what was typed into the length that will be saved, and says so when it is not what was typed. A blank box keeps the saved length. */
export function resolveLength(typed: string, mode: TimerMode, saved: number): ResolvedLength {
  const text = typed.trim();
  const limit = limitFor(mode);
  if (text === '') return { minutes: saved, note: `Empty, so it stays at ${saved} ${saved === 1 ? 'minute' : 'minutes'}.` };
  const minutes = clampMinutes(Number(text), limit);
  if (String(minutes) === String(Number(text))) return { minutes, note: null };
  return { minutes, note: `A ${MODE_NAME[mode]} can be 1 to ${limit} minutes, so ${text} will be saved as ${minutes}.` };
}

/** One step of the - and + buttons, kept inside the limits. A blank or unreadable box steps from the saved length. */
export function stepLength(typed: string, mode: TimerMode, saved: number, by: 1 | -1): string {
  const current = typed.trim() === '' || !Number.isFinite(Number(typed)) ? saved : Math.round(Number(typed));
  return String(clampMinutes(current + by, limitFor(mode)));
}
