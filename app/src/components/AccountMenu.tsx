import React, { useEffect, useId, useRef, useState } from 'react';
import { Cloud, HelpCircle, LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { signOutUser } from '../lib/authActions';
import { cn } from '../utils/formatters';
import { Avatar } from './Avatar';
import { isPlaceholderDetail } from '../utils/placeholderProfile';

interface AccountMenuProps {
  onOpenProfile?: () => void;
  onOpenBackup?: () => void;
  onOpenHelp?: () => void;
  /** Where the panel opens relative to the picture. The sidebar sits at the bottom, the header at the top. */
  placement: 'up' | 'down';
  className?: string;
}

const itemClass =
  'w-full flex items-center gap-2.5 px-3 min-h-[44px] rounded-lg text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-left disabled:opacity-50';

/**
 * The signed-in student's picture. Clicking it opens a small panel with their details and quick
 * settings (profile, account and backup, theme, help, sign out). Guests do not see this; they keep the
 * sign-in button.
 */
export const AccountMenu: React.FC<AccountMenuProps> = ({ onOpenProfile, onOpenBackup, onOpenHelp, placement, className }) => {
  const { user, userEmail, userPhotoUrl, customPhotoUrl, themeMode, setThemeMode } = useStudyFlowStore();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    // Move focus into the panel so keyboard and screen-reader users land on its first control.
    panelRef.current?.querySelector<HTMLElement>('button')?.focus();

    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const run = (action?: () => void) => () => {
    setOpen(false);
    action?.();
  };

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await signOutUser();
    } catch (err) {
      console.error('Sign out error:', err);
      setSigningOut(false);
    }
  };

  const name = user.name || 'Student';
  // Only what the student actually typed; default wording is left out.
  const details = [user.program, user.university].filter((t) => !isPlaceholderDetail(t)).join(', ');

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={`${name}${userEmail ? ` (${userEmail})` : ''}`}
        className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full hover:opacity-80 transition-opacity cursor-pointer"
      >
        <Avatar name={name} photoUrl={customPhotoUrl || userPhotoUrl} isGuest={false} className="h-8 w-8" />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Account"
          className={cn(
            'absolute z-50 w-64 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-surface-dark shadow-xl',
            placement === 'up' ? 'bottom-full left-0 mb-2' : 'top-full right-0 mt-2'
          )}
        >
          <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 mb-1">
            <Avatar name={name} photoUrl={customPhotoUrl || userPhotoUrl} isGuest={false} className="h-10 w-10" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{name}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">{userEmail || 'Signed in'}</p>
              {details && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">{details}</p>
              )}
            </div>
          </div>

          <button type="button" className={itemClass} onClick={run(onOpenProfile)}>
            <UserRound className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
            Edit profile
          </button>
          <button type="button" className={itemClass} onClick={run(onOpenBackup)}>
            <Cloud className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Your account
          </button>

          <div className="flex items-center gap-1 p-0.5 my-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200/80 dark:border-zinc-700/80" role="group" aria-label="Theme">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={themeMode === t}
                title={t === 'system' ? "Match this device's light or dark setting" : undefined}
                onClick={() => setThemeMode(t)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 min-h-[36px] rounded-md text-xs font-medium transition-colors cursor-pointer',
                  themeMode === t
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs border border-zinc-200/60 dark:border-zinc-700/80'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                )}
              >
                {t === 'light' ? <Sun className="h-3.5 w-3.5" /> : t === 'dark' ? <Moon className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
                {t === 'light' ? 'Light' : t === 'dark' ? 'Dark' : 'Device'}
              </button>
            ))}
          </div>

          {onOpenHelp && (
            <button type="button" className={itemClass} onClick={run(onOpenHelp)}>
              <HelpCircle className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              Help
            </button>
          )}
          <button
            type="button"
            className={cn(itemClass, 'hover:text-red-700 dark:hover:text-red-400')}
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};
