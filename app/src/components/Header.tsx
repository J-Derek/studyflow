import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Menu,
  Search,
  Command,
  Bell,
  Sun,
  Moon,
  LogOut,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { useAccountView } from '../store/useAccountView';
import { Avatar } from './Avatar';
import { SaveBadge } from './SaveBadge';
import { SignInButton } from './SignInButton';
import { BrandMark } from './BrandMark';
import { MobileMenuDrawer } from './MobileMenuDrawer';
import { remainingSeconds } from '../lib/timerEngine';
import { signOutUser } from '../lib/authActions';
import { confirmAction } from '../lib/confirm';
import { getDaysRemaining, cn } from '../utils/formatters';

interface HeaderProps {
  onOpenAddModal?: () => void;
  onOpenSearch?: () => void;
  onOpenBackup?: () => void;
  onOpenProfile?: () => void;
  onOpenHelp?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddModal,
  onOpenSearch,
  onOpenBackup,
  onOpenProfile,
  onOpenHelp
}) => {
  const {
    theme,
    setTheme,
    activeTab,
    setActiveTab,
    user,
    customPhotoUrl,
    timer,
    nowMs,
    assignments
  } = useStudyFlowStore();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const account = useAccountView();
  const isAnonymous = !account.signedIn;
  const userPhotoUrl = account.photoUrl;
  // suppress unused
  void theme;

  // Single name to avoid duplicate first+last name displays
  const singleName = useMemo(() => {
    if (user.name && user.name.trim() && user.name.trim() !== 'Student') {
      return user.name.trim().split(' ')[0] || user.name.trim();
    }
    if (account.email) {
      return account.email.split('@')[0] || 'Student';
    }
    return 'Student';
  }, [user.name, account.email]);

  // Urgent deadlines for the notification bell
  const urgentDeadlines = useMemo(() => {
    return assignments
      .filter((a) => a.status !== 'completed' && getDaysRemaining(a.dueDate).isUrgent)
      .slice(0, 5);
  }, [assignments]);
  const notificationCount = urgentDeadlines.length;

  // Click outside to close notifications
  useEffect(() => {
    if (!isNotificationsOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isNotificationsOpen]);

  // Live timer pip
  const isTimerActive = timer.status === 'running' || timer.status === 'paused';
  const secondsLeft = isTimerActive ? remainingSeconds(timer, nowMs) : 0;
  const timerMins = Math.floor(secondsLeft / 60);
  const timerSecs = secondsLeft % 60;
  const formattedTimer = `${String(timerMins).padStart(2, '0')}:${String(timerSecs).padStart(2, '0')}`;
  const isBreak = timer.mode !== 'focus';

  // Theme toggle: toggle between light and dark only
  const cycleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  const themeIcon = theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />;
  const themeLabel = theme === 'dark' ? 'Dark' : 'Light';

  const handleSignOut = async () => {
    if (
      !(await confirmAction({
        title: 'Sign out?',
        body: 'Your work stays saved in your account. This device will show a blank workspace until you sign in again.',
        confirmLabel: 'Sign out'
      }))
    ) {
      return;
    }
    await signOutUser();
  };

  return (
    <>
      <header className="w-full bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur-md border-b border-zinc-200/70 dark:border-zinc-800/70 sticky top-0 z-30 px-3 sm:px-5 h-14 flex items-center transition-colors duration-150">
        <div className="flex items-center justify-between gap-2 w-full min-w-0">

          {/* ── LEFT: Mobile Menu + Mobile Logo OR Desktop Command Search Bar ── */}
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 sm:flex-initial">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              title="Menu"
              className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-surface-light dark:bg-zinc-850 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Mobile Back Button (Visible when navigated to inner tabs, returns to Dashboard) */}
            {activeTab !== 'dashboard' && (
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                aria-label="Back to dashboard"
                title="Back to dashboard"
                className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-surface-light dark:bg-zinc-850 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}

            {/* Mobile Brand Logo (Visible ONLY on mobile where sidebar is hidden) */}
            <div
              onClick={() => setActiveTab('dashboard')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveTab('dashboard');
                }
              }}
              className="md:hidden flex items-center cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold rounded py-1"
              title="Go to Dashboard"
              aria-label="StudyFlow home"
            >
              <BrandMark
                variant="full"
                className="h-9 w-auto max-w-[210px] object-contain transition-all"
              />
            </div>

            {/* Desktop Command Search (Replaces redundant logo on desktop; Sidebar holds the desktop logo) */}
            {onOpenSearch && (
              <button
                type="button"
                onClick={onOpenSearch}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-surface-light dark:bg-zinc-850 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer w-56 lg:w-64 justify-between"
              >
                <div className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Search…</span>
                </div>
                <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-2xs font-mono tabular-nums bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-500 dark:text-zinc-400">
                  <Command className="h-2.5 w-2.5" />K
                </kbd>
              </button>
            )}
          </div>

          {/* ── CENTER: Live timer pip (when active) ── */}
          {isTimerActive && (
            <button
              type="button"
              onClick={() => setActiveTab('timer')}
              title={`Timer ${timer.status} · ${formattedTimer}`}
              aria-label={`Timer active: ${formattedTimer} left`}
              className={cn(
                'hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium border transition-all cursor-pointer shadow-xs hover:scale-102 active:scale-98 shrink-0',
                isBreak
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
              )}
            >
              <span
                className={cn('h-1.5 w-1.5 rounded-full shrink-0', timer.status === 'running' ? 'animate-pulse' : 'opacity-60', isBreak ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-amber-600 dark:bg-amber-400')}
                aria-hidden="true"
              />
              <span className="tabular-nums font-semibold">{formattedTimer}</span>
              <span className="text-[10px] uppercase font-sans tracking-wide opacity-75">
                {timer.mode === 'focus' ? 'Focus' : 'Break'}
              </span>
            </button>
          )}

          {/* ── RIGHT: Notification Bell · Theme Toggle · Profile Single Name · Sign Out Icon ── */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 ml-auto">

            {/* Cloud Sync Status Pill */}
            <div className="hidden sm:inline-flex">
              <SaveBadge />
            </div>

            {/* Mobile Search Button */}
            {onOpenSearch && (
              <button
                type="button"
                onClick={onOpenSearch}
                title="Search (Ctrl+K)"
                aria-label="Search"
                className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-surface-light dark:bg-zinc-850 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
              >
                <Search className="h-4 w-4" />
              </button>
            )}

            {/* 🔔 Notification Bell Button with Popover */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setIsNotificationsOpen((prev) => !prev)}
                title="Notifications & deadlines"
                aria-label={`Notifications ${notificationCount > 0 ? `(${notificationCount} urgent)` : ''}`}
                className="relative flex items-center justify-center h-9 w-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-surface-light dark:bg-zinc-850 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
              >
                <Bell className="h-4 w-4" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                    {notificationCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Popover */}
              {isNotificationsOpen && (
                <div className="absolute right-0 top-11 w-72 sm:w-80 bg-surface-light dark:bg-[#12141A] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">Urgent Deadlines</span>
                    <span className="text-2xs font-mono text-zinc-500">{notificationCount} urgent</span>
                  </div>

                  <div className="py-2 space-y-2 max-h-60 overflow-y-auto">
                    {urgentDeadlines.length === 0 ? (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 py-3 text-center">
                        🎉 All caught up! No urgent deadlines pending.
                      </p>
                    ) : (
                      urgentDeadlines.map((asg) => {
                        const { label } = getDaysRemaining(asg.dueDate);
                        return (
                          <div
                            key={asg.id}
                            onClick={() => {
                              setActiveTab('assignments');
                              setIsNotificationsOpen(false);
                            }}
                            className="p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-zinc-800 dark:text-zinc-200 truncate">{asg.title}</p>
                              <p className="text-2xs text-zinc-500 font-mono">{asg.course.split('—')[0].trim()}</p>
                            </div>
                            <span className="font-mono text-2xs font-semibold text-red-600 dark:text-red-400 shrink-0">
                              {label}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('assignments');
                      setIsNotificationsOpen(false);
                    }}
                    className="w-full pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-center gap-1 text-xs text-brand-navy dark:text-brand-gold font-medium hover:underline cursor-pointer"
                  >
                    <span>View all deadlines</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* ☀️/🌙 Theme Toggle (Touchline style in header) */}
            <button
              type="button"
              onClick={cycleTheme}
              aria-label={`Theme: ${themeLabel}. Click to cycle.`}
              title={`Theme: ${themeLabel}`}
              className="flex items-center justify-center h-9 w-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-surface-light dark:bg-zinc-850 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
            >
              {themeIcon}
            </button>

            {/* ── User Profile Block / Sign In / Sign Out ── */}
            {isAnonymous ? (
              <div className="shrink-0">
                <SignInButton variant="header" />
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-1 border-l border-zinc-200/80 dark:border-zinc-800/80">
                {/* Avatar + Single Name only (No duplicate names) */}
                <button
                  type="button"
                  onClick={onOpenProfile}
                  title="Edit profile"
                  className="flex items-center gap-2 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <Avatar name={singleName} photoUrl={customPhotoUrl || userPhotoUrl} className="h-7 w-7 rounded-full shrink-0" />
                  <span className="hidden sm:inline text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[120px]">
                    {singleName}
                  </span>
                </button>

                {/* Sign Out Symbol (Shows name/action on hover) */}
                <button
                  type="button"
                  onClick={handleSignOut}
                  title="Sign out"
                  aria-label="Sign out"
                  className="flex items-center justify-center h-8 w-8 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Slide-out Mobile Navigation Drawer */}
      <MobileMenuDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onOpenSearch={onOpenSearch}
        onOpenAddModal={onOpenAddModal}
        onOpenProfile={onOpenProfile}
        onOpenBackup={onOpenBackup}
        onOpenHelp={onOpenHelp}
      />
    </>
  );
};
