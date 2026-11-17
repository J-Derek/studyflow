import React from 'react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { cn } from '../utils/formatters';

interface BrandMarkProps {
  className?: string;
  variant?: 'icon' | 'full';
  alt?: string;
}

/**
 * The official StudyFlow brand mark.
 * - 'icon': The academic S-emblem with graduation cap and open book.
 * - 'full': The full StudyFlow logo with academic tagline, automatically theme-aware.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({
  className,
  variant = 'icon',
  alt = 'StudyFlow'
}) => {
  const { theme } = useStudyFlowStore();
  const isDark = theme === 'dark';

  if (variant === 'full') {
    return (
      <img
        src={isDark ? '/logo/logo-dark.webp' : '/logo/logo-transparent.webp'}
        alt={alt}
        className={cn('h-9 w-auto object-contain select-none', className)}
        draggable={false}
      />
    );
  }

  return (
    <img
      src="/logo/icon-transparent.webp"
      alt={alt}
      className={cn('h-8 w-8 object-contain select-none', className)}
      draggable={false}
    />
  );
};
