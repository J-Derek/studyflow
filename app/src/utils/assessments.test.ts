import { describe, expect, it } from 'vitest';
import { clampWeight, MAX_ASSESSMENTS, normalizeAssessments, totalWeight } from './assessments';

describe('clampWeight', () => {
  it('keeps real weights to one decimal place', () => {
    expect(clampWeight(15)).toBe(15);
    expect(clampWeight(12.34)).toBe(12.3);
  });
  it('holds weights between 0 and 100', () => {
    expect(clampWeight(-5)).toBe(0);
    expect(clampWeight(250)).toBe(100);
    expect(clampWeight(Number.NaN)).toBe(0);
  });
});

describe('normalizeAssessments', () => {
  it('trims names, limits their length, and names blank ones', () => {
    const out = normalizeAssessments([
      { id: 'a', name: '  CAT 1  ', weight: 15 },
      { id: 'b', name: '   ', weight: 15 },
      { id: 'c', name: 'x'.repeat(200), weight: 30 }
    ]);
    expect(out[0]!.name).toBe('CAT 1');
    expect(out[1]!.name).toBe('Assessment');
    expect(out[2]!.name).toHaveLength(60);
  });
  it('keeps scores in range and leaves ungraded ones empty', () => {
    const out = normalizeAssessments([
      { id: 'a', name: 'A', weight: 50, score: 250 },
      { id: 'b', name: 'B', weight: 50 }
    ]);
    expect(out[0]!.score).toBe(100);
    expect('score' in out[1]!).toBe(false);
  });
  it('caps how many assessments a course can have', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: String(i), name: 'n', weight: 1 }));
    expect(normalizeAssessments(many)).toHaveLength(MAX_ASSESSMENTS);
  });
});

describe('totalWeight', () => {
  it('adds weights without floating-point noise', () => {
    expect(totalWeight([{ id: '1', name: 'a', weight: 15 }, { id: '2', name: 'b', weight: 15 }, { id: '3', name: 'c', weight: 30 }, { id: '4', name: 'd', weight: 40 }])).toBe(100);
    expect(totalWeight([{ id: '1', name: 'a', weight: 0.1 }, { id: '2', name: 'b', weight: 0.2 }])).toBe(0.3);
  });
});
