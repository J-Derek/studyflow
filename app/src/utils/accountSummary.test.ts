import { describe, expect, it } from 'vitest';
import { accountSyncLine, countLabel, planSummary } from './accountSummary';

describe('accountSyncLine', () => {
  it('says plainly whether work is safe', () => {
    expect(accountSyncLine('saved', 0)).toEqual({ label: 'Saved to your account', tone: 'ok' });
    expect(accountSyncLine('saving', 0).tone).toBe('busy');
    expect(accountSyncLine('offline', 0).label).toContain('Offline');
    expect(accountSyncLine('device', 0).tone).toBe('busy');
    expect(accountSyncLine('error', 1).label).toBe('1 change was not saved to your account (still on this device)');
    expect(accountSyncLine('error', 3).label).toBe('3 changes were not saved to your account (still on this device)');
  });
});

describe('plan summary', () => {
  it('counts in plain words', () => {
    expect(countLabel(0, 'note', 'notes')).toBe('no notes');
    expect(countLabel(1, 'note', 'notes')).toBe('1 note');
    expect(countLabel(4, 'note', 'notes')).toBe('4 notes');
    expect(planSummary({ assignments: 2, sessions: 1, grades: 0, notes: 5 })).toEqual([
      '2 assignments',
      '1 class in the timetable',
      'no courses with grades',
      '5 notes'
    ]);
  });
});
