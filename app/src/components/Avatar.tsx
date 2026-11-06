import React, { useEffect, useState } from 'react';

interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  isGuest?: boolean;
  /** Tailwind size classes, e.g. "h-7 w-7". */
  className?: string;
}

/** Initials from up to two words of a name. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/** The student's Google photo, or their initials when there is no photo (or it fails to load). */
export const Avatar: React.FC<AvatarProps> = ({ name, photoUrl, isGuest, className = 'h-7 w-7' }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photoUrl]);

  if (photoUrl && !failed && !isGuest) {
    return (
      <img
        src={photoUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${className} rounded-full object-cover shrink-0 bg-zinc-200 dark:bg-zinc-700`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${className} rounded-full shrink-0 flex items-center justify-center bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold`}
    >
      {isGuest ? 'G' : initialsOf(name)}
    </span>
  );
};
