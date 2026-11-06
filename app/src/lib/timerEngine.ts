import type { TimerMode } from '../types';

/**
 * Timer state is timestamps and durations only. Remaining time is always derived from the clock,
 * never stored as a number that ticks down, so a throttled tab, a refresh or a sleeping laptop
 * cannot make it drift.
 */
export interface TimerState {
  mode: TimerMode;
  status: 'idle' | 'running' | 'paused';
  /** Full length of this block in seconds. */
  durationSec: number;
  /** Wall-clock ms when the current run segment began. Only meaningful while running. */
  startedAtMs: number | null;
  /** Milliseconds already used before the current segment (from earlier run segments). */
  elapsedBeforeMs: number;
}

export function idleTimer(mode: TimerMode, durationSec: number): TimerState {
  return { mode, status: 'idle', durationSec, startedAtMs: null, elapsedBeforeMs: 0 };
}

/** Milliseconds used so far. A clock that moved backwards counts the current segment as zero. */
export function elapsedMs(t: TimerState, now: number): number {
  const segment = t.status === 'running' && t.startedAtMs !== null ? Math.max(0, now - t.startedAtMs) : 0;
  return Math.min(t.durationSec * 1000, t.elapsedBeforeMs + segment);
}

export function remainingMs(t: TimerState, now: number): number {
  return Math.max(0, t.durationSec * 1000 - elapsedMs(t, now));
}

/** Whole seconds left, rounded up so the display shows 0:01 until the very end. */
export function remainingSeconds(t: TimerState, now: number): number {
  return Math.ceil(remainingMs(t, now) / 1000);
}

export function isFinished(t: TimerState, now: number): boolean {
  return t.status === 'running' && remainingMs(t, now) <= 0;
}

export function start(t: TimerState, now: number): TimerState {
  if (t.status === 'running') return t;
  // Starting after a finished block begins a fresh one.
  const fresh = t.elapsedBeforeMs >= t.durationSec * 1000 ? 0 : t.elapsedBeforeMs;
  return { ...t, status: 'running', startedAtMs: now, elapsedBeforeMs: fresh };
}

export function pause(t: TimerState, now: number): TimerState {
  if (t.status !== 'running') return t;
  return { ...t, status: 'paused', startedAtMs: null, elapsedBeforeMs: elapsedMs(t, now) };
}

export function reset(t: TimerState): TimerState {
  return idleTimer(t.mode, t.durationSec);
}

export function switchMode(mode: TimerMode, durationSec: number): TimerState {
  return idleTimer(mode, durationSec);
}

/** A block that ran to the end. Returns an idle timer for the same mode. */
export function complete(t: TimerState): TimerState {
  return idleTimer(t.mode, t.durationSec);
}

/** State for a timer that another device started or paused, from the cloud document. */
export function fromCloud(doc: {
  mode: TimerMode;
  status: 'idle' | 'running' | 'paused';
  durationSeconds: number;
  startedAtMs?: number | null;
  remainingSeconds?: number | null;
}): TimerState {
  const durationSec = doc.durationSeconds;
  if (doc.status === 'running' && typeof doc.startedAtMs === 'number') {
    return { mode: doc.mode, status: 'running', durationSec, startedAtMs: doc.startedAtMs, elapsedBeforeMs: 0 };
  }
  if (doc.status === 'paused' && typeof doc.remainingSeconds === 'number') {
    return {
      mode: doc.mode,
      status: 'paused',
      durationSec,
      startedAtMs: null,
      elapsedBeforeMs: Math.max(0, (durationSec - doc.remainingSeconds) * 1000)
    };
  }
  return idleTimer(doc.mode, durationSec);
}

/**
 * True when two timers describe the same run. The cloud stamps `startedAt` with server time, which
 * is a little later than the moment the student pressed start (network delay, or longer if they were
 * offline), so start times only need to agree within a tolerance.
 */
export function sameRun(a: TimerState, b: TimerState, toleranceMs = 15_000): boolean {
  if (a.mode !== b.mode || a.status !== b.status || a.durationSec !== b.durationSec) return false;
  if (a.status === 'running') return Math.abs((a.startedAtMs ?? 0) - (b.startedAtMs ?? 0)) <= toleranceMs;
  if (a.status === 'paused') return Math.abs(a.elapsedBeforeMs - b.elapsedBeforeMs) <= 2000;
  return true;
}

/** Longest length a student can choose, in minutes. */
export const TIMER_LIMITS_MIN = { focus: 180, shortBreak: 60, longBreak: 90 } as const;

/** Whole minutes between 1 and `max`; anything that is not a number becomes 1. */
export function clampMinutes(value: number, max: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(max, Math.max(1, Math.round(value)));
}
