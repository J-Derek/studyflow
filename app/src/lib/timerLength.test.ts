import { describe, expect, it } from 'vitest';
import { defaultMinutes, limitFor, resolveLength, savedMinutes, stepLength } from './timerLength';
import { DEFAULT_TIMER_SETTINGS } from '../utils/devicePrefs';
import { useStudyFlowStore } from '../store/studyFlowStore';

describe('timer length helpers', () => {
  it('knows the app defaults and limits for each mode', () => {
    expect(defaultMinutes('focus')).toBe(25);
    expect(defaultMinutes('shortBreak')).toBe(5);
    expect(defaultMinutes('longBreak')).toBe(15);
    expect(limitFor('focus')).toBe(180);
    expect(limitFor('shortBreak')).toBe(60);
    expect(limitFor('longBreak')).toBe(90);
  });

  it('reads the saved length of a mode in minutes', () => {
    expect(savedMinutes('focus', { ...DEFAULT_TIMER_SETTINGS, focusDuration: 20 * 60 })).toBe(20);
    expect(savedMinutes('shortBreak', DEFAULT_TIMER_SETTINGS)).toBe(5);
  });

  it('keeps a good value as typed, with no message', () => {
    expect(resolveLength('5', 'focus', 20)).toEqual({ minutes: 5, note: null });
  });

  it('clamps and says what will be saved', () => {
    expect(resolveLength('0', 'focus', 25)).toEqual({ minutes: 1, note: 'A focus can be 1 to 180 minutes, so 0 will be saved as 1.' });
    expect(resolveLength('500', 'shortBreak', 5)).toEqual({ minutes: 60, note: 'A short break can be 1 to 60 minutes, so 500 will be saved as 60.' });
    expect(resolveLength('12.6', 'longBreak', 15).minutes).toBe(13);
  });

  it('a blank box keeps the saved length and says so', () => {
    expect(resolveLength('  ', 'focus', 25)).toEqual({ minutes: 25, note: 'Empty, so it stays at 25 minutes.' });
    expect(resolveLength('', 'shortBreak', 1).note).toBe('Empty, so it stays at 1 minute.');
  });

  it('the stepper moves one minute and stops at the ends', () => {
    expect(stepLength('20', 'focus', 25, 1)).toBe('21');
    expect(stepLength('20', 'focus', 25, -1)).toBe('19');
    expect(stepLength('1', 'focus', 25, -1)).toBe('1');
    expect(stepLength('180', 'focus', 25, 1)).toBe('180');
    expect(stepLength('', 'focus', 25, 1)).toBe('26');
  });
});

describe('saving a length for the current mode', () => {
  it('saves only that mode, clamped, and an idle timer shows it at once', () => {
    const s = useStudyFlowStore;
    s.setState({ userId: null });
    s.getState().setTimerMode('focus');
    s.getState().updateTimerSettings({ focusDuration: 5 * 60 });
    expect(s.getState().timerSettings.focusDuration).toBe(300);
    expect(s.getState().timerSettings.shortBreakDuration).toBe(DEFAULT_TIMER_SETTINGS.shortBreakDuration);
    expect(s.getState().timer.durationSec).toBe(300);
    s.getState().updateTimerSettings({ focusDuration: 9999 * 60 });
    expect(s.getState().timerSettings.focusDuration).toBe(180 * 60);
  });

  it('Reset to default is the app default for that mode', () => {
    const s = useStudyFlowStore;
    s.getState().updateTimerSettings({ shortBreakDuration: defaultMinutes('shortBreak') * 60 });
    expect(s.getState().timerSettings.shortBreakDuration).toBe(DEFAULT_TIMER_SETTINGS.shortBreakDuration);
  });
});
