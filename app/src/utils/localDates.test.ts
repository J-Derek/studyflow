import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { newPeriodId } from './periods';
import { downloadBackup } from './exportBackup';
import { localDateISO } from './limits';

// Nairobi is UTC+3: between 00:00 and 03:00 local time, the UTC date is still yesterday. That is the window these tests sit in.
const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Africa/Nairobi';
});
afterEach(() => {
  vi.useRealTimers();
});

const nairobiOneThirty = () => new Date('2026-11-19T22:30:00Z'); // 01:30 on 20 November in Nairobi

describe('dates use the student\'s own day, not UTC', () => {
  it('runs in Nairobi time', () => {
    expect(new Date('2026-11-19T22:30:00Z').getDate()).toBe(20);
  });

  it('localDateISO gives the Nairobi day at 01:30', () => {
    expect(localDateISO(nairobiOneThirty())).toBe('2026-11-20');
  });

  it('a new period id carries the local date', () => {
    expect(newPeriodId(nairobiOneThirty(), () => 'abcd')).toBe('p-2026-11-20-abcd');
  });

  it('the backup file is named for the local date', () => {
    const link = { href: '', download: '', click: () => undefined };
    vi.stubGlobal('document', { createElement: () => link });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined });
    downloadBackup({}, nairobiOneThirty());
    expect(link.download).toBe('studyflow-data-2026-11-20.json');
    vi.unstubAllGlobals();
    process.env.TZ = originalTz;
  });
});
