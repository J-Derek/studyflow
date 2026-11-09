import React, { useEffect, useRef, useState } from 'react';
import { PartyPopper } from 'lucide-react';

const EVENT = 'studyflow:celebrate';

/** Call when the student has just finished something. The little celebration shows, and screen readers hear it too. */
export function celebrate(title: string): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: title }));
}

/**
 * A short, happy burst when work is marked done: a puff of confetti (skipped entirely for people who asked their device to reduce
 * motion) and a message that is also read out. The words are always shown, so nothing depends on the animation.
 */
export const CelebrateBurst: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onCelebrate = (e: Event) => {
      const title = String((e as CustomEvent).detail ?? '').slice(0, 80);
      setMessage(title ? `Done: ${title}. Nice work!` : 'Done. Nice work!');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setMessage(null), 3500);
      // Loaded on demand, so the first page load does not carry the confetti code.
      void import('canvas-confetti').then((m) =>
        m.default({ particleCount: 70, spread: 70, origin: { y: 0.75 }, disableForReducedMotion: true })
      );
    };
    window.addEventListener(EVENT, onCelebrate);
    return () => {
      window.removeEventListener(EVENT, onCelebrate);
      window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <div aria-live="polite" className="pointer-events-none fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-[55] max-w-[calc(100vw-2rem)]">
      {message && (
        <p
          data-testid="celebrate-message"
          className="flex items-center gap-2 rounded-full border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 px-4 py-2 text-sm font-medium text-emerald-900 dark:text-emerald-100 shadow-md [overflow-wrap:anywhere]"
        >
          <PartyPopper className="h-4 w-4 shrink-0" aria-hidden="true" />
          {message}
        </p>
      )}
    </div>
  );
};
