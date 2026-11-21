import { describe, expect, it, vi } from 'vitest';
import { cueFor, cueMessage, nextModeAfter, performCue, vibrationFor, type CueDeps } from './timerCues';

const deps = (): CueDeps => ({ playRelief: vi.fn(), playNudge: vi.fn(), vibrate: vi.fn(), notify: vi.fn() });

describe('which cue fires on which transition', () => {
  it('relief when focus ends, a nudge when either break ends', () => {
    expect(cueFor('focus')).toBe('relief');
    expect(cueFor('shortBreak')).toBe('nudge');
    expect(cueFor('longBreak')).toBe('nudge');
  });

  it('a short break follows focus, a long one after every fourth, and focus follows any break', () => {
    expect(nextModeAfter('focus', 1)).toBe('shortBreak');
    expect(nextModeAfter('focus', 3)).toBe('shortBreak');
    expect(nextModeAfter('focus', 4)).toBe('longBreak');
    expect(nextModeAfter('focus', 8)).toBe('longBreak');
    expect(nextModeAfter('shortBreak', 4)).toBe('focus');
    expect(nextModeAfter('longBreak', 4)).toBe('focus');
  });

  it('uses the actual break length in the words, and the same words for the notification', () => {
    expect(cueMessage('relief', 5)).toBe('Good work. Take 5.');
    expect(cueMessage('relief', 15)).toBe('Good work. Take 15.');
    expect(cueMessage('nudge', 25)).toBe("Break's over. Back to it.");
  });

  it('vibrates once and long for relief, twice and short for the nudge', () => {
    expect(vibrationFor('relief')).toEqual([600]);
    expect(vibrationFor('nudge')).toEqual([80, 110, 80]);
  });
});

describe('performCue', () => {
  it('plays only the chime for relief, only the knock for the nudge', () => {
    const a = deps();
    performCue('relief', 'Good work. Take 5.', false, a);
    expect(a.playRelief).toHaveBeenCalledTimes(1);
    expect(a.playNudge).not.toHaveBeenCalled();
    const b = deps();
    performCue('nudge', "Break's over. Back to it.", false, b);
    expect(b.playNudge).toHaveBeenCalledTimes(1);
    expect(b.playRelief).not.toHaveBeenCalled();
  });

  it('mute silences both sounds, but the words and the vibration still come', () => {
    for (const [kind, msg] of [['relief', 'Good work. Take 5.'], ['nudge', "Break's over. Back to it."]] as const) {
      const d = deps();
      performCue(kind, msg, true, d);
      expect(d.playRelief).not.toHaveBeenCalled();
      expect(d.playNudge).not.toHaveBeenCalled();
      expect(d.vibrate).toHaveBeenCalledWith(vibrationFor(kind));
      expect(d.notify).toHaveBeenCalledWith(msg);
    }
  });

  it('sends the same words to the notification as to the screen', () => {
    const d = deps();
    performCue('relief', cueMessage('relief', 5), false, d);
    expect(d.notify).toHaveBeenCalledWith('Good work. Take 5.');
  });

  it('carries on when a part is not available on the device', () => {
    const d: CueDeps = {
      playRelief: () => {
        throw new Error('no audio');
      },
      playNudge: vi.fn(),
      vibrate: () => {
        throw new Error('no vibration');
      },
      notify: vi.fn()
    };
    expect(() => performCue('relief', 'Good work. Take 5.', false, d)).not.toThrow();
    expect(d.notify).toHaveBeenCalled();
  });
});
