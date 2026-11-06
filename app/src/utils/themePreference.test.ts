import { describe, expect, it } from 'vitest';
import { readSavedMode, resolveTheme, saveMode, THEME_KEY } from './themePreference';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
};

describe('theme preference', () => {
  it('has no saved choice until one is made', () => {
    expect(readSavedMode(memory())).toBeNull();
    expect(readSavedMode(null)).toBeNull();
  });
  it('remembers light, dark and match-my-device', () => {
    const s = memory();
    for (const mode of ['dark', 'light', 'system'] as const) {
      saveMode(mode, s);
      expect(readSavedMode(s)).toBe(mode);
    }
  });
  it('ignores a junk saved value', () => {
    const s = memory();
    s.setItem(THEME_KEY, 'purple');
    expect(readSavedMode(s)).toBeNull();
  });
  it('never throws when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(readSavedMode(blocked)).toBeNull();
    expect(() => saveMode('dark', blocked)).not.toThrow();
  });
  it('follows the device only in system mode', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
