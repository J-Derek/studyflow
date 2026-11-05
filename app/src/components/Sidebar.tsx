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
  Award
} from 'lucide-react';
import { useStudyFlowStore, getPathFromTab } from '../store/studyFlowStore';
import { friendlyAuthMessage, signInOrLinkWithGoogle, signOutUser } from '../lib/authActions';
import { cn } from '../utils/formatters';

interface SidebarProps {
  onOpenBackup?: () => void;
  onOpenProfile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenBackup, onOpenProfile }) => {
  const { 
    activeTab, 
    setActiveTab, 
    user, 
    assignments, 
    isAnonymous, 
    userEmail, 
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

  return (
    <aside className="hidden md:flex flex-col w-60 border-r border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark sticky top-0 h-screen p-3.5 justify-between z-30 select-none transition-colors duration-150">
      <div className="space-y-3.5">
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="h-8 w-8 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center font-bold shadow-2xs">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div>
            <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 tracking-tight">StudyFlow</span>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">Study planner</p>
          </div>
        </div>

        {/* Minimalist Theme Segmented Toggle */}
        <div className="p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center">
          <button
            onClick={() => setTheme('light')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium transition-colors duration-150",
              theme === 'light'
                ? "bg-surface-light text-zinc-900 shadow-2xs border border-zinc-200/60"
                : "text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            )}
          >
            <Sun className={cn("h-3 w-3", theme === 'light' ? "text-amber-500 fill-amber-500" : "text-zinc-600 dark:text-zinc-400")} />
            <span>Light</span>
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium transition-colors duration-150",
              theme === 'dark'
                ? "bg-zinc-900 text-zinc-100 shadow-2xs border border-zinc-700/80"
                : "text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            )}
          >
            <Moon className={cn("h-3 w-3", theme === 'dark' ? "text-blue-400 fill-blue-400" : "text-zinc-600 dark:text-zinc-400")} />
            <span>Dark</span>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-0.5 pt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <a
                key={item.id}
                href={getPathFromTab(item.id)}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(item.id);
                }}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 group',
                  isActive
                    ? 'bg-zinc-100 dark:bg-zinc-800/90 text-zinc-950 dark:text-zinc-100 font-semibold border border-zinc-200/70 dark:border-zinc-700/70 shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/50'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400')} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={cn(
                      'text-xs tabular-nums px-1.5 py-0.5 rounded font-medium ',
                      isActive 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-zinc-200/70 dark:bg-zinc-700/70 text-zinc-700 dark:text-zinc-300'
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

      {/* User Information & Live Sync */}
      <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-800/80 rounded-xl space-y-2 transition-colors">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onOpenProfile}
            title="Edit profile"
            className="flex items-center gap-2 overflow-hidden text-left hover:opacity-80 transition-opacity cursor-pointer group flex-1 min-w-0"
          >
            <div className="h-7 w-7 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 tabular-nums font-semibold flex items-center justify-center text-xs flex-shrink-0 group-hover:bg-zinc-300 dark:group-hover:bg-zinc-600 transition-colors">
              {isAnonymous ? 'G' : user.name.split(' ').map((n) => n[0]).join('')}
            </div>
            <div className="truncate flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {isAnonymous ? 'Guest' : user.name}
              </p>
              <p className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400 truncate">
                {isAnonymous ? 'Not signed in' : (userEmail || 'Cloud Student')}
              </p>
            </div>
            <span className="sr-only">, edit profile</span>
          </button>

          {!isAnonymous && (
            <button
              onClick={handleSignOut}
              disabled={isAuthLoading}
              title="Sign out"
              className="p-1 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <LogOut className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Sync Status Banner */}
        <div className="pt-1.5 border-t border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between text-xs tabular-nums">
          <span className="text-zinc-600 dark:text-zinc-400">{isAnonymous ? 'Guest account' : 'Signed in'}</span>

          <button
            onClick={() => {
              if (onOpenBackup) onOpenBackup();
              else handleGoogleAuth();
            }}
            disabled={isAuthLoading}
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 disabled:opacity-50"
            title="Open Data Portability & Cloud Sync"
          >
            <Cloud className="h-3 w-3" />
            <span>{isAnonymous ? 'Back up' : 'Account'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
