import React, { useEffect, useRef, useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  ArrowRight,
  Flame,
  Pencil,
  PenLine,
  Plus,
} from 'lucide-react';
import { EmptyIllustration } from '../components/EmptyIllustration';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { useAccountView } from '../store/useAccountView';
import { getDaysRemaining } from '../utils/formatters';
import { overallResult } from '../utils/gradingScale';
import type { Assignment } from '../types';
import { AssignmentModal } from '../components/AssignmentModal';
import { FirstDeadlineCard } from '../components/FirstDeadlineCard';
import { KindBadge } from '../components/KindBadge';
import { BusyWeekNotice } from '../components/BusyWeekNotice';
import { WritingSpace } from '../components/WritingSpace';
import { celebrate } from '../components/CelebrateBurst';
import { kindOf } from '../utils/kinds';
import { selectPendingDeadlines } from '../utils/calendarMonth';
import { GettingStartedChecklist } from '../components/GettingStartedChecklist';

interface DashboardProps {
  onOpenAddModal?: () => void;
  onOpenBackup?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  onOpenAddModal,
  onOpenBackup
}) => {
  const isAnonymous = !useAccountView().signedIn;
  const { focusMinutes, guestNoticeDismissed, dismissGuestNotice, assignments, sessions, grades, user, pomodorosCompleted, setActiveTab, toggleAssignmentComplete } = useStudyFlowStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  // The assignment being edited from this screen (opens the same dialog as the Assignments page).
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [writing, setWriting] = useState<Assignment | null>(null);
  // If the assignment is deleted elsewhere while its dialog is open, close the dialog rather than recreate it.
  const editingStillExists = !editing || assignments.some((a) => a.id === editing.id);
  // Right after the student saves their very first assignment, say what happened and where to change it. The list also goes from empty
  // to full when their saved plan arrives after signing in or reloading; that is not a save, so only an assignment made in the last few
  // seconds counts (older ones carry an older createdAt).
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const previousCount = useRef(assignments.length);
  useEffect(() => {
    if (previousCount.current === 0 && assignments.length > 0) {
      const newest = [...assignments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!;
      const madeJustNow = Date.now() - Date.parse(newest.createdAt) < 8000;
      previousCount.current = assignments.length;
      if (!madeJustNow) return;
      setJustSaved(newest.title);
      return;
    }
    previousCount.current = assignments.length;
  }, [assignments]);
  // The line goes after ten seconds. Its own timer, so a later change to the list cannot cancel it and leave it standing.
  useEffect(() => {
    if (!justSaved) return;
    const t = window.setTimeout(() => setJustSaved(null), 10000);
    return () => window.clearTimeout(t);
  }, [justSaved]);
  const openAdd = () => (onOpenAddModal ? onOpenAddModal() : setIsModalOpen(true));

  // Statistics Computations
  const totalAssignments = assignments.length;
  const completedAssignments = assignments.filter((a) => a.status === 'completed').length;
  const pendingAssignments = assignments.filter((a) => a.status !== 'completed');
  const completionRate = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

  // Real-time Dynamic GPA & Academic Standing
  const scale = user.gradingScale ?? 'us4';
  const overall = overallResult(grades, scale);
  const focusHours = (focusMinutes / 60).toFixed(1);
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  // Urgent / Upcoming assignments sorted by due date
  const urgentAssignments = selectPendingDeadlines(pendingAssignments).slice(0, 4);
  const nextUp = urgentAssignments[0];
  const nextUpDue = nextUp ? getDaysRemaining(nextUp.dueDate) : { label: '', isUrgent: false };

  // Today's Day of Week (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const currentDayOfWeek = new Date().getDay();
  const todaysSessions = sessions
    .filter((s) => s.dayOfWeek === currentDayOfWeek)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  // "HH:MM" now, to mark the class that is on right now. Times are stored as "HH:MM", so text comparison works.
  const nowClock = new Date().toTimeString().slice(0, 5);

  // A brand-new student sees only the add form: no zero numbers and no empty lists until there is something to show.
  const brandNew = assignments.length === 0 && grades.length === 0 && pomodorosCompleted === 0;
  const showLists = assignments.length > 0 || todaysSessions.length > 0;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Today</h1>
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
          <span className="sf-aura rounded-lg">
            <button
              onClick={() => setActiveTab('timer')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200 font-medium text-sm transition-colors duration-150 active:scale-95 cursor-pointer"
            >
              <Flame className="h-4 w-4 text-orange-600 dark:text-amber-400" aria-hidden="true" />
              <span>Start focus timer</span>
            </button>
          </span>
        </div>
      </div>

      {isAnonymous && !guestNoticeDismissed && !justSaved && assignments.some((a) => !a.sample) && (
        <div role="note" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-surface-light dark:bg-surface-dark px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
          <p>Your deadlines are saved on this device only. Sign in with Google to keep them if you clear this browser or switch phones.</p>
          <div className="flex items-center gap-2 shrink-0">
            {onOpenBackup && (
              <button type="button" onClick={onOpenBackup} className="px-3 py-1.5 min-h-[44px] rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium text-xs cursor-pointer">Sign in with Google</button>
            )}
            <button type="button" onClick={dismissGuestNotice} className="px-3 py-1.5 min-h-[44px] rounded-md text-xs font-medium cursor-pointer hover:underline">Not now</button>
          </div>
        </div>
      )}

      <BusyWeekNotice assignments={assignments} />

      {/* Zero State Activation Hero: Quick First Deadline Input */}
      {assignments.length === 0 && (
        <FirstDeadlineCard />
      )}

      {/* One dominant thing first: what is due next. Everything else is quiet. */}
      {justSaved && (
        <p role="status" className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 text-sm text-emerald-900 dark:text-emerald-200">
          Saved “{justSaved}”. Use <strong>Edit</strong> to change it, or <strong>Add assignment</strong> to add more.
        </p>
      )}

      {nextUp && (
        <section aria-labelledby="next-up-heading" className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark p-5 md:p-7">
          <h2 id="next-up-heading" className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Next up</h2>
          <p className="mt-2 font-display text-3xl md:text-5xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 break-words">{nextUp.title}</p>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-zinc-700 dark:text-zinc-300">
            <span>{nextUp.course.split('—')[0].trim()}</span>
            <span aria-hidden="true">·</span>
            <span className={`tabular-nums font-medium ${nextUpDue.isUrgent ? 'text-red-600 dark:text-red-400' : ''}`}>{nextUpDue.label}</span>
            {kindOf(nextUp) !== 'assignment' && <KindBadge kind={kindOf(nextUp)} />}
            {nextUp.subtasks && nextUp.subtasks.length > 0 && (
              <span className="text-sm text-zinc-600 dark:text-zinc-400 tabular-nums">
                {nextUp.subtasks.filter((s) => s.completed).length} of {nextUp.subtasks.length} steps done
              </span>
            )}
          </p>
          {nextUp.notes && (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap line-clamp-3">{nextUp.notes}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => {
                toggleAssignmentComplete(nextUp.id);
                celebrate(nextUp.title);
              }}
              className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>Mark done</span>
            </button>
            <button
              type="button"
              onClick={() => setEditing(nextUp)}
              className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-100 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => setWriting(nextUp)}
              className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-100 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <PenLine className="h-4 w-4" aria-hidden="true" />
              <span>Write</span>
            </button>
          </div>
        </section>
      )}

      {!brandNew && <dl className="flex flex-wrap gap-x-10 gap-y-4 px-1">
        <div>
          <dt className="text-sm text-zinc-600 dark:text-zinc-400">To do</dt>
          <dd className="font-display tabular-nums text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{pendingAssignments.length}</dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-600 dark:text-zinc-400">Completed</dt>
          <dd className="font-display tabular-nums text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{completionRate}%<span className="ml-2 text-sm font-normal font-sans text-zinc-600 dark:text-zinc-400">{completedAssignments} of {totalAssignments}</span></dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-600 dark:text-zinc-400">Focus sessions</dt>
          <dd className="font-display tabular-nums text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{pomodorosCompleted}<span className="ml-2 text-sm font-normal font-sans text-zinc-600 dark:text-zinc-400">about {focusHours} h</span></dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-600 dark:text-zinc-400">{scale === 'us4' ? 'Projected GPA' : 'Average so far'}</dt>
          <dd className="font-display tabular-nums text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{overall.hasData ? overall.value : '—'}<span className="ml-2 text-sm font-normal font-sans text-zinc-600 dark:text-zinc-400">{overall.hasData ? (overall.standing ?? overall.unit) : 'Add graded work in Grades'}</span></dd>
        </div>
      </dl>}

      {assignments.length > 0 && !assignments.some((a) => !a.sample && a.status === 'completed') && <GettingStartedChecklist
        onOpenAddModal={onOpenAddModal || (() => setIsModalOpen(true))}
        onOpenBackup={onOpenBackup}
      />}


      {/* Main Content Split: Upcoming assignments and today's classes */}
      {showLists && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: upcoming assignments (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Upcoming deadlines</h2>
              <span className="tabular-nums text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {urgentAssignments.length} in queue
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={openAdd}
                className="text-xs font-medium text-zinc-800 dark:text-zinc-100 min-h-[44px] inline-flex items-center gap-1 py-2 px-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add assignment</span>
              </button>
              <button
                onClick={() => setActiveTab('assignments')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 min-h-[44px] inline-flex items-center gap-1 py-2 px-1 transition-colors group cursor-pointer"
              >
                <span>View all ({assignments.length})</span>
                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark overflow-hidden divide-y divide-zinc-200/70 dark:divide-zinc-800/70 shadow-2xs">
            {urgentAssignments.length === 0 ? (
              <div className="p-8 text-center">
                {assignments.length === 0 ? (
                  <>
                    <EmptyIllustration kind="assignments" className="h-24 w-32 mb-2" />
                    <h3 className="text-xs font-medium text-zinc-900 dark:text-zinc-100">No deadlines scheduled yet</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">Use the quick start card above or click “Add assignment” to begin.</p>
                  </>
                ) : (
                  <>
                    <EmptyIllustration kind="done" className="h-28 w-36 mb-2" />
                    <h3 className="text-xs font-medium text-zinc-900 dark:text-zinc-100">All assignments cleared</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">No urgent deadlines pending on your course.</p>
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
                        onClick={() => {
                          toggleAssignmentComplete(asg.id);
                          celebrate(asg.title);
                        }}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center -my-2 -ml-2 text-zinc-600 dark:text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors shrink-0 cursor-pointer"
                        title={`Mark "${asg.title}" complete`}
                        aria-label={`Mark "${asg.title}" complete`}
                      >
                        <Circle className="h-4 w-4" />
                      </button>

                      <div className="flex items-center gap-2 overflow-hidden min-w-0">
                        <span className="tabular-nums text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60 shrink-0">
                          {asg.course.split('—')[0].trim()}
                        </span>
                        
                        <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {asg.title}
                        </span>
                        {kindOf(asg) !== 'assignment' && <KindBadge kind={kindOf(asg)} />}

                        {asg.notes && (
                          <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate hidden md:inline">
                            — {asg.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Priority — monochrome text only, no color coding */}
                      <span className="tabular-nums text-xs text-zinc-600 dark:text-zinc-400 hidden sm:inline capitalize">
                        {asg.priority}
                      </span>

                      <button
                        type="button"
                        onClick={() => setEditing(asg)}
                        aria-label={`Edit assignment "${asg.title}"`}
                        title="Edit"
                        className="min-h-[44px] min-w-[44px] -my-2 flex items-center justify-center rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>

                      {/* Due Countdown — plain monospace, red only if overdue */}
                      <span
                        className={`tabular-nums text-xs  ${
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
                <EmptyIllustration kind="sunrise" className="h-20 w-28 mb-1" />
                <p className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">No lecture sessions scheduled today.</p>
              </div>
            ) : (
              todaysSessions.map((session) => {
                const isNow = nowClock >= session.startTime && nowClock < session.endTime;
                return (
                <div key={session.id} className="flex items-start gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80 last:border-0 last:pb-0">
                  <div className="w-14 shrink-0 text-right tabular-nums">
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{session.startTime}</span>
                    <span className="block text-xs text-zinc-600 dark:text-zinc-400">{session.endTime}</span>
                  </div>
                  <div className="h-full w-0.5 bg-zinc-400 dark:bg-zinc-600 shrink-0 self-stretch rounded-full" />
                  <div className="overflow-hidden min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="tabular-nums text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                        {session.course}
                      </span>
                      <span className="text-xs capitalize text-zinc-600 dark:text-zinc-400 tabular-nums">{session.type}</span>
                      {isNow && <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Now</span>}
                    </div>
                    <h3 className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{session.title}</h3>
                  </div>
                </div>
                );
              })
            )}
          </div>
        </div>
      </div>}

      <AssignmentModal
        isOpen={isModalOpen || (!!editing && editingStillExists)}
        onClose={() => {
          setIsModalOpen(false);
          setEditing(null);
        }}
        assignmentToEdit={editing}
      />

      {writing && <WritingSpace assignment={writing} onClose={() => setWriting(null)} />}
    </div>
  );
};
