import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Flame,
  CheckCircle,
  Volume2,
  VolumeX,
  CloudRain,
  Waves,
  Wind,
  Bell,
  Music,
  Music2,
  Moon,
  Headphones
} from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { formatTimeLeft } from '../utils/formatters';
import { clampMinutes, remainingSeconds, TIMER_LIMITS_MIN } from '../lib/timerEngine';
import type { SoundscapeType } from '../types';
import confetti from 'canvas-confetti';

/** One length in whole minutes. Saved when the student leaves the box or presses Enter. */
const LengthField: React.FC<{ id: string; label: string; minutes: number; max: number; onCommit: (minutes: number) => void }> = ({ id, label, minutes, max, onCommit }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
      {label}
    </label>
    <div className="flex items-center gap-1.5">
      <input
        key={minutes}
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        defaultValue={minutes}
        onBlur={(e) => {
          const next = clampMinutes(Number(e.currentTarget.value), max);
          e.currentTarget.value = String(next);
          if (next !== minutes) onCommit(next);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="w-full min-h-[44px] px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-surface-light dark:bg-zinc-900 text-sm tabular-nums text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <span className="text-xs text-zinc-600 dark:text-zinc-400">min</span>
    </div>
  </div>
);

export const FocusTimerPage: React.FC = () => {
  const {
    timer,
    nowMs,
    focusCompletedAtMs,
    pomodorosCompleted,
    timerSettings,
    updateTimerSettings,
    soundscape,
    breakSoundscape,
    soundscapeVolume,
    setTimerMode,
    startTimer,
    pauseTimer,
    resetTimer,
    setSoundscape,
    setSoundscapeVolume
  } = useStudyFlowStore();

  const timerMode = timer.mode;
  // Which sound is being chosen: the one for focus blocks or the one for breaks.
  const [pickedTarget, setPickedTarget] = useState<'focus' | 'break' | null>(null);
  const soundTarget: 'focus' | 'break' = pickedTarget ?? (timer.mode === 'focus' ? 'focus' : 'break');
  const chosenSound = soundTarget === 'focus' ? soundscape : breakSoundscape;
  const soundIsPlayingNow = timer.status === 'running' && (timer.mode === 'focus') === (soundTarget === 'focus');
  const timerIsRunning = timer.status === 'running';
  const timerSecondsLeft = remainingSeconds(timer, nowMs);

  // Screen Wake Lock API — keeps display awake during active deep work and recovers on tab focus
  useEffect(() => {
    let wakeLockSentinel: any = null;

    const acquireLock = async () => {
      if (timerIsRunning && 'wakeLock' in navigator && !wakeLockSentinel) {
        try {
          wakeLockSentinel = await navigator.wakeLock.request('screen');
          wakeLockSentinel.addEventListener('release', () => {
            wakeLockSentinel = null;
          });
        } catch {}
      }
    };

    acquireLock();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && timerIsRunning) {
        acquireLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
        wakeLockSentinel = null;
      }
    };
  }, [timerIsRunning]);

  // Media Session API — surfaces focus session timer to OS lock screen & media centers
  useEffect(() => {
    if ('mediaSession' in navigator && window.MediaMetadata) {
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: timerMode === 'focus' ? 'Focus session' : 'Break',
          artist: 'StudyFlow',
          album: `${formatTimeLeft(timerSecondsLeft)} remaining`
        });
        navigator.mediaSession.playbackState = timerIsRunning ? 'playing' : 'paused';
      } catch {
        // ignore
      }
    }
  }, [timerIsRunning, timerMode, timerSecondsLeft]);


  // Screen readers hear changes of state and each remaining minute, not every tick.
  const minutesLeft = Math.ceil(timerSecondsLeft / 60);
  const modeLabel = timerMode === 'focus' ? 'Focus' : timerMode === 'shortBreak' ? 'Short break' : 'Long break';
  const announcement =
    timer.status === 'running'
      ? `${modeLabel} running, ${minutesLeft} ${minutesLeft === 1 ? 'minute' : 'minutes'} left`
      : timer.status === 'paused'
      ? `${modeLabel} paused, ${minutesLeft} ${minutesLeft === 1 ? 'minute' : 'minutes'} left`
      : `${modeLabel} ready, ${Math.round(timer.durationSec / 60)} minutes`;

  // Calculate duration and progress ratio
  const totalDuration = timer.durationSec;

  const progressPercent = Math.max(0, Math.min(100, ((totalDuration - timerSecondsLeft) / totalDuration) * 100));

  // Celebrate once per finished focus block (the store sets the time; the chime plays there).
  useEffect(() => {
    if (focusCompletedAtMs && Date.now() - focusCompletedAtMs < 5000) {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 }, disableForReducedMotion: true });
    }
  }, [focusCompletedAtMs]);

  // SVG Circular parameters
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  const icon = (el: React.ReactNode) => el;
  const sounds: Record<SoundscapeType, { label: string; hint: string; icon: React.ReactNode }> = {
    off: { label: 'Off', hint: 'Silence', icon: icon(<VolumeX className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />) },
    rain: { label: 'Soft rain', hint: 'Gentle drops', icon: icon(<CloudRain className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />) },
    waves: { label: 'Ocean waves', hint: 'Slow and steady', icon: icon(<Waves className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />) },
    pad: { label: 'Calm music', hint: 'Warm, slow chords', icon: icon(<Music className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />) },
    keys: { label: 'Soft keys', hint: 'Quiet piano notes', icon: icon(<Music2 className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />) },
    brown: { label: 'Warm hum', hint: 'Low, smooth noise', icon: icon(<Moon className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />) },
    breeze: { label: 'Light breeze', hint: 'Airy and quiet', icon: icon(<Wind className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />) },
    chimes: { label: 'Soft chimes', hint: 'Far-off bells', icon: icon(<Bell className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />) }
  };
  const focusChoices: SoundscapeType[] = ['off', 'rain', 'waves', 'pad', 'keys', 'brown'];
  const breakChoices: SoundscapeType[] = ['off', 'breeze', 'chimes', 'pad', 'waves', 'rain'];
  const soundscapesList = (soundTarget === 'focus' ? focusChoices : breakChoices).map((id) => ({ id, ...sounds[id] }));

  return (
    <div className="space-y-6 animate-fade-in pb-16 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-3xl md:text-4xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
          Focus timer
        </h1>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 font-sans">
          Work in timed blocks, then take a break.
        </p>
      </div>

      <div role="status" aria-live="polite" className="sr-only">{announcement}</div>

      {/* Mode Selector Tabs */}
      <div className="flex justify-center">
        <div className="inline-flex p-1 rounded-lg bg-surface-light dark:bg-surface-dark border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs">
          <button
            onClick={() => setTimerMode('focus')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              timerMode === 'focus'
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            Focus ({Math.round(timerSettings.focusDuration / 60)}m)
          </button>
          <button
            onClick={() => setTimerMode('shortBreak')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              timerMode === 'shortBreak'
                ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            Short Break ({Math.round(timerSettings.shortBreakDuration / 60)}m)
          </button>
          <button
            onClick={() => setTimerMode('longBreak')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              timerMode === 'longBreak'
                ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            Long Break ({Math.round(timerSettings.longBreakDuration / 60)}m)
          </button>
        </div>
      </div>

      {/* Timer lengths */}
      <details className="mx-auto w-full max-w-md rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark">
        <summary className="cursor-pointer select-none px-4 min-h-[44px] flex items-center text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Change timer lengths
        </summary>
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <LengthField id="len-focus" label="Focus" minutes={Math.round(timerSettings.focusDuration / 60)} max={TIMER_LIMITS_MIN.focus} onCommit={(m) => updateTimerSettings({ focusDuration: m * 60 })} />
            <LengthField id="len-short" label="Short break" minutes={Math.round(timerSettings.shortBreakDuration / 60)} max={TIMER_LIMITS_MIN.shortBreak} onCommit={(m) => updateTimerSettings({ shortBreakDuration: m * 60 })} />
            <LengthField id="len-long" label="Long break" minutes={Math.round(timerSettings.longBreakDuration / 60)} max={TIMER_LIMITS_MIN.longBreak} onCommit={(m) => updateTimerSettings({ longBreakDuration: m * 60 })} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Takes effect now if the timer is not running, otherwise from the next block.</p>
            <button
              type="button"
              onClick={() => updateTimerSettings({ focusDuration: 25 * 60, shortBreakDuration: 5 * 60, longBreakDuration: 15 * 60 })}
              className="min-h-[44px] px-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Back to 25 / 5 / 15
            </button>
          </div>
        </div>
      </details>

      {/* Circular Laboratory Gauge Display */}
      <div className="bg-surface-light dark:bg-surface-dark p-8 md:p-10 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs flex flex-col items-center justify-center relative overflow-hidden transition-colors">
        <div className="relative w-60 h-60 md:w-68 md:h-68 flex items-center justify-center">
          {/* Base SVG Ring */}
          <svg className="w-full h-full transform -rotate-90" aria-hidden="true">
            <circle
              cx="50%"
              cy="50%"
              r={radius}
              className="text-zinc-100 dark:text-zinc-850"
              strokeWidth="4"
              stroke="currentColor"
              fill="transparent"
            />
            {/* Dynamic Progress Circle */}
            <circle
              cx="50%"
              cy="50%"
              r={radius}
              className={`transition-[stroke-dashoffset] duration-500 ${
                timerMode === 'focus'
                  ? 'text-blue-600 dark:text-blue-500'
                  : timerMode === 'shortBreak'
                  ? 'text-emerald-500'
                  : 'text-blue-400'
              }`}
              strokeWidth="5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
            />
          </svg>

          {/* Inner Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-display text-5xl md:text-6xl font-medium text-zinc-900 dark:text-zinc-50 tracking-tight tabular-nums ">
              <span role="timer" aria-live="off" aria-label={`${timerMode === 'focus' ? 'Focus' : 'Break'} timer`}>{formatTimeLeft(timerSecondsLeft)}</span>
            </span>
            <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400 mt-2">
              {timerMode === 'focus' ? 'Focus' : 'Break'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-7 flex items-center justify-center gap-3">
          <button
            onClick={resetTimer}
            className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition active:scale-95"
            title="Reset Timer"
            aria-label="Reset Timer"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          {timerIsRunning ? (
            <button
              onClick={pauseTimer}
              className="px-6 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium text-xs hover:bg-zinc-800 dark:hover:bg-white/90 transition shadow-2xs flex items-center gap-2 active:scale-95"
            >
              <Pause className="h-3.5 w-3.5" /> Pause Session
            </button>
          ) : (
            <button
              onClick={startTimer}
              className="px-6 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white/90 text-white dark:text-zinc-900 font-medium text-sm transition flex items-center gap-2 active:scale-95"
            >
              <Play className="h-3.5 w-3.5 fill-current" /> Start
            </button>
          )}

          <button
            onClick={() => {
              confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 },
                disableForReducedMotion: true
              });
            }}
            className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition active:scale-95"
            title="Test Milestone Celebration"
            aria-label="Test milestone celebration"
          >
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </button>
        </div>

        {/* Tab-inactive Accuracy Badge */}
        
      </div>

      {/* AMBIENT SOUNDSCAPES DEEP WORK AUDIO (Web Audio Synthesizer) */}
      <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs space-y-3.5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              <Headphones className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Background sound</span>
                {chosenSound !== 'off' && soundIsPlayingNow && (
                  <span className="flex items-center gap-0.5 text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                    Playing
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Optional. Plays softly while the timer runs. Choose one sound for focusing and another for breaks.
              </p>
            </div>
          </div>

          {/* Volume slider */}
          {chosenSound !== 'off' && (
            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <Volume2 className="h-3 w-3 text-zinc-600 dark:text-zinc-400" />
              <input
                type="range"
                aria-label="Sound volume"
                min="0.05"
                max="0.8"
                step="0.05"
                value={soundscapeVolume}
                onChange={(e) => setSoundscapeVolume(Number(e.target.value))}
                className="w-20 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="tabular-nums text-xs text-zinc-600 dark:text-zinc-400 w-6">
                {Math.round(soundscapeVolume * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Which timer mode the sound is for */}
        <div role="group" aria-label="Choose sound for" className="inline-flex p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80">
          {(['focus', 'break'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={soundTarget === t}
              onClick={() => setPickedTarget(t)}
              className={`px-3 min-h-[36px] rounded-md text-xs font-medium cursor-pointer transition-colors ${
                soundTarget === t ? 'bg-surface-light dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs' : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {t === 'focus' ? 'When I focus' : 'On breaks'}
            </button>
          ))}
        </div>

        {/* Soundscape Options Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {soundscapesList.map((item) => (
            <button
              key={item.id}
              onClick={() => setSoundscape(item.id, soundTarget)}
              aria-pressed={chosenSound === item.id}
              className={`p-2.5 rounded-lg border text-left transition-colors flex flex-col justify-between ${
                chosenSound === item.id
                  ? 'border-blue-500/80 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 shadow-2xs'
                  : 'border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <div className="p-1 rounded w-fit bg-surface-light dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50 mb-1.5">
                {item.icon}
              </div>
              <div>
                <p className="text-xs font-medium leading-tight">{item.label}</p>
                <p className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400 mt-0.5">
                  {chosenSound === item.id ? (soundIsPlayingNow ? 'Playing' : 'Selected') : item.hint}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Focus Session Counter & Milestones */}
      <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs flex items-center justify-between transition-colors">
        <div>
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100 text-xs">Focus sessions completed</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 font-sans">
            Counted on this device
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`h-6 w-6 rounded-md flex items-center justify-center tabular-nums text-xs ${
                i < pomodorosCompleted % 4 || pomodorosCompleted >= 4
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <Flame className="h-3 w-3" />
            </div>
          ))}
          <span className="text-xs tabular-nums font-semibold text-zinc-900 dark:text-zinc-100 ml-1.5">
            {pomodorosCompleted} total
          </span>
        </div>
      </div>
    </div>
  );
};
