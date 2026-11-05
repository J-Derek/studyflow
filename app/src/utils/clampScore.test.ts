import { describe, expect, it } from 'vitest';
import { clampScore } from './academicCalculations';

describe('clampScore', () => {
  it('keeps real percentages', () => {
    expect(clampScore(0)).toBe(0);
    expect(clampScore(82.5)).toBe(82.5);
    expect(clampScore(100)).toBe(100);
  });
  it('holds out-of-range scores at the limits', () => {
    expect(clampScore(-50)).toBe(0);
    expect(clampScore(250)).toBe(100);
  });
  it('treats empty and non-numbers as no score', () => {
    expect(clampScore(undefined)).toBeUndefined();
    expect(clampScore(Number.NaN)).toBeUndefined();
    expect(clampScore(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});
