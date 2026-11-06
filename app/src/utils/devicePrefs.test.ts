import { describe, expect, it } from 'vitest';
import { DEVICE_PREFS_KEY, hasSavedDevicePrefs, readDevicePrefs, saveDevicePrefs } from './devicePrefs';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
};

const settings = { focusDuration: 30 * 60, shortBreakDuration: 7 * 60, longBreakDuration: 20 * 60, autoStartBreaks: true, autoStartFocus: false };

describe('device preferences (timer and sounds)', () => {
  it('has nothing saved at first', () => {
    const s = memory();
    expect(hasSavedDevicePrefs(s)).toBe(false);
    expect(readDevicePrefs(s)).toEqual({});
    expect(readDevicePrefs(null)).toEqual({});
  });
  it('remembers timer lengths, auto-start and sounds', () => {
    const s = memory();
    saveDevicePrefs({ timerSettings: settings, soundscape: 'rain', breakSoundscape: 'chimes', soundscapeVolume: 0.6 }, s);
    expect(hasSavedDevicePrefs(s)).toBe(true);
    expect(readDevicePrefs(s)).toEqual({ timerSettings: settings, soundscape: 'rain', breakSoundscape: 'chimes', soundscapeVolume: 0.6 });
  });
  it('keeps what a later save does not mention', () => {
    const s = memory();
    saveDevicePrefs({ timerSettings: settings, soundscape: 'rain' }, s);
    saveDevicePrefs({ soundscapeVolume: 0.2 }, s);
    expect(readDevicePrefs(s)).toMatchObject({ timerSettings: settings, soundscape: 'rain', soundscapeVolume: 0.2 });
  });
  it('only returns valid values, so a damaged entry cannot break the timer', () => {
    const s = memory();
    s.setItem(DEVICE_PREFS_KEY, JSON.stringify({ timerSettings: { focusDuration: 'x' }, soundscape: 'thunder', breakSoundscape: 'pad', soundscapeVolume: 7 }));
    expect(readDevicePrefs(s)).toEqual({ breakSoundscape: 'pad', soundscapeVolume: 1 });
    s.setItem(DEVICE_PREFS_KEY, 'not json');
    expect(readDevicePrefs(s)).toEqual({});
    s.setItem(DEVICE_PREFS_KEY, '[1,2]');
    expect(readDevicePrefs(s)).toEqual({});
  });
  it('keeps timer lengths inside the allowed range', () => {
    const s = memory();
    s.setItem(DEVICE_PREFS_KEY, JSON.stringify({ timerSettings: { focusDuration: 999999, shortBreakDuration: -4, longBreakDuration: 900 } }));
    const t = readDevicePrefs(s).timerSettings!;
    expect(t.focusDuration).toBeLessThan(999999);
    expect(t.shortBreakDuration).toBe(1);
    expect(t.longBreakDuration).toBe(900);
  });
  it('never throws when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(readDevicePrefs(blocked)).toEqual({});
    expect(() => saveDevicePrefs({ soundscape: 'rain' }, blocked)).not.toThrow();
  });
});
