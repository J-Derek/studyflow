import { describe, expect, it } from 'vitest';
import { clampMinutes, focusSecondsToRecord, TIMER_LIMITS_MIN } from './timerEngine';

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

describe('focusSecondsToRecord', () => {
  it('records the full block when it ran without a pause', () => {
    expect(focusSecondsToRecord({ durationSec: 1500, elapsedBeforeMs: 0 })).toBe(1500);
  });
  it('records only the time since the last resume after a pause (that is all the account has seen running)', () => {
    expect(focusSecondsToRecord({ durationSec: 1500, elapsedBeforeMs: 900_000 })).toBe(600);
    expect(focusSecondsToRecord({ durationSec: 60, elapsedBeforeMs: 5_000 })).toBe(55);
  });
  it('never records less than 1 second or more than the block', () => {
    expect(focusSecondsToRecord({ durationSec: 60, elapsedBeforeMs: 60_000 })).toBe(1);
    expect(focusSecondsToRecord({ durationSec: 60, elapsedBeforeMs: -5 })).toBe(60);
  });
});
