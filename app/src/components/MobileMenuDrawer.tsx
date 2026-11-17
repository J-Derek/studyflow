import React, { useEffect, useRef, useMemo } from 'react';
import {
  X,
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Timer,
  Award,
  NotebookPen,
  Settings,
  HardDrive,
  HelpCircle,
  LogOut
} from 'lucide-react';
import { useStudyFlowStore, getPathFromTab, type NavigationTab } from '../store/studyFlowStore';
import { useAccountView } from '../store/useAccountView';
import { BrandMark } from './BrandMark';
import { Avatar } from './Avatar';
import { signOutUser } from '../lib/authActions';
import { confirmAction } from '../lib/confirm';
import { cn } from '../utils/formatters';

interface MobileMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSearch?: () => void;
  onOpenAddModal?: () => void;
  onOpenProfile?: () => void;
  onOpenBackup?: () => void;
  onOpenHelp?: () => void;
}

export const MobileMenuDrawer: React.FC<MobileMenuDrawerProps> = ({
  isOpen,
  onClose,
  onOpenProfile,
  onOpenBackup,
  onOpenHelp
}) => {
  const {
    activeTab,
    setActiveTab,
    user,
    customPhotoUrl,
    assignments
  } = useStudyFlowStore();

  const account = useAccountView();
  const isAnonymous = !account.signedIn;
  const userPhotoUrl = account.photoUrl;
  const pendingCount = assignments.filter((a) => a.status !== 'completed').length;
  const drawerRef = useRef<HTMLDivElement>(null);

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

  // Close on Escape key and prevent background body scrolling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const navigateTo = (tab: NavigationTab) => {
    setActiveTab(tab);
    onClose();
  };

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
    onClose();
    await signOutUser();
  };

  const navItems = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assignments' as const, label: 'Assignments', icon: CheckSquare, badge: pendingCount },
    { id: 'calendar' as const, label: 'Timetable', icon: Calendar },
    { id: 'timer' as const, label: 'Focus Timer', icon: Timer },
    { id: 'courses' as const, label: 'Courses & GPA', icon: Award },
    { id: 'notes' as const, label: 'Notes', icon: NotebookPen }
  ];

  const roleLabel = user.program && user.program !== 'My programme' 
    ? `${singleName} · ${user.program}` 
    : `${singleName} · Academic Workspace`;

  return (
    <div
      className="fixed inset-0 z-50 md:hidden bg-black/60 backdrop-blur-xs flex animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      <div
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
        className="w-[280px] sm:w-[310px] h-full bg-surface-light dark:bg-[#0D0F14] text-zinc-900 dark:text-zinc-100 border-r border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl flex flex-col justify-between overflow-y-auto px-5 py-6 animate-in slide-in-from-left duration-200 transition-colors"
      >
        {/* Top: Brand Header + Close Pill */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <BrandMark variant="full" className="h-6 w-auto" />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Sub-label beneath logo (matching reference Touchline "Boss" subtitle) */}
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tracking-wide mt-2 truncate">
              {roleLabel}
            </p>
          </div>

          {/* Clean Vertical Navigation List */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <a
                  key={item.id}
                  href={getPathFromTab(item.id)}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo(item.id);
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center justify-between px-4 py-2.5 rounded-full text-sm font-medium transition-colors cursor-pointer select-none',
                    isActive
                      ? 'bg-brand-navy text-white dark:bg-[#FAF7F2] dark:text-[#0D0F14] font-semibold shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white dark:text-[#0D0F14]' : 'text-zinc-500 dark:text-zinc-400')} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={cn(
                        'tabular-nums font-mono text-2xs px-2 py-0.5 rounded-full font-semibold',
                        isActive
                          ? 'bg-white/20 dark:bg-[#0D0F14] text-white dark:text-[#FAF7F2]'
                          : 'bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-zinc-300'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </nav>

          {/* Clean Hairline Divider */}
          <div className="h-px bg-zinc-200 dark:bg-white/10 my-2" />

          {/* Settings & Tools (Theme toggle moved to header per Touchline reference) */}
          <div className="space-y-1">
            {onOpenProfile && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenProfile();
                }}
                className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-full text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
              >
                <Settings className="h-4 w-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                <span>Settings</span>
              </button>
            )}

            {onOpenBackup && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBackup();
                }}
                className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-full text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
              >
                <HardDrive className="h-4 w-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                <span>Backup & Data</span>
              </button>
            )}

            {onOpenHelp && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenHelp();
                }}
                className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-full text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
              >
                <HelpCircle className="h-4 w-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                <span>Guide</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom: User Profile Row (Clickable to view/edit profile — zero sign-in redundancy) */}
        <div className="pt-3 border-t border-zinc-200 dark:border-white/10 mt-6">
          <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProfile?.();
              }}
              title="Edit profile"
              aria-label="Edit profile"
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
            >
              <Avatar
                name={singleName}
                photoUrl={customPhotoUrl || userPhotoUrl}
                isGuest={isAnonymous && !customPhotoUrl}
                className="h-8 w-8 rounded-full shrink-0 ring-2 ring-brand-gold/30"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {singleName}
                </p>
                <p className="text-2xs text-zinc-500 dark:text-zinc-400 truncate">
                  {user.program && user.program !== 'My programme'
                    ? user.program
                    : isAnonymous
                    ? 'Tap to edit profile'
                    : 'Cloud synced'}
                </p>
              </div>
            </button>

            {!isAnonymous && (
              <button
                type="button"
                onClick={handleSignOut}
                title="Sign out"
                aria-label="Sign out"
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer shrink-0 ml-1"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
