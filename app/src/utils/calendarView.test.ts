import { describe, expect, it } from 'vitest';
import { CALENDAR_VIEW_KEY, readCalendarView, saveCalendarView } from './calendarView';

const memory = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v)
  };
};
const throwing = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  }
};

describe('the Week or Month choice is kept on this device', () => {
  it('starts on Week when nothing was chosen', () => {
    expect(readCalendarView(memory())).toBe('week');
  });
  it('remembers Month, and Week again after switching back', () => {
    const s = memory();
    saveCalendarView('month', s);
    expect(s.data.get(CALENDAR_VIEW_KEY)).toBe('month');
    expect(readCalendarView(s)).toBe('month');
    saveCalendarView('week', s);
    expect(readCalendarView(s)).toBe('week');
  });
  it('ignores a damaged entry', () => {
    const s = memory();
    s.data.set(CALENDAR_VIEW_KEY, 'year');
    expect(readCalendarView(s)).toBe('week');
  });
  it('never throws when storage is blocked, full or missing', () => {
    expect(readCalendarView(throwing)).toBe('week');
    expect(() => saveCalendarView('month', throwing)).not.toThrow();
    expect(readCalendarView(null)).toBe('week');
    expect(() => saveCalendarView('month', null)).not.toThrow();
  });
});
