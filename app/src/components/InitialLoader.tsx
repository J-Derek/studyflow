import React, { useEffect, useState } from 'react';
import { useStudyFlowStore } from '../store/studyFlowStore';

interface InitialLoaderProps {
  /** Total duration in milliseconds to display the splash screen before starting fade-out. Defaults to 1800ms. */
  durationMs?: number;
}

export const InitialLoader: React.FC<InitialLoaderProps> = ({ durationMs = 1800 }) => {
  const { theme } = useStudyFlowStore();
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // If running in automated tests (Playwright, Puppeteer), skip delay immediately
    const isAutomated = typeof navigator !== 'undefined' && (navigator.webdriver || window.location.search.includes('fast'));
    if (isAutomated) {
      setVisible(false);
      return;
    }

    // Animate progress smoothly
    const startTime = performance.now();
    const frame = () => {
      const elapsed = performance.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(pct);
      if (elapsed < durationMs) {
        requestAnimationFrame(frame);
      }
    };
    const animId = requestAnimationFrame(frame);

    // Trigger fade-out
    const fadeTimer = window.setTimeout(() => {
      setFading(true);
    }, durationMs);

    // Completely unmount after fade-out transition (400ms)
    const exitTimer = window.setTimeout(() => {
      setVisible(false);
    }, durationMs + 420);

    return () => {
      cancelAnimationFrame(animId);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(exitTimer);
    };
  }, [durationMs]);

  if (!visible) return null;

  const isDark = theme === 'dark';

  return (
    <div
      role="status"
      aria-label="Loading StudyFlow workspace"
      aria-live="polite"
      onClick={() => {
        setFading(true);
        setTimeout(() => setVisible(false), 200);
      }}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center cursor-pointer transition-all duration-400 ease-out select-none ${
        fading ? 'opacity-0 scale-102 pointer-events-none' : 'opacity-100 scale-100'
      } ${isDark ? 'bg-[#0D0F14]' : 'bg-[#FAF7F2]'}`}
    >
      <div className="flex flex-col items-center max-w-sm px-6 text-center animate-sf-splash">
        {/* Logo Image */}
        <div className="relative mb-6">
          <img
            src={isDark ? '/logo/logo-dark.webp' : '/logo/logo-transparent.webp'}
            alt="StudyFlow"
            className="w-72 sm:w-84 h-auto drop-shadow-sm transition-transform duration-700 hover:scale-[1.02]"
            draggable={false}
          />
        </div>

        {/* Hairline Progress Track */}
        <div className="w-48 h-1 rounded-full bg-zinc-300/40 dark:bg-zinc-800 overflow-hidden relative mb-3">
          <div
            className="h-full rounded-full transition-all duration-100 ease-out"
            style={{
              width: `${progress}%`,
              background: isDark
                ? 'linear-gradient(90deg, #C19B45 0%, #E6C875 100%)'
                : 'linear-gradient(90deg, #1A2A4A 0%, #C19B45 100%)'
            }}
          />
        </div>

        {/* Academic status hint */}
        <p className="text-[10px] uppercase font-mono tracking-[0.25em] text-zinc-500 dark:text-zinc-400 transition-opacity">
          {progress < 70 ? 'Preparing workspace…' : 'Ready'}
        </p>
      </div>
    </div>
  );
};

