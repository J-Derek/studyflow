import { describe, expect, it } from 'vitest';
import { DEFAULT_TIMER_SETTINGS, isDefaultTimerPrefs, LEGACY_DEVICE_PREFS_KEY, sanitizeTimerPrefs, takeLegacyDevicePrefs } from './devicePrefs';

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data
  };
};

const settings = { focusDuration: 30 * 60, shortBreakDuration: 7 * 60, longBreakDuration: 20 * 60, autoStartBreaks: true, autoStartFocus: false };

describe('timer preferences (sanitize and legacy entry)', () => {
  it('keeps valid lengths, flags and sounds', () => {
    expect(sanitizeTimerPrefs({ timerSettings: settings, soundscape: 'rain', breakSoundscape: 'chimes', soundscapeVolume: 0.6 })).toEqual({
      timerSettings: settings,
      soundscape: 'rain',
      breakSoundscape: 'chimes',
      soundscapeVolume: 0.6
    });
  });
  it('only returns valid values, so a damaged entry cannot break the timer', () => {
    expect(sanitizeTimerPrefs({ timerSettings: { focusDuration: 'x' }, soundscape: 'thunder', breakSoundscape: 'pad', soundscapeVolume: 7 })).toEqual({
      breakSoundscape: 'pad',
      soundscapeVolume: 1
    });
    expect(sanitizeTimerPrefs('nope')).toEqual({});
    expect(sanitizeTimerPrefs([1, 2])).toEqual({});
    expect(sanitizeTimerPrefs(null)).toEqual({});
  });
  it('keeps timer lengths inside the allowed range', () => {
    const t = sanitizeTimerPrefs({ timerSettings: { focusDuration: 999999, shortBreakDuration: -4, longBreakDuration: 900 } }).timerSettings!;
    expect(t.focusDuration).toBe(180 * 60);
    expect(t.shortBreakDuration).toBe(1);
    expect(t.longBreakDuration).toBe(900);
  });
  it('reads the old per-device entry once and removes it', () => {
    const s = memory();
    s.setItem(LEGACY_DEVICE_PREFS_KEY, JSON.stringify({ timerSettings: settings, soundscape: 'rain' }));
    expect(takeLegacyDevicePrefs(s)).toEqual({ timerSettings: settings, soundscape: 'rain' });
    expect(s.data.has(LEGACY_DEVICE_PREFS_KEY)).toBe(false);
    expect(takeLegacyDevicePrefs(s)).toBeNull();
  });
  it('never throws when storage is blocked or the entry is damaged', () => {
    const blocked = { getItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
    expect(takeLegacyDevicePrefs(blocked)).toBeNull();
    const s = memory();
    s.setItem(LEGACY_DEVICE_PREFS_KEY, 'not json');
    expect(takeLegacyDevicePrefs(s)).toBeNull();
  });
  it('recognises the defaults', () => {
    const base = { timerSettings: DEFAULT_TIMER_SETTINGS, soundscape: 'off' as const, breakSoundscape: 'off' as const, soundscapeVolume: 0.35 };
    expect(isDefaultTimerPrefs(base)).toBe(true);
    expect(isDefaultTimerPrefs({ ...base, soundscape: 'rain' })).toBe(false);
    expect(isDefaultTimerPrefs({ ...base, timerSettings: settings })).toBe(false);
  });
});
