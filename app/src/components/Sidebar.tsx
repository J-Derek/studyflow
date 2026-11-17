import React from 'react';
import { BrandMark } from './BrandMark';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar as CalendarIcon,
  Timer,
  Award,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  LogIn
} from 'lucide-react';
import { useStudyFlowStore, getPathFromTab } from '../store/studyFlowStore';
import { useAccountView } from '../store/useAccountView';
import { cn } from '../utils/formatters';
import { AccountMenu } from './AccountMenu';
import { useI18n } from '../lib/i18n';
import { Avatar } from './Avatar';
import { signInOrLinkWithGoogle, friendlyAuthMessage } from '../lib/authActions';

interface SidebarProps {
  onOpenBackup?: () => void;
  onOpenProfile?: () => void;
  onOpenHelp?: () => void;
  /** Icon-only rail instead of the full sidebar. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenBackup,
  onOpenProfile,
  onOpenHelp,
  collapsed = false,
  onToggleCollapsed
}) => {
  const { activeTab, setActiveTab, user, assignments, customPhotoUrl } = useStudyFlowStore();
  const account = useAccountView();
  const { t } = useI18n();
  const isAnonymous = !account.signedIn;
  const userEmail = account.email;
  const userPhotoUrl = account.photoUrl;
  const displayName = isAnonymous ? (user.name || 'Guest') : user.name;

  const [isAuthLoading, setIsAuthLoading] = React.useState(false);
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

  const pendingCount = assignments.filter((a) => a.status !== 'completed').length;

  const navItems = [
    { id: 'dashboard'   as const, label: t('nav.today'),       icon: LayoutDashboard },
    { id: 'assignments' as const, label: t('nav.assignments'), icon: CheckSquare, badge: pendingCount },
    { id: 'calendar'    as const, label: t('nav.timetable'),   icon: CalendarIcon },
    { id: 'timer'       as const, label: t('nav.timer'),       icon: Timer },
    { id: 'courses'     as const, label: t('nav.courses'),     icon: Award },
    { id: 'notes'       as const, label: t('nav.notes'),       icon: NotebookPen },
  ];

  // SR labels survive collapse
  const srLabel = (text: string) => <span className={collapsed ? 'sr-only' : undefined}>{text}</span>;

  const toggleBtn = onToggleCollapsed && (
    <button
      type="button"
      onClick={onToggleCollapsed}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-expanded={!collapsed}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="h-8 w-8 shrink-0 flex items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
    >
      {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </button>
  );

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col shrink-0 border-r border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark sticky top-0 h-screen z-30 select-none transition-[width] duration-150',
        collapsed ? 'w-16 p-2' : 'w-56 p-3'
      )}
    >
      {/* ── TOP: logo + collapse toggle ── */}
      <div
        className={cn(
          'flex items-center mb-4',
          collapsed ? 'flex-col gap-2 items-center' : 'justify-between gap-2 px-1 pt-1'
        )}
      >
        <div className="flex items-center min-w-0">
          {collapsed ? (
            <>
              <BrandMark variant="icon" className="h-8 w-8 shrink-0" />
              <span className="sr-only">StudyFlow</span>
            </>
          ) : (
            <BrandMark variant="full" className="h-7 w-auto max-w-[150px] shrink-0" />
          )}
        </div>
        {toggleBtn}
      </div>

      {/* ── NAV LINKS ── */}
      <nav
        className={cn('flex-1 overflow-y-auto', collapsed ? 'flex flex-col items-center space-y-1' : 'space-y-0.5')}
        aria-label="Main navigation"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const showBadge = (item.badge ?? 0) > 0;
          return (
            <a
              key={item.id}
              href={getPathFromTab(item.id)}
              onClick={(e) => { e.preventDefault(); setActiveTab(item.id); }}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                'relative flex items-center rounded-lg text-xs font-medium transition-colors duration-150',
                collapsed ? 'h-9 w-9 justify-center' : 'w-full justify-between px-2.5 py-2',
                isActive
                  ? 'bg-zinc-100 dark:bg-zinc-800/90 text-zinc-950 dark:text-zinc-100 font-semibold border border-zinc-200/70 dark:border-zinc-700/70 shadow-2xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/50'
              )}
            >
              <span className="flex items-center gap-2.5">
                <Icon
                  className={cn(
                    collapsed ? 'h-4 w-4' : 'h-3.5 w-3.5',
                    isActive ? 'text-brand-navy dark:text-brand-gold' : 'text-zinc-500 dark:text-zinc-400'
                  )}
                />
                {srLabel(item.label)}
              </span>
              {showBadge && (
                <span
                  className={cn(
                    'tabular-nums rounded font-semibold text-[10px] leading-none',
                    collapsed
                      ? 'absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 flex items-center justify-center'
                      : 'px-1.5 py-0.5',
                    isActive
                      ? 'bg-brand-navy dark:bg-brand-gold text-white dark:text-zinc-900'
                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      {/* ── BOTTOM: account strip ── */}
      <div className={cn('mt-3 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60', collapsed ? 'flex flex-col items-center gap-2' : '')}>
        {!isAnonymous ? (
          /* Signed-in: avatar + account menu */
          <div className={cn('flex', collapsed ? 'justify-center' : 'px-0.5')}>
            <AccountMenu
              placement="up"
              onOpenProfile={onOpenProfile}
              onOpenBackup={onOpenBackup}
              onOpenHelp={onOpenHelp}
            />
          </div>
        ) : collapsed ? (
          /* Guest + collapsed: avatar icon → opens profile */
          <button
            type="button"
            onClick={onOpenProfile}
            title={`${displayName} — tap to edit profile`}
            className="rounded-full hover:opacity-80 transition-opacity cursor-pointer"
          >
            <Avatar
              name={displayName}
              photoUrl={customPhotoUrl || userPhotoUrl}
              isGuest={isAnonymous && !customPhotoUrl}
              className="h-8 w-8"
            />
            <span className="sr-only">{displayName}, edit profile</span>
          </button>
        ) : (
          /* Guest + expanded: identity row + single quiet sign-in link */
          <div className="px-0.5 space-y-2">
            {/* Identity row */}
            <button
              type="button"
              onClick={onOpenProfile}
              className="w-full flex items-center gap-2.5 hover:opacity-80 transition-opacity cursor-pointer text-left min-h-[44px] group"
              title="Edit profile"
            >
              <Avatar
                name={displayName}
                photoUrl={customPhotoUrl || userPhotoUrl}
                isGuest={isAnonymous && !customPhotoUrl}
                className="h-8 w-8 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-brand-navy dark:group-hover:text-brand-gold transition-colors">
                  {displayName}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {isAnonymous ? 'Not signed in' : (userEmail || 'Signed in')}
                </p>
              </div>
            </button>

            {/* Quiet sign-in nudge — not a full Google button, just a text link */}
            {isAnonymous && (
              <button
                type="button"
                onClick={() => onOpenBackup ? onOpenBackup() : handleGoogleAuth()}
                disabled={isAuthLoading}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5 shrink-0 text-brand-navy dark:text-brand-gold" />
                <span>{isAuthLoading ? 'Signing in…' : 'Sign in to sync'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
