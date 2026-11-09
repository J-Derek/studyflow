import React from 'react';
import {
  Sun,
  Moon,
  Plus,
  Search,
  Command,
  HelpCircle
} from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { useAccountView } from '../store/useAccountView';
import { AccountMenu } from './AccountMenu';
import { Avatar } from './Avatar';
import { SaveBadge } from './SaveBadge';
import { SignInButton } from './SignInButton';

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
  const { theme, toggleTheme, activeTab, user, customPhotoUrl } = useStudyFlowStore();
  // Shows the signed-in header straight after a reload, before Firebase has answered (display only).
  const account = useAccountView();
  const isAnonymous = !account.signedIn;
  const userPhotoUrl = account.photoUrl;

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Today';
      case 'assignments':
        return 'Assignments';
      case 'calendar':
        return 'Timetable';
      case 'timer':
        return 'Focus timer';
      case 'grades':
        return 'Grades';
      case 'notes':
        return 'Notes';
      case 'notfound':
        return 'Page not found';
      case 'privacy':
        return 'Privacy';
      case 'terms':
        return 'Terms of use';
      case 'children':
        return 'Children and parents';
      case 'storage':
        return 'Storage on your device';
      case 'accessibility':
        return 'Accessibility';
      default:
        return 'StudyFlow';
    }
  };

  return (
    <header className="w-full bg-surface-light dark:bg-surface-dark border-b border-zinc-200/80 dark:border-zinc-800/80 sticky top-0 z-20 px-4 md:px-6 h-12 flex items-center transition-colors duration-150">
      <div className="flex items-center justify-between gap-2 sm:gap-4 w-full min-w-0">
        {/* Left: Dynamic Page Breadcrumb */}
        <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span className="hidden sm:inline">{getPageTitle()}</span>
          </span>
        </div>

        {/* Right: Search, Sync Pip, Theme & Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 ml-auto">
          {/* Quick Search trigger */}
          {onOpenSearch && (
            <button
              onClick={onOpenSearch}
              className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-md border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              <Search className="h-3 w-3" />
              <span>Search assignments…</span>
              <kbd className="inline-flex items-center gap-0.5 px-1 py-0.5 text-xs tabular-nums bg-surface-light dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-600 dark:text-zinc-400">
                <Command className="h-2.5 w-2.5" /> K
              </kbd>
            </button>
          )}

          {/* Theme Toggle Button for Mobile (signed-in students have it in the account menu) */}
          {isAnonymous && (
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            className="hidden sm:flex md:hidden items-center justify-center min-h-[44px] min-w-[44px] p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          )}

          {/* Guest profile quick access for mobile (signed-in students use the account menu) */}
          {isAnonymous && onOpenProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              title={`Profile (${user.name})`}
              aria-label="Edit profile"
              className="flex md:hidden items-center justify-center min-h-[44px] min-w-[44px] p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
            >
              <Avatar name={user.name} photoUrl={customPhotoUrl || userPhotoUrl} isGuest={isAnonymous && !customPhotoUrl} className="h-8 w-8" />
            </button>
          )}

          {/* Is my work safe? Watches every collection and turns red when the cloud refuses a save */}
          <SaveBadge />

          {/* Help & Playbook Guide */}
          {isAnonymous && onOpenHelp && (
            <button
              type="button"
              onClick={onOpenHelp}
              title="Help"
              aria-label="Help"
              className="hidden sm:flex items-center justify-center min-h-[44px] min-w-[44px] p-2.5 rounded-lg border border-zinc-200/80 dark:border-zinc-750 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          )}

          {/* Guest Account Upgrade / Backup Button */}
          {isAnonymous ? (
            <SignInButton variant="header" />
          ) : (
            <AccountMenu placement="down" onOpenProfile={onOpenProfile} onOpenBackup={onOpenBackup} onOpenHelp={onOpenHelp} />
          )}

          {/* Global Add Task Quick Button */}
          {onOpenAddModal && (
            <button
              onClick={onOpenAddModal}
              aria-label="Add assignment"
              className="flex items-center gap-1.5 px-3.5 min-h-[44px] rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white/90 text-xs font-medium shadow-2xs transition-transform active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add assignment</span>
              <span className="sm:hidden">Add</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
