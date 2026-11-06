import { describe, expect, it } from 'vitest';
import { clampMinutes, TIMER_LIMITS_MIN } from './timerEngine';

describe('clampMinutes', () => {
  it('keeps normal lengths and rounds to whole minutes', () => {
    expect(clampMinutes(25, TIMER_LIMITS_MIN.focus)).toBe(25);
    expect(clampMinutes(12.4, TIMER_LIMITS_MIN.focus)).toBe(12);
    expect(clampMinutes(12.6, TIMER_LIMITS_MIN.focus)).toBe(13);
  });
  it('holds out-of-range lengths at the limits', () => {
    expect(clampMinutes(0, 60)).toBe(1);
    expect(clampMinutes(-5, 60)).toBe(1);
    expect(clampMinutes(500, TIMER_LIMITS_MIN.focus)).toBe(180);
  });
  it('treats non-numbers as one minute', () => {
    expect(clampMinutes(Number.NaN, 60)).toBe(1);
    expect(clampMinutes(Number.POSITIVE_INFINITY, 60)).toBe(1);
  });
});
