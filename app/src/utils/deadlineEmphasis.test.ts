import { describe, expect, it } from 'vitest';
import type { Assignment } from '../types';
import { dueSoonTone, needsAttention } from './deadlineEmphasis';

const asg = (over: Partial<Assignment>): Assignment => ({
  id: 'a', title: 'T', course: 'C', dueDate: '2026-11-20', priority: 'medium', status: 'pending', progress: 0, createdAt: 'z', ...over
});

describe('how close a deadline is, in words (never colour alone)', () => {
  const today = '2026-11-15';
  it('says overdue, today and tomorrow plainly', () => {
    expect(dueSoonTone('2026-11-10', today)).toMatchObject({ tone: 'overdue', label: 'Overdue' });
    expect(dueSoonTone('2026-11-15', today)).toMatchObject({ tone: 'today', label: 'Today' });
    expect(dueSoonTone('2026-11-16', today)).toMatchObject({ tone: 'tomorrow', label: 'Tomorrow' });
  });
  it('counts the days for the rest of the week, then gives the date', () => {
    expect(dueSoonTone('2026-11-18', today)).toMatchObject({ tone: 'later', label: 'In 3 days' });
    expect(dueSoonTone('2026-11-21', today)).toMatchObject({ tone: 'later', label: 'In 6 days' });
    expect(dueSoonTone('2026-11-25', today)).toMatchObject({ tone: 'later', label: '25 Nov' });
  });
  it('crosses month and year ends correctly', () => {
    expect(dueSoonTone('2027-01-01', '2026-12-31')).toMatchObject({ tone: 'tomorrow' });
    expect(dueSoonTone('2026-11-30', '2026-12-01')).toMatchObject({ tone: 'overdue' });
  });
  it('uses the kind badge colours, so each tone has a tested contrast', () => {
    const tones = ['2026-11-10', '2026-11-15', '2026-11-16', '2026-11-25'].map((d) => dueSoonTone(d, today).badge);
    expect(new Set(tones).size).toBe(4);
    for (const b of tones) expect(b).toMatch(/text-\w+-(800|900)/);
  });
});

describe('which days need attention in the month grid', () => {
  it('an unfinished exam, test or project, or any high-priority deadline', () => {
    expect(needsAttention([asg({ kind: 'exam' })])).toBe(true);
    expect(needsAttention([asg({ kind: 'test' })])).toBe(true);
    expect(needsAttention([asg({ kind: 'project' })])).toBe(true);
    expect(needsAttention([asg({ priority: 'high' })])).toBe(true);
  });
  it('not ordinary work, readings, or anything already done', () => {
    expect(needsAttention([])).toBe(false);
    expect(needsAttention([asg({}), asg({ kind: 'reading', priority: 'low' })])).toBe(false);
    expect(needsAttention([asg({ kind: 'exam', status: 'completed' }), asg({ priority: 'high', status: 'completed' })])).toBe(false);
  });
});
