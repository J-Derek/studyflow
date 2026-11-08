import React from 'react';
import { cn } from '../utils/formatters';

export type IllustrationKind = 'assignments' | 'notes' | 'timetable' | 'sunrise' | 'done';

interface EmptyIllustrationProps {
  kind: IllustrationKind;
  className?: string;
}

// Shared colours. The line and card colours follow light and dark mode through Tailwind's dark: variants.
const line = 'stroke-zinc-400 dark:stroke-zinc-500';
const soft = 'stroke-zinc-300 dark:stroke-zinc-600';
const card = 'fill-white dark:fill-zinc-900';

/** Sets the CSS variables that offset an animation or give a stroke its length. */
const vars = (v: Record<string, string>) => v as React.CSSProperties;

const ILLUSTRATIONS: Record<IllustrationKind, React.ReactNode> = {
  // A checklist that ticks itself off, one row at a time.
  assignments: (
    <>
      <rect x="36" y="16" width="88" height="92" rx="10" className={cn(card, line)} strokeWidth="2" />
      <rect x="62" y="9" width="36" height="13" rx="5" className={cn('fill-zinc-100 dark:fill-zinc-800', line)} strokeWidth="2" />
      {[40, 64, 88].map((y, i) => (
        <g key={y}>
          <rect x="48" y={y} width="14" height="14" rx="4" className={line} strokeWidth="2" fill="none" />
          <path
            d={`M51 ${y + 7} l3.5 3.5 l6 -7.5`}
            className="sf-draw stroke-emerald-500"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            style={vars({ '--len': '16', '--d': `${0.4 + i * 0.9}s` })}
          />
          <line x1="70" y1={y + 7} x2={108 - i * 8} y2={y + 7} className={soft} strokeWidth="3" strokeLinecap="round" />
        </g>
      ))}
      <path d="M134 22 v10 M129 27 h10" className="sf-pulse stroke-blue-400" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),

  // A notebook page that fills with writing, and a pencil that bobs beside it.
  notes: (
    <>
      <rect x="36" y="10" width="82" height="100" rx="9" className={cn(card, line)} strokeWidth="2" />
      {[28, 50, 72, 94].map((y) => (
        <circle key={y} cx="36" cy={y} r="3.5" className={cn('fill-zinc-100 dark:fill-zinc-800', line)} strokeWidth="2" />
      ))}
      <rect x="52" y="24" width="40" height="6" rx="3" className="sf-grow fill-blue-500" style={vars({ '--d': '0s' })} />
      {[44, 60, 76, 92].map((y, i) => (
        <rect
          key={y}
          x="52"
          y={y}
          width={i === 3 ? 28 : 52 - i * 4}
          height="4"
          rx="2"
          className="sf-grow fill-zinc-300 dark:fill-zinc-600"
          style={vars({ '--d': `${0.5 + i * 0.7}s` })}
        />
      ))}
      <g className="sf-bob">
        <g transform="translate(120 78) rotate(40)">
          <rect x="-4" y="-26" width="8" height="22" rx="1.5" className="fill-amber-300 stroke-amber-500" strokeWidth="1.5" />
          <path d="M-4 -4 L4 -4 L0 6 Z" className="fill-zinc-100 dark:fill-zinc-700 stroke-zinc-500" strokeWidth="1.5" strokeLinejoin="round" />
        </g>
      </g>
    </>
  ),

  // A week grid whose class blocks slide in one after another.
  timetable: (
    <>
      <rect x="20" y="16" width="120" height="92" rx="9" className={cn(card, line)} strokeWidth="2" />
      <line x1="20" y1="36" x2="140" y2="36" className={soft} strokeWidth="2" />
      {[50, 80, 110].map((x) => (
        <line key={x} x1={x} y1="36" x2={x} y2="108" className={soft} strokeWidth="1.5" />
      ))}
      {[35, 65, 95, 125].map((x) => (
        <circle key={x} cx={x} cy="26" r="2.5" className="fill-zinc-400 dark:fill-zinc-500" />
      ))}
      <rect x="24" y="42" width="22" height="28" rx="5" className="sf-pop fill-blue-500/20 stroke-blue-500" strokeWidth="2" style={vars({ '--d': '0.2s' })} />
      <rect x="54" y="68" width="22" height="30" rx="5" className="sf-pop fill-emerald-500/20 stroke-emerald-500" strokeWidth="2" style={vars({ '--d': '1s' })} />
      <rect x="84" y="46" width="22" height="22" rx="5" className="sf-pop fill-amber-400/25 stroke-amber-500" strokeWidth="2" style={vars({ '--d': '1.8s' })} />
      <rect x="114" y="74" width="22" height="26" rx="5" className="sf-pop fill-blue-500/20 stroke-blue-500" strokeWidth="2" style={vars({ '--d': '2.6s' })} />
    </>
  ),

  // A calm sunrise for a day with nothing scheduled.
  sunrise: (
    <>
      <g className="sf-pulse" style={vars({ '--d': '0s' })}>
        {[
          [80, 52, 80, 41],
          [96, 56, 101.5, 46.5],
          [64, 56, 58.5, 46.5],
          [108, 68, 117.5, 62.5],
          [52, 68, 42.5, 62.5]
        ].map(([x1, y1, x2, y2]) => (
          <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-amber-400" strokeWidth="3" strokeLinecap="round" />
        ))}
      </g>
      <g className="sf-rise">
        <path d="M56 84 a24 24 0 0 1 48 0 Z" className="fill-amber-300 stroke-amber-500" strokeWidth="2" strokeLinejoin="round" />
      </g>
      <line x1="22" y1="84" x2="138" y2="84" className={line} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="48" y1="94" x2="112" y2="94" className={soft} strokeWidth="2" strokeLinecap="round" />
      <line x1="64" y1="103" x2="96" y2="103" className={soft} strokeWidth="2" strokeLinecap="round" />
    </>
  ),

  // A ring with a check that draws itself, and a little confetti drifting up.
  done: (
    <>
      <circle cx="80" cy="62" r="40" className="sf-pulse stroke-emerald-400" strokeWidth="2" fill="none" style={vars({ '--d': '0s' })} />
      <circle cx="80" cy="62" r="30" className="fill-emerald-500/10 stroke-emerald-500" strokeWidth="2.5" />
      <path
        d="M66 62 l10 10 l19 -21"
        className="sf-draw stroke-emerald-500"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        style={vars({ '--len': '46', '--d': '0.2s' })}
      />
      {[
        [34, 74, 'fill-blue-400', '0s'],
        [124, 70, 'fill-amber-400', '0.7s'],
        [46, 40, 'fill-rose-400', '1.4s'],
        [114, 38, 'fill-emerald-400', '2.1s'],
        [80, 20, 'fill-blue-400', '2.8s'],
        [134, 98, 'fill-rose-400', '0.35s'],
        [26, 100, 'fill-amber-400', '1.05s']
      ].map(([x, y, fill, d], i) => (
        <rect key={i} x={x as number} y={y as number} width="5" height="5" rx="1.5" className={cn('sf-float', fill as string)} style={vars({ '--d': d as string })} />
      ))}
    </>
  )
};

/**
 * A small, gentle, looping illustration for an empty screen. Decorative only: hidden from screen readers.
 * Pure SVG and CSS, so there is nothing to download, it follows light and dark mode, and it stands still
 * for anyone who has asked their device to reduce motion (see index.css).
 */
export const EmptyIllustration: React.FC<EmptyIllustrationProps> = ({ kind, className }) => (
  <svg
    viewBox="0 0 160 120"
    className={cn('block mx-auto h-24 w-32 overflow-visible', className)}
    aria-hidden="true"
    focusable="false"
    data-illustration={kind}
    fill="none"
  >
    {ILLUSTRATIONS[kind]}
  </svg>
);
