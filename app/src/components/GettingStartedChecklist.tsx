import React from 'react';
import { 
  CheckCircle2, 
  Circle, 
  X, 
  ChevronRight, 
  Calendar, 
  Timer, 
  CheckSquare, 
  ShieldCheck 
} from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';

interface GettingStartedChecklistProps {
  onOpenAddModal?: () => void;
  onOpenBackup?: () => void;
}

export const GettingStartedChecklist: React.FC<GettingStartedChecklistProps> = ({
  onOpenAddModal,
  onOpenBackup
}) => {
  const { 
    assignments, 
    sessions, 
    pomodorosCompleted, 
    isAnonymous, 
    onboardingDismissed, 
    dismissOnboarding,
    setActiveTab 
  } = useStudyFlowStore();

  const steps = [
    {
      id: 'step-asg',
      title: 'Add your first deliverable',
      desc: 'Set an upcoming exam, homework, or project deadline',
      completed: assignments.length > 0,
      icon: CheckSquare,
      action: () => {
        if (onOpenAddModal) onOpenAddModal();
        else setActiveTab('assignments');
      }
    },
    {
      id: 'step-focus',
      title: 'Log a deep work focus block',
      desc: 'Run a 25-minute Pomodoro round with ambient sound',
      completed: pomodorosCompleted > 0,
      icon: Timer,
      action: () => setActiveTab('timer')
    },
    {
      id: 'step-calendar',
      title: 'Add your weekly class schedule',
      desc: 'Map your lectures, labs, and study sessions',
      completed: sessions.length > 0,
      icon: Calendar,
      action: () => setActiveTab('calendar')
    },
    {
      id: 'step-backup',
      title: 'Secure your academic record',
      desc: 'Link Google or save a local recovery JSON file',
      completed: !isAnonymous,
      icon: ShieldCheck,
      action: () => {
        if (onOpenBackup) onOpenBackup();
      }
    }
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  // Auto-hide if dismissed or if all 4 steps are complete
  if (onboardingDismissed || completedCount === steps.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark p-4 md:p-5 transition-colors shadow-2xs">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Getting Started Checklist
            </h3>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {completedCount} / {steps.length} completed
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Four quick steps to take full command of your academic semester.
          </p>
        </div>

        <button
          onClick={dismissOnboarding}
          title="Dismiss getting started checklist"
          aria-label="Dismiss getting started checklist"
          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 min-h-[44px] min-w-[44px] inline-flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1 overflow-hidden">
        <div 
          className="bg-zinc-800 dark:bg-zinc-200 h-full rounded-full transition-all duration-500" 
          style={{ width: `${progressPercent}%` }} 
        />
      </div>

      {/* Checklist items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3.5">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              onClick={step.completed ? undefined : step.action}
              disabled={step.completed}
              className={`p-2.5 rounded-lg border text-left flex items-start justify-between gap-2.5 transition min-h-[44px] ${
                step.completed
                  ? 'bg-zinc-50/60 dark:bg-zinc-900/40 border-zinc-200/50 dark:border-zinc-800/50 opacity-60 cursor-default'
                  : 'bg-white dark:bg-zinc-850 border-zinc-200 dark:border-zinc-700/80 hover:border-zinc-400 dark:hover:border-zinc-500 cursor-pointer group'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="mt-0.5 shrink-0">
                  {step.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className={`text-xs font-medium flex items-center gap-1 truncate ${
                    step.completed ? 'line-through text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'
                  }`}>
                    <Icon className="h-3 w-3 text-zinc-400 shrink-0" />
                    <span>{step.title}</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block truncate">
                    {step.desc}
                  </span>
                </div>
              </div>

              {!step.completed && (
                <ChevronRight className="h-3.5 w-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0 mt-1" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
