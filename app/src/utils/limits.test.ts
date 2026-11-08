import { describe, expect, it } from 'vitest';
import { clampText, isDateInRange, localDateISO } from './limits';

describe('limits', () => {
  it('trims and shortens text', () => {
    expect(clampText('  Essay  ', 10)).toBe('Essay');
    expect(clampText('a'.repeat(300), 250)).toHaveLength(250);
  });
  it('gives the local date, not the UTC one', () => {
    // 01:30 on 5 March local time is still 5 March, whatever the UTC date is
    expect(localDateISO(new Date(2026, 2, 5, 1, 30))).toBe('2026-03-05');
    expect(localDateISO(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
  it('accepts sensible dates and refuses typos and impossible days', () => {
    expect(isDateInRange('2026-11-08')).toBe(true);
    expect(isDateInRange('1999-12-31')).toBe(false);
    expect(isDateInRange('2101-01-01')).toBe(false);
    expect(isDateInRange('2026-02-30')).toBe(false);
    expect(isDateInRange('20256-01-01')).toBe(false);
    expect(isDateInRange('')).toBe(false);
  });
});
