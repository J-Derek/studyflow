import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  ArrowRight,
  Flame,
} from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { getDaysRemaining } from '../utils/formatters';
import { calculateCumulativeGpa, getAcademicStanding } from '../utils/academicCalculations';
import { AssignmentModal } from '../components/AssignmentModal';
import { FirstDeadlineCard } from '../components/FirstDeadlineCard';
import { GettingStartedChecklist } from '../components/GettingStartedChecklist';

interface DashboardProps {
  onOpenAddModal?: () => void;
  onOpenBackup?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  onOpenAddModal,
  onOpenBackup
}) => {
  const { isAnonymous, guestNoticeDismissed, dismissGuestNotice, assignments, sessions, grades, pomodorosCompleted, setActiveTab, toggleAssignmentComplete } = useStudyFlowStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Statistics Computations
  const totalAssignments = assignments.length;
  const completedAssignments = assignments.filter((a) => a.status === 'completed').length;
  const pendingAssignments = assignments.filter((a) => a.status !== 'completed');
  const completionRate = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

  // Real-time Dynamic GPA & Academic Standing
  const { gpaString, gpa, hasData: hasGpa } = calculateCumulativeGpa(grades);
  const academicStanding = getAcademicStanding(gpa);
  const focusHours = ((pomodorosCompleted * 25) / 60).toFixed(1);
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  // Urgent / Upcoming assignments sorted by due date
  const urgentAssignments = [...pendingAssignments]
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 4);

  // Today's Day of Week (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const currentDayOfWeek = new Date().getDay();
  const todaysSessions = sessions.filter((s) => s.dayOfWeek === currentDayOfWeek);

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Today</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {todayLabel}
            {' · '}
            {pendingAssignments.length === 0
              ? 'Nothing due.'
              : `${pendingAssignments.length} ${pendingAssignments.length === 1 ? 'assignment' : 'assignments'} to finish`}
            {todaysSessions.length > 0 && `, ${todaysSessions.length} ${todaysSessions.length === 1 ? 'class' : 'classes'} today`}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setActiveTab('timer')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200 font-medium text-sm border border-zinc-200/80 dark:border-zinc-700/80 transition-colors active:scale-95 cursor-pointer"
          >
            <Flame className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
            <span>Start focus timer</span>
          </button>
        </div>
      </div>

      {isAnonymous && !guestNoticeDismissed && assignments.some((a) => !a.sample) && (
        <div role="note" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <p>Your assignments are saved to a guest account. Sign in with Google so you keep them if you clear this browser or switch phones.</p>
          <div className="flex items-center gap-2 shrink-0">
            {onOpenBackup && (
              <button type="button" onClick={onOpenBackup} className="px-3 py-1.5 min-h-[44px] rounded-md bg-amber-900 dark:bg-amber-200 text-white dark:text-amber-950 font-medium text-xs cursor-pointer">Back up now</button>
            )}
            <button type="button" onClick={dismissGuestNotice} className="px-3 py-1.5 min-h-[44px] rounded-md text-xs font-medium cursor-pointer hover:underline">Not now</button>
          </div>
        </div>
      )}

      {/* Zero State Activation Hero: Quick First Deadline Input */}
      {assignments.length === 0 && (
        <FirstDeadlineCard />
      )}

      {assignments.length > 0 && <GettingStartedChecklist
        onOpenAddModal={onOpenAddModal || (() => setIsModalOpen(true))}
        onOpenBackup={onOpenBackup}
      />}

      <div className="bg-surface-light dark:bg-surface-dark border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-zinc-200/80 dark:divide-zinc-800/80 grid grid-cols-2 lg:grid-cols-4 overflow-hidden">
        <div className="p-4 md:p-5 flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">To do</span>
          <div className="my-2.5 flex items-baseline gap-2">
            <span className="tabular-nums text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">{pendingAssignments.length}</span>
            
          </div>
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
            <span>{completedAssignments} done</span>
            
          </div>
        </div>
        <div className="p-4 md:p-5 flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Completed</span>
          <div className="my-2.5 flex items-baseline gap-2">
            <span className="tabular-nums text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">{completionRate}%</span>
            
          </div>
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
            <span>{completedAssignments} of {totalAssignments}</span>
            
          </div>
        </div>
        <div className="p-4 md:p-5 flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Focus sessions</span>
          <div className="my-2.5 flex items-baseline gap-2">
            <span className="tabular-nums text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">{pomodorosCompleted}</span>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">completed</span>
          </div>
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
            <span>About {focusHours} h of focus</span>
            
          </div>
        </div>
        <div className="p-4 md:p-5 flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Projected GPA</span>
          <div className="my-2.5 flex items-baseline gap-2">
            <span className="tabular-nums text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">{hasGpa ? gpaString : "—"}</span>
            
          </div>
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
            <span>{hasGpa ? academicStanding.standing : "Add graded work in Grades"}</span>
            
          </div>
        </div>
      </div>

      {/* Main Content Split: Upcoming assignments and today's classes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Linear-grade Assignments Queue (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Upcoming deadlines</h2>
              <span className="tabular-nums text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {urgentAssignments.length} in queue
              </span>
            </div>
            <button
              onClick={() => setActiveTab('assignments')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 min-h-[44px] inline-flex items-center gap-1 py-2 px-1 transition-colors group cursor-pointer"
            >
              <span>View all ({assignments.length})</span>
              <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark overflow-hidden divide-y divide-zinc-200/70 dark:divide-zinc-800/70 shadow-2xs">
            {urgentAssignments.length === 0 ? (
              <div className="p-8 text-center">
                {assignments.length === 0 ? (
                  <>
                    <h4 className="text-xs font-medium text-zinc-900 dark:text-zinc-100">No deadlines scheduled yet</h4>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">Use the quick start card above or click "Add assignment" to begin.</p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                    <h4 className="text-xs font-medium text-zinc-900 dark:text-zinc-100">All assignments cleared</h4>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">No urgent deadlines pending on your course.</p>
                  </>
                )}
              </div>
            ) : (
              urgentAssignments.map((asg) => {
                const { label, isUrgent } = getDaysRemaining(asg.dueDate);
                return (
                  <div
                    key={asg.id}
                    className="p-3.5 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2 overflow-hidden min-w-0">
                      <button
                        onClick={() => toggleAssignmentComplete(asg.id)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center -my-2 -ml-2 text-zinc-600 dark:text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors shrink-0 cursor-pointer"
                        title={`Mark "${asg.title}" complete`}
                        aria-label={`Mark "${asg.title}" complete`}
                      >
                        <Circle className="h-4 w-4" />
                      </button>

                      <div className="flex items-center gap-2 overflow-hidden min-w-0">
                        <span className="tabular-nums text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60 shrink-0">
                          {asg.course.split('—')[0].trim()}
                        </span>
                        
                        <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {asg.title}
                        </span>

                        {asg.notes && (
                          <span className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate hidden md:inline">
                            — {asg.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Priority — monochrome text only, no color coding */}
                      <span className="tabular-nums text-[10px] text-zinc-600 dark:text-zinc-400 hidden sm:inline capitalize">
                        {asg.priority}
                      </span>

                      {/* Due Countdown — plain monospace, red only if overdue */}
                      <span
                        className={`tabular-nums text-[11px]  ${
                          isUrgent
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Today's classes (1 col) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Today’s classes</h2>
            <button
              onClick={() => setActiveTab('calendar')}
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 min-h-[44px] inline-flex items-center py-2 px-1 transition-colors cursor-pointer"
            >
              Full week →
            </button>
          </div>

          <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 space-y-3.5 shadow-2xs">
            {todaysSessions.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">No lecture sessions scheduled today.</p>
              </div>
            ) : (
              todaysSessions.map((session) => (
                <div key={session.id} className="flex items-start gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80 last:border-0 last:pb-0">
                  <div className="w-14 shrink-0 text-right tabular-nums">
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{session.startTime}</span>
                    <span className="block text-[10px] text-zinc-600 dark:text-zinc-400">{session.endTime}</span>
                  </div>
                  <div className="h-full w-0.5 bg-zinc-400 dark:bg-zinc-600 shrink-0 self-stretch rounded-full" />
                  <div className="overflow-hidden min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="tabular-nums text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                        {session.course}
                      </span>
                      <span className="text-[10px] capitalize text-zinc-600 dark:text-zinc-400 tabular-nums">{session.type}</span>
                    </div>
                    <h5 className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{session.title}</h5>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <AssignmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
