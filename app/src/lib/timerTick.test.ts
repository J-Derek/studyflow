import { describe, expect, it } from 'vitest';
import { idleTimer, msUntilNextSecond, remainingSeconds, start } from './timerEngine';

/**
 * The clock shows whole seconds left (rounded up). The scheduler must refresh it just as that number changes, not on a fixed
 * one-second beat that ignores when Start was pressed: that beat let the clock sit on 25:00 for up to two seconds.
 */
describe('when the clock should next refresh', () => {
  const running = start(idleTimer('focus', 25 * 60), 10_000);

  it('right after Start, as the first second runs out', () => {
    const wait = msUntilNextSecond(running, 10_000);
    expect(wait).toBeGreaterThan(1000);
    expect(wait).toBeLessThanOrEqual(1050);
    expect(remainingSeconds(running, 10_000 + wait)).toBe(25 * 60 - 1);
  });

  it('part way through a second, only for what is left of it', () => {
    const wait = msUntilNextSecond(running, 10_400);
    expect(wait).toBeGreaterThan(600);
    expect(wait).toBeLessThanOrEqual(650);
    expect(remainingSeconds(running, 10_400 + wait)).toBe(25 * 60 - 1);
  });

  it('at every refresh, the shown number has just changed', () => {
    let now = 10_000;
    for (let i = 1; i <= 5; i++) {
      now += msUntilNextSecond(running, now);
      expect(remainingSeconds(running, now)).toBe(25 * 60 - i);
    }
  });

  it('a stopped timer just checks back once a second', () => {
    expect(msUntilNextSecond(idleTimer('focus', 1500), 10_000)).toBe(1000);
  });
});
