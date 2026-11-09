import React from 'react';
import { LayoutDashboard, CheckSquare, Calendar as CalendarIcon, Timer, Award, NotebookPen } from 'lucide-react';
import { useStudyFlowStore, getPathFromTab } from '../store/studyFlowStore';
import { cn } from '../utils/formatters';

export const MobileNav: React.FC = () => {
  const { activeTab, setActiveTab, assignments } = useStudyFlowStore();
  const pendingCount = assignments.filter((a) => a.status !== 'completed').length;

  const items = [
    { id: 'dashboard' as const, label: 'Today', icon: LayoutDashboard },
    // Six items share a narrow row, so "Assignments" is shown as "Tasks" here (its full name is still read out).
    { id: 'assignments' as const, label: 'Tasks', fullName: 'assignments', icon: CheckSquare, badge: pendingCount },
    { id: 'calendar' as const, label: 'Timetable', icon: CalendarIcon },
    { id: 'timer' as const, label: 'Timer', icon: Timer },
    { id: 'courses' as const, label: 'Courses', icon: Award },
    { id: 'notes' as const, label: 'Notes', icon: NotebookPen }
  ];

  return (
    <nav
      role="navigation"
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-light dark:bg-surface-dark border-t border-zinc-200/80 dark:border-zinc-800/80 z-40 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-2xs transition-colors"
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
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center justify-center min-h-[48px] min-w-0 flex-1 px-0.5 py-1 rounded-lg transition-colors duration-150 relative cursor-pointer select-none',
              isActive 
                ? 'text-zinc-950 dark:text-zinc-50 font-medium' 
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            )}
          >
            <div className="relative">
              <Icon className={cn('h-4 w-4', isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400')} />
              {item.badge !== undefined && item.badge > 0 && (
                <span aria-hidden="true" className="absolute -top-1 -right-2 h-3.5 min-w-3.5 px-0.5 bg-blue-600 text-white text-xs tabular-nums rounded-full flex items-center justify-center font-semibold">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[11px] leading-tight mt-0.5 tracking-tight whitespace-nowrap">{item.label}</span>
            {'fullName' in item && <span className="sr-only"> ({item.fullName})</span>}
            {item.badge !== undefined && item.badge > 0 && <span className="sr-only">, {item.badge} to do</span>}
          </a>
        );
      })}
    </nav>
  );
};
