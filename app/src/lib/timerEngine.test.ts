import { describe, expect, it } from 'vitest';
import {
  complete,
  fromCloud,
  idleTimer,
  isFinished,
  pause,
  remainingMs,
  remainingSeconds,
  reset,
  sameRun,
  start
} from './timerEngine';

const T0 = 1_700_000_000_000;
const base = idleTimer('focus', 1500);

describe('timer engine', () => {
  it('derives remaining time from timestamps, not from ticks', () => {
    const running = start(base, T0);
    expect(remainingSeconds(running, T0)).toBe(1500);
    expect(remainingSeconds(running, T0 + 60_000)).toBe(1440);
    // one huge gap (laptop asleep) is simply more elapsed time, with no tick needed
    expect(remainingSeconds(running, T0 + 10 * 60_000)).toBe(900);
  });

  it('does not drift if nothing ever calls tick: the same instant always gives the same answer', () => {
    const running = start(base, T0);
    const a = remainingMs(running, T0 + 123_456);
    const b = remainingMs(running, T0 + 123_456);
    expect(a).toBe(b);
  });

  it('pauses without losing time and resumes from where it stopped', () => {
    let t = start(base, T0);
    t = pause(t, T0 + 100_000);
    expect(t.status).toBe('paused');
    expect(remainingSeconds(t, T0 + 9_999_999)).toBe(1400); // paused: the clock no longer matters
    t = start(t, T0 + 500_000);
    expect(remainingSeconds(t, T0 + 500_000)).toBe(1400);
    expect(remainingSeconds(t, T0 + 560_000)).toBe(1340);
  });

  it('finishes exactly once the full duration has elapsed', () => {
    const running = start(base, T0);
    expect(isFinished(running, T0 + 1_499_999)).toBe(false);
    expect(isFinished(running, T0 + 1_500_000)).toBe(true);
    expect(remainingMs(running, T0 + 99_999_999)).toBe(0);
  });

  it('survives a clock that moves backwards (counts the segment as zero, never negative)', () => {
    const running = start(base, T0);
    expect(remainingSeconds(running, T0 - 3_600_000)).toBe(1500);
  });

  it('reset returns to a full idle block; complete returns an idle block for the same mode', () => {
    const t = pause(start(base, T0), T0 + 5_000);
    expect(reset(t)).toEqual(base);
    expect(complete(start(base, T0))).toEqual(base);
  });

  it('starting again after a finished block begins a fresh one', () => {
    const finished = { ...base, status: 'paused' as const, elapsedBeforeMs: 1_500_000 };
    const again = start(finished, T0);
    expect(remainingSeconds(again, T0)).toBe(1500);
  });

  it('start on a running timer is a no-op (no double start)', () => {
    const running = start(base, T0);
    expect(start(running, T0 + 50_000)).toBe(running);
  });

  it('adopts a running timer from another device using its start time', () => {
    const t = fromCloud({ mode: 'focus', status: 'running', durationSeconds: 1500, startedAtMs: T0 });
    expect(remainingSeconds(t, T0 + 300_000)).toBe(1200);
  });

  it('adopts a paused timer from another device', () => {
    const t = fromCloud({ mode: 'shortBreak', status: 'paused', durationSeconds: 300, remainingSeconds: 120 });
    expect(t.status).toBe('paused');
    expect(remainingSeconds(t, T0)).toBe(120);
  });

  it('treats a malformed cloud document as idle', () => {
    const t = fromCloud({ mode: 'focus', status: 'running', durationSeconds: 1500 });
    expect(t.status).toBe('idle');
  });

  it('sameRun tolerates the cloud start time being a little later, but not another run', () => {
    const local = start(base, T0);
    expect(sameRun(local, start(base, T0 + 800))).toBe(true);
    expect(sameRun(local, start(base, T0 + 60_000))).toBe(false);
    expect(sameRun(local, pause(local, T0 + 1000))).toBe(false);
    expect(sameRun(local, start(idleTimer('shortBreak', 300), T0))).toBe(false);
  });
});
