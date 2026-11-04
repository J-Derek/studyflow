import React from 'react';
import { LayoutDashboard, CheckSquare, Calendar as CalendarIcon, Timer, Award } from 'lucide-react';
import { useStudyFlowStore, getPathFromTab } from '../store/studyFlowStore';
import { cn } from '../utils/formatters';

export const MobileNav: React.FC = () => {
  const { activeTab, setActiveTab, assignments } = useStudyFlowStore();
  const pendingCount = assignments.filter((a) => a.status !== 'completed').length;

  const items = [
    { id: 'dashboard' as const, label: 'Today', icon: LayoutDashboard },
    { id: 'assignments' as const, label: 'Assignments', icon: CheckSquare, badge: pendingCount },
    { id: 'calendar' as const, label: 'Timetable', icon: CalendarIcon },
    { id: 'timer' as const, label: 'Timer', icon: Timer },
    { id: 'grades' as const, label: 'Grades', icon: Award }
  ];

  return (
    <nav
      role="navigation"
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur-md border-t border-zinc-200/80 dark:border-zinc-800/80 z-40 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-2xs transition-colors"
    >
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
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center justify-center min-h-[48px] min-w-[48px] px-2 py-1 rounded-lg transition-colors duration-150 relative cursor-pointer select-none',
              isActive 
                ? 'text-zinc-950 dark:text-zinc-50 font-medium' 
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            )}
          >
            <div className="relative">
              <Icon className={cn('h-4 w-4', isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400 dark:text-zinc-500')} />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1 -right-2 h-3.5 min-w-3.5 px-0.5 bg-blue-600 text-white text-[9px] tabular-nums rounded-full flex items-center justify-center font-semibold">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
};
