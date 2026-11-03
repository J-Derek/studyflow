import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeLeft(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function getDaysRemaining(dateString?: string): { days: number; label: string; isUrgent: boolean } {
  if (!dateString) {
    return { days: 0, label: 'Pending date', isUrgent: false };
  }
  const target = new Date(dateString);
  if (isNaN(target.getTime())) {
    return { days: 0, label: 'Upcoming', isUrgent: false };
  }
  const now = new Date();
  
  // Set to midnight for clean day calculation
  target.setHours(23, 59, 59, 999);
  now.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { days: diffDays, label: `${Math.abs(diffDays)}d overdue`, isUrgent: true };
  } else if (diffDays === 0) {
    return { days: 0, label: 'Due today', isUrgent: true };
  } else if (diffDays === 1) {
    return { days: 1, label: 'Due tomorrow', isUrgent: true };
  } else {
    return { days: diffDays, label: `Due in ${diffDays}d`, isUrgent: diffDays <= 3 };
  }
}
