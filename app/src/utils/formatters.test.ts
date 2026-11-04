import { describe, expect, it } from 'vitest';
import { getDaysRemaining } from './formatters';

// Instants chosen around the 2026 US daylight-saving changes, evaluated in explicit zones.
describe('getDaysRemaining across daylight-saving boundaries', () => {
  it('spring forward (America/New_York, 2026-03-08): Saturday night -> Sunday due is 1 day', () => {
    const sat2300 = new Date('2026-03-08T04:00:00Z'); // Sat 2026-03-07 23:00 EST
    expect(getDaysRemaining('2026-03-08', sat2300, 'America/New_York').days).toBe(1);
  });
  it('spring forward: due Monday from Saturday morning is 2 days', () => {
    const satMorning = new Date('2026-03-07T14:00:00Z');
    expect(getDaysRemaining('2026-03-09', satMorning, 'America/New_York').days).toBe(2);
  });
  it('the 23-hour day does not make "tomorrow" read as today', () => {
    const sun0030 = new Date('2026-03-08T05:30:00Z'); // 00:30 EST, before the 02:00 jump
    expect(getDaysRemaining('2026-03-09', sun0030, 'America/New_York').label).toBe('Due tomorrow');
    expect(getDaysRemaining('2026-03-08', sun0030, 'America/New_York').label).toBe('Due today');
  });
  it('fall back (America/New_York, 2026-11-01): the 25-hour day is still one day', () => {
    const sat2300 = new Date('2026-11-01T03:00:00Z'); // Sat 2026-10-31 23:00 EDT
    expect(getDaysRemaining('2026-11-01', sat2300, 'America/New_York').days).toBe(1);
    const sun2330 = new Date('2026-11-02T04:30:00Z'); // Sun 2026-11-01 23:30 EST
    expect(getDaysRemaining('2026-11-02', sun2330, 'America/New_York').label).toBe('Due tomorrow');
  });
  it('a New York evening does not shift a UTC-parsed date back a day (previous bug)', () => {
    const evening = new Date('2026-11-05T00:30:00Z'); // 2026-11-04 19:30 EST
    expect(getDaysRemaining('2026-11-05', evening, 'America/New_York').label).toBe('Due tomorrow');
  });
  it('control (Africa/Nairobi, no DST): same instants give plain calendar answers', () => {
    const sat2330 = new Date('2026-03-07T20:30:00Z'); // Sat 23:30 EAT
    expect(getDaysRemaining('2026-03-08', sat2330, 'Africa/Nairobi').label).toBe('Due tomorrow');
    expect(getDaysRemaining('2026-03-07', sat2330, 'Africa/Nairobi').label).toBe('Due today');
    const nov = new Date('2026-10-31T20:30:00Z');
    expect(getDaysRemaining('2026-11-01', nov, 'Africa/Nairobi').label).toBe('Due tomorrow');
  });
  it('reports overdue and ignores malformed input', () => {
    expect(getDaysRemaining('2026-11-01', new Date('2026-11-05T12:00:00Z'), 'Africa/Nairobi').label).toBe('4d overdue');
    expect(getDaysRemaining('not-a-date').label).toBe('Upcoming');
    expect(getDaysRemaining(undefined).label).toBe('Pending date');
  });
});
