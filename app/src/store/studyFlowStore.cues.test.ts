import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudyFlowStore } from './studyFlowStore';

// Audio is not available here; the cue functions catch that themselves.
vi.spyOn(console, 'warn').mockImplementation(() => undefined);

const running = (mode: 'focus' | 'shortBreak' | 'longBreak', durationSec: number) => ({
  mode,
  status: 'running' as const,
  durationSec,
  startedAtMs: Date.now() - durationSec * 1000 - 1000,
  elapsedBeforeMs: 0
});

describe('a block that ends hands over to the next one with its cue', () => {
  beforeEach(() => {
    useStudyFlowStore.setState({
      userId: null,
      pomodorosCompleted: 0,
      lastCue: null,
      timerSettings: { focusDuration: 25 * 60, shortBreakDuration: 5 * 60, longBreakDuration: 15 * 60, autoStartBreaks: false, autoStartFocus: false }
    });
  });

  it('focus ends: a short break is ready, with the relief words and the real break length', () => {
    useStudyFlowStore.setState({ timer: running('focus', 25 * 60) });
    useStudyFlowStore.getState().completeTimer();
    const s = useStudyFlowStore.getState();
    expect(s.timer.mode).toBe('shortBreak');
    expect(s.timer.status).toBe('idle');
    expect(s.timer.durationSec).toBe(300);
    expect(s.pomodorosCompleted).toBe(1);
    expect(s.lastCue?.kind).toBe('relief');
    expect(s.lastCue?.message).toBe('Good work. Take 5.');
  });

  it('the fourth focus block is followed by the long break, and the words say its length', () => {
    useStudyFlowStore.setState({ pomodorosCompleted: 3, timer: running('focus', 25 * 60) });
    useStudyFlowStore.getState().completeTimer();
    const s = useStudyFlowStore.getState();
    expect(s.timer.mode).toBe('longBreak');
    expect(s.lastCue?.message).toBe('Good work. Take 15.');
  });

  it('a break ends: focus is ready, with the nudge words, and no focus block is counted', () => {
    useStudyFlowStore.setState({ pomodorosCompleted: 1, timer: running('shortBreak', 5 * 60) });
    useStudyFlowStore.getState().completeTimer();
    const s = useStudyFlowStore.getState();
    expect(s.timer.mode).toBe('focus');
    expect(s.timer.status).toBe('idle');
    expect(s.timer.durationSec).toBe(25 * 60);
    expect(s.pomodorosCompleted).toBe(1);
    expect(s.lastCue?.kind).toBe('nudge');
    expect(s.lastCue?.message).toBe("Break's over. Back to it.");
  });

  it('the words go away when the student starts, resets or switches', () => {
    useStudyFlowStore.setState({ timer: running('focus', 25 * 60) });
    useStudyFlowStore.getState().completeTimer();
    expect(useStudyFlowStore.getState().lastCue).not.toBeNull();
    useStudyFlowStore.getState().startTimer();
    expect(useStudyFlowStore.getState().lastCue).toBeNull();
  });
});
