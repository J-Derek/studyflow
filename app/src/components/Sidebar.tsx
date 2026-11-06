import React, { useState } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar as CalendarIcon,
  Timer,
  GraduationCap,
  Cloud,
  LogOut,
  Sun,
  Moon,
  Award,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useStudyFlowStore, getPathFromTab } from '../store/studyFlowStore';
import { friendlyAuthMessage, signInOrLinkWithGoogle, signOutUser } from '../lib/authActions';
import { cn } from '../utils/formatters';
import { Avatar } from './Avatar';
import { SignInButton } from './SignInButton';

interface SidebarProps {
  onOpenBackup?: () => void;
  onOpenProfile?: () => void;
  /** Icon-only rail instead of the full sidebar. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenBackup, onOpenProfile, collapsed = false, onToggleCollapsed }) => {
  const {
    activeTab,
    setActiveTab,
    user,
    assignments,
    isAnonymous,
    userEmail,
    userPhotoUrl,
    theme,
    setTheme
  } = useStudyFlowStore();
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const handleGoogleAuth = async () => {
    try {
      setIsAuthLoading(true);
      await signInOrLinkWithGoogle();
    } catch (err) {
      console.error('Google sign-in error:', friendlyAuthMessage(err) ?? err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsAuthLoading(true);
      await signOutUser();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const pendingCount = assignments.filter((a) => a.status !== 'completed').length;

  const navItems = [
    { id: 'dashboard' as const, label: 'Today', icon: LayoutDashboard },
    { id: 'assignments' as const, label: 'Assignments', icon: CheckSquare, badge: pendingCount },
    { id: 'calendar' as const, label: 'Timetable', icon: CalendarIcon },
    { id: 'timer' as const, label: 'Focus Timer', icon: Timer },
    { id: 'grades' as const, label: 'Grades', icon: Award }
  ];

  // Labels stay in the page for screen readers when the sidebar is collapsed.
  const label = (text: string) => <span className={collapsed ? 'sr-only' : undefined}>{text}</span>;
  const displayName = isAnonymous ? 'Guest' : user.name;

  const toggle = onToggleCollapsed && (
    <button
      type="button"
      onClick={onToggleCollapsed}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-expanded={!collapsed}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="h-8 w-8 shrink-0 flex items-center justify-center rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
    >
      {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </button>
  );

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col shrink-0 border-r border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark sticky top-0 h-screen justify-between z-30 select-none transition-[width] duration-150',
        collapsed ? 'w-16 p-2' : 'w-60 p-3.5'
      )}
    >
      <div className={cn(collapsed ? 'space-y-3 flex flex-col items-center' : 'space-y-3.5')}>
        {/* Brand header and collapse control */}
        <div className={cn('flex items-center', collapsed ? 'flex-col gap-2' : 'justify-between gap-2.5 px-2 py-1.5')}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center font-bold shadow-2xs">
              <GraduationCap className="h-4 w-4" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 tracking-tight">StudyFlow</span>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">Study planner</p>
              </div>
            )}
            {collapsed && <span className="sr-only">StudyFlow</span>}
          </div>
          {toggle}
        </div>

        {/* Theme */}
        {collapsed ? (
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        ) : (
          <div className="p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center">
            <button
              onClick={() => setTheme('light')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium transition-colors duration-150',
                theme === 'light'
                  ? 'bg-surface-light text-zinc-900 shadow-2xs border border-zinc-200/60'
                  : 'text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              )}
            >
              <Sun className={cn('h-3 w-3', theme === 'light' ? 'text-amber-500 fill-amber-500' : 'text-zinc-600 dark:text-zinc-400')} />
              <span>Light</span>
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium transition-colors duration-150',
                theme === 'dark'
                  ? 'bg-zinc-900 text-zinc-100 shadow-2xs border border-zinc-700/80'
                  : 'text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              )}
            >
              <Moon className={cn('h-3 w-3', theme === 'dark' ? 'text-blue-400 fill-blue-400' : 'text-zinc-600 dark:text-zinc-400')} />
              <span>Dark</span>
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <nav className={cn('pt-1', collapsed ? 'space-y-1 flex flex-col items-center' : 'space-y-0.5')}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const showBadge = item.badge !== undefined && item.badge > 0;
            return (
              <a
                key={item.id}
                href={getPathFromTab(item.id)}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(item.id);
                }}
                aria-current={isActive ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'relative flex items-center rounded-lg text-xs font-medium transition-colors duration-150 group',
                  collapsed ? 'h-9 w-9 justify-center' : 'w-full justify-between px-2.5 py-1.5',
                  isActive
                    ? 'bg-zinc-100 dark:bg-zinc-800/90 text-zinc-950 dark:text-zinc-100 font-semibold border border-zinc-200/70 dark:border-zinc-700/70 shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/50'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={cn(collapsed ? 'h-4 w-4' : 'h-3.5 w-3.5', isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400')} />
                  {label(item.label)}
                </div>
                {showBadge && (
                  <span
                    className={cn(
                      'text-xs tabular-nums rounded font-medium',
                      collapsed ? 'absolute -top-1 -right-1 min-w-4 h-4 px-1 flex items-center justify-center text-[11px] leading-none' : 'px-1.5 py-0.5',
                      isActive ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </a>
            );
          })}
        </nav>
      </div>

      {/* Account */}
      {collapsed ? (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onOpenProfile}
            title="Edit profile"
            className="rounded-full hover:opacity-80 transition-opacity cursor-pointer"
          >
            <Avatar name={displayName} photoUrl={userPhotoUrl} isGuest={isAnonymous} className="h-8 w-8" />
            <span className="sr-only">{displayName}, edit profile</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (onOpenBackup) onOpenBackup();
              else handleGoogleAuth();
            }}
            disabled={isAuthLoading}
            aria-label={isAnonymous ? 'Sign in to keep your data' : 'Your account'}
            title={isAnonymous ? 'Sign in to keep your data' : 'Your account'}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-blue-600 dark:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
          >
            <Cloud className="h-4 w-4" />
          </button>
          {!isAnonymous && (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isAuthLoading}
              aria-label="Sign out"
              title="Sign out"
              className="h-9 w-9 flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-800/80 rounded-xl space-y-2 transition-colors">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onOpenProfile}
              title="Edit profile"
              className="flex items-center gap-2 overflow-hidden text-left hover:opacity-80 transition-opacity cursor-pointer group flex-1 min-w-0"
            >
              <Avatar name={displayName} photoUrl={userPhotoUrl} isGuest={isAnonymous} className="h-8 w-8" />
              <div className="truncate flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {displayName}
                </p>
                <p className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400 truncate">
                  {isAnonymous ? 'Not signed in' : userEmail || 'Cloud Student'}
                </p>
              </div>
              <span className="sr-only">, edit profile</span>
            </button>
          </div>

          {/* Account actions */}
          {isAnonymous ? (
            <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
              <SignInButton />
            </div>
          ) : (
          <div className="pt-1.5 border-t border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between text-xs tabular-nums">
            <button
              onClick={handleSignOut}
              disabled={isAuthLoading}
              className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400 hover:text-red-600 transition-colors cursor-pointer"
            >
              <LogOut className="h-3 w-3" />
              <span>Sign out</span>
            </button>

            <button
              onClick={() => {
                if (onOpenBackup) onOpenBackup();
                else handleGoogleAuth();
              }}
              disabled={isAuthLoading}
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              title="Your account"
            >
              <Cloud className="h-3 w-3" />
              <span>Account</span>
            </button>
          </div>
          )}
        </div>
      )}
    </aside>
  );
};
