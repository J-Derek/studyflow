import React from 'react';
import { LayoutDashboard, CheckSquare, Calendar as CalendarIcon, Timer } from 'lucide-react';
import { useStudyFlowStore, getPathFromTab } from '../store/studyFlowStore';
import { cn } from '../utils/formatters';
import { useI18n } from '../lib/i18n';

export const MobileNav: React.FC = () => {
  const { activeTab, setActiveTab, assignments, timer } = useStudyFlowStore();
  const pendingCount = assignments.filter((a) => a.status !== 'completed').length;
  const isTimerRunning = timer.status === 'running';
  const { t } = useI18n();

  // Exactly four core daily navigation tabs on mobile
  const items = [
    { 
      id: 'dashboard' as const, 
      label: t('nav.today') || 'Today', 
      icon: LayoutDashboard 
    },
    { 
      id: 'assignments' as const, 
      label: t('nav.assignments') || 'Tasks', 
      icon: CheckSquare, 
      badge: pendingCount 
    },
    { 
      id: 'calendar' as const, 
      label: t('nav.timetable') || 'Timetable', 
      icon: CalendarIcon 
    },
    { 
      id: 'timer' as const, 
      label: t('nav.timerShort') || 'Focus', 
      icon: Timer,
      activePulse: isTimerRunning
    }
  ];

  return (
    <nav
      role="navigation"
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-light/98 dark:bg-[#101216]/98 backdrop-blur-xl border-t border-zinc-200/80 dark:border-zinc-800/80 rounded-t-2xl sm:rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)] px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] transition-colors"
    >
      <div className="grid grid-cols-4 items-center max-w-md mx-auto">
        {items.map((item) => {
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
              className="flex flex-col items-center justify-center min-h-[48px] py-1 transition-all duration-150 cursor-pointer select-none active:scale-95 group"
            >
              {/* Clean Soft Oval Pill Container for the Icon */}
              <div
                className={cn(
                  'relative px-4 py-1 rounded-full flex items-center justify-center transition-all duration-200',
                  isActive
                    ? 'bg-brand-navy/10 text-brand-navy dark:bg-brand-gold/18 dark:text-brand-gold'
                    : 'text-zinc-500 dark:text-zinc-400 group-hover:bg-black/5 dark:group-hover:bg-white/5'
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 transition-transform duration-200',
                    isActive ? 'scale-105 stroke-[2.25]' : 'stroke-[1.75]'
                  )}
                />

                {/* Badge for Pending Tasks */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 h-4 min-w-4 px-1 bg-brand-gold text-brand-navy text-[10px] tabular-nums rounded-full flex items-center justify-center font-bold shadow-xs"
                  >
                    {item.badge}
                  </span>
                )}

                {/* Pulsing indicator when Focus timer is running */}
                {item.activePulse && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping"
                  />
                )}
              </div>

              {/* Text Label Below Icon */}
              <span
                className={cn(
                  'text-[11px] leading-tight mt-1 tracking-tight truncate max-w-full font-medium transition-colors',
                  isActive
                    ? 'text-brand-navy dark:text-brand-gold font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400'
                )}
              >
                {item.label}
              </span>

              {item.badge !== undefined && item.badge > 0 && (
                <span className="sr-only">, {item.badge} pending</span>
              )}
            </a>
          );
        })}
      </div>
    </nav>
  );
};
