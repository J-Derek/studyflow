import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Flame, 
  Pencil, 
  PenLine, 
  Plus,
  CloudOff,
  Sparkles
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
import { SignInButton } from '../components/SignInButton';
import { GettingStartedChecklist } from '../components/GettingStartedChecklist';

interface DashboardProps {
  onOpenAddModal?: () => void;
  onOpenBackup?: () => void;
}

const INSIGHT_MESSAGES = [
  { icon: '🎯', text: 'Every 25-minute session compounds. Even one block today moves the needle.' },
  { icon: '📖', text: 'Spaced repetition beats cramming. Review lecture highlights before bed.' },
  { icon: '⚡', text: 'Start with the easiest task to gain momentum, then tackle harder problem sets.' },
  { icon: '🧠', text: 'Your brain consolidates memory during sleep. Prioritise recovery alongside study.' },
  { icon: '🗓️', text: 'Breaking big milestones into subtasks makes you 3× more likely to finish early.' },
  { icon: '🔥', text: 'Consistency beats intensity. 2 hours daily compounds faster than a weekend all-nighter.' },
  { icon: '🌅', text: 'Early focus blocks enjoy lower cognitive fatigue. Lock in difficult concepts first.' },
];

export const Dashboard: React.FC<DashboardProps> = ({ 
  onOpenAddModal, 
  onOpenBackup 
}) => {
  const isAnonymous = !useAccountView().signedIn;
  const { 
    focusMinutes, 
    guestNoticeDismissed, 
    dismissGuestNotice, 
    assignments, 
    sessions, 
    grades, 
    user, 
    pomodorosCompleted, 
    setActiveTab, 
    toggleAssignmentComplete 
  } = useStudyFlowStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [writing, setWriting] = useState<Assignment | null>(null);

  // If the assignment is deleted elsewhere while its dialog is open, close the dialog
  const editingStillExists = !editing || assignments.some((a) => a.id === editing.id);

  // Recently saved indicator
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

  // Personalized Academic Greeting
  const firstName = useMemo(() => {
    if (!user.name || user.name.trim() === 'Student') return null;
    return user.name.trim().split(' ')[0];
  }, [user.name]);

  const timeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  const contextSubline = useMemo(() => {
    if (pendingAssignments.length === 0) {
      return "You're all caught up — enjoy your day 🎉";
    }
    if (pendingAssignments.length <= 2) {
      return `You have ${pendingAssignments.length} ${pendingAssignments.length === 1 ? 'deadline' : 'deadlines'} coming up — stay on track 🔥`;
    }
    return `${pendingAssignments.length} deadlines queued — let's chip away at them session by session 💪`;
  }, [pendingAssignments.length]);

  // Semester Progress Tracker
  const semesterProgress = useMemo(() => {
    if (!user.semesterStart || !user.semesterEnd) return null;
    const start = new Date(user.semesterStart).getTime();
    const end = new Date(user.semesterEnd).getTime();
    const now = Date.now();
    if (end <= start) return null;

    const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.max(0, Math.round((now - start) / (1000 * 60 * 60 * 24)));
    const pct = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));

    const currentWeek = Math.max(1, Math.ceil(elapsedDays / 7));
    const totalWeeks = Math.max(1, Math.round(totalDays / 7));

    return { pct, currentWeek: Math.min(currentWeek, totalWeeks), totalWeeks };
  }, [user.semesterStart, user.semesterEnd]);

  // Daily Rotating Insight
  const dailyInsight = useMemo(() => {
    const dayIndex = new Date().getDate() % INSIGHT_MESSAGES.length;
    return INSIGHT_MESSAGES[dayIndex]!;
  }, []);

  // Urgent / Upcoming assignments sorted by due date
  const urgentAssignments = selectPendingDeadlines(pendingAssignments).slice(0, 4);
  const nextUp = urgentAssignments[0];
  const nextUpDue = nextUp ? getDaysRemaining(nextUp.dueDate) : { label: '', isUrgent: false };

  // Today's Day of Week (0 = Sun, 1 = Mon, ..., 6 = Sat) sorted by start time
  const currentDayOfWeek = new Date().getDay();
  const todaysSessions = useMemo(() => {
    return sessions
      .filter((s) => s.dayOfWeek === currentDayOfWeek)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [sessions, currentDayOfWeek]);

  // Current or next active class indicator
  const nowTimeString = useMemo(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }, []);

  const showSignInBanner = isAnonymous && assignments.length === 0;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* High-HCI Hero Greeting & Academic Command Cockpit */}
      <div className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
              <span>{timeGreeting}</span>
              {firstName && (
                <>
                  {', '}
                  <span className="text-brand-navy dark:text-brand-gold">{firstName}</span>
                </>
              )}
              <span className="ml-2 inline-block">👋</span>
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-mono text-xs">{todayLabel}</span>
              {' · '}
              <span>{contextSubline}</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <span className="sf-aura rounded-lg">
              <button
                onClick={() => setActiveTab('timer')}
                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-lg bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy font-semibold text-sm transition-all duration-150 active:scale-95 cursor-pointer shadow-2xs hover:opacity-90"
              >
                <Flame className="h-4 w-4" aria-hidden="true" />
                <span>Start focus timer</span>
              </button>
            </span>
          </div>
        </div>

        {/* Semester Progress Meter (if dates configured) */}
        {semesterProgress && (
          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark px-4 py-2.5 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-600 dark:text-zinc-400 mb-1.5">
              <span>{user.semester || 'Current semester'}</span>
              <span className="text-brand-navy dark:text-brand-gold font-medium">
                Week {semesterProgress.currentWeek} of {semesterProgress.totalWeeks} ({semesterProgress.pct}%)
              </span>
            </div>
            <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-gold rounded-full transition-all duration-500"
                style={{ width: `${semesterProgress.pct}%` }}
              />
            </div>
          </div>
        )}

        {/* At-a-Glance Interactive Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-full text-xs font-mono border border-zinc-200/80 dark:border-zinc-800 bg-surface-light dark:bg-surface-dark hover:border-brand-gold/60 hover:text-brand-navy dark:hover:text-brand-gold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer shadow-2xs"
          >
            <span>📚</span>
            <span>{todaysSessions.length} {todaysSessions.length === 1 ? 'class' : 'classes'} today</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timer')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-full text-xs font-mono border border-zinc-200/80 dark:border-zinc-800 bg-surface-light dark:bg-surface-dark hover:border-brand-gold/60 hover:text-brand-navy dark:hover:text-brand-gold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer shadow-2xs"
          >
            <span>⏱</span>
            <span>{pomodorosCompleted} focus {pomodorosCompleted === 1 ? 'session' : 'sessions'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('courses')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-full text-xs font-mono border border-zinc-200/80 dark:border-zinc-800 bg-surface-light dark:bg-surface-dark hover:border-brand-gold/60 hover:text-brand-navy dark:hover:text-brand-gold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer shadow-2xs"
          >
            <span>📊</span>
            <span>GPA: {overall.hasData ? overall.value : '—'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('assignments')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-full text-xs font-mono border border-zinc-200/80 dark:border-zinc-800 bg-surface-light dark:bg-surface-dark hover:border-brand-gold/60 hover:text-brand-navy dark:hover:text-brand-gold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer shadow-2xs"
          >
            <span>🎯</span>
            <span>{pendingAssignments.length} pending</span>
          </button>
        </div>
      </div>

      {/* Guest data-safety nudge — only when user has real data, dismissable, no sign-in button here */}
      {isAnonymous && !guestNoticeDismissed && !justSaved && assignments.some((a) => !a.sample) && (
        <div role="note" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CloudOff className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
            <p>Your data is saved on this device only — sign in from the header to back it up.</p>
          </div>
          <button type="button" onClick={dismissGuestNotice} className="shrink-0 px-3 py-1.5 min-h-[44px] rounded-md text-xs font-medium cursor-pointer hover:underline text-zinc-500">
            Dismiss
          </button>
        </div>
      )}

      {/* Busy Week Cluster Warning */}
      <BusyWeekNotice assignments={assignments} />

      {/* Daily Rotating Academic Insight (shown when user has active work) */}
      {assignments.length > 0 && (
        <div className="rounded-xl border border-brand-gold/30 dark:border-brand-gold/20 bg-brand-gold/5 dark:bg-brand-gold/8 px-4 py-3 flex items-start gap-3 shadow-2xs">
          <span className="text-xl leading-none shrink-0 mt-0.5 select-none" aria-hidden="true">{dailyInsight.icon}</span>
          <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            <strong className="font-semibold text-brand-navy dark:text-brand-gold">Daily strategy: </strong>
            {dailyInsight.text}
          </p>
        </div>
      )}

      {/* Zero State Activation Hero */}
      {assignments.length === 0 && (
        <FirstDeadlineCard />
      )}

      {/* Sign-in Banner for Returning Students (no assignments yet) */}
      <div
        data-testid="signin-banner"
        aria-hidden={!showSignInBanner}
        inert={!showSignInBanner}
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark px-4 overflow-hidden transition-[max-height,opacity,margin,padding,border-width] duration-300 ease-out motion-reduce:transition-none ${
          showSignInBanner ? 'py-3 max-h-60 opacity-100' : 'max-h-0 opacity-0 !py-0 !mt-0 !border-0'
        }`}
      >
        <p className="text-sm text-zinc-700 dark:text-zinc-300">Already use StudyFlow on another device? Sign in to see your plan here.</p>
        <div className="sm:w-60 shrink-0">
          <SignInButton />
        </div>
      </div>

      {/* Confirmation Banner */}
      {justSaved && (
        <p role="status" className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 text-sm text-emerald-900 dark:text-emerald-200">
          Saved “{justSaved}”. Use <strong>Edit</strong> to change it, or <strong>Add assignment</strong> to add more.
        </p>
      )}

      {/* Next Up Hero Card: High-HCI Single Priority Focus */}
      {nextUp && (
        <section aria-labelledby="next-up-heading" className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark p-5 md:p-7 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <h2 id="next-up-heading" className="text-xs uppercase tracking-wider font-mono font-semibold text-zinc-500 dark:text-zinc-400">
              Next up
            </h2>
            <span className={`tabular-nums text-xs font-mono font-medium px-2 py-0.5 rounded-full ${nextUpDue.isUrgent ? 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
              {nextUpDue.label}
            </span>
          </div>

          <p className="mt-2.5 font-serif text-3xl md:text-5xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50 break-words">
            {nextUp.title}
          </p>

          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-medium font-mono text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
              {nextUp.course.split('—')[0].trim()}
            </span>
            {kindOf(nextUp) !== 'assignment' && <KindBadge kind={kindOf(nextUp)} />}
            {nextUp.subtasks && nextUp.subtasks.length > 0 && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                {nextUp.subtasks.filter((s) => s.completed).length}/{nextUp.subtasks.length} subtasks
              </span>
            )}
          </p>

          {nextUp.notes && (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap line-clamp-3">
              {nextUp.notes}
            </p>
          )}

          {/* Action Row: Mark Done, Deep Focus (25m), Edit, Write */}
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => {
                toggleAssignmentComplete(nextUp.id);
                celebrate(nextUp.title);
              }}
              className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-white/90 active:scale-98 cursor-pointer shadow-2xs transition-all"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>Mark done</span>
            </button>

            {/* Seamless Today-to-Timer workflow */}
            <button
              type="button"
              onClick={() => setActiveTab('timer')}
              className="inline-flex items-center gap-1.5 px-3.5 min-h-[44px] rounded-lg border border-amber-300/80 dark:border-amber-700/80 bg-amber-50/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-sm font-medium hover:bg-amber-100/70 dark:hover:bg-amber-900/40 active:scale-98 cursor-pointer transition-colors"
              title="Start a 25-minute Pomodoro block on this deadline"
            >
              <Flame className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span>Focus (25m)</span>
            </button>

            <button
              type="button"
              onClick={() => setEditing(nextUp)}
              className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-100 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-98 cursor-pointer transition-colors"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              <span>Edit</span>
            </button>

            <button
              type="button"
              onClick={() => setWriting(nextUp)}
              className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-100 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-98 cursor-pointer transition-colors"
            >
              <PenLine className="h-4 w-4" aria-hidden="true" />
              <span>Write</span>
            </button>
          </div>
        </section>
      )}

      {/* High-Craft Tabular Statistics Panel */}
      <dl className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark p-4 sm:p-5 grid grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 divide-zinc-200/60 dark:divide-zinc-800/60 shadow-2xs">
        <div className="pt-2 sm:pt-0">
          <dt className="text-xs uppercase font-mono tracking-wider text-zinc-500 dark:text-zinc-400">To do</dt>
          <dd className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 mt-1">
            {pendingAssignments.length}
          </dd>
        </div>
        <div className="pt-2 sm:pt-0">
          <dt className="text-xs uppercase font-mono tracking-wider text-zinc-500 dark:text-zinc-400">Completed</dt>
          <dd className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 mt-1">
            {completionRate}%
            <span className="ml-2 text-xs font-normal font-sans text-zinc-500 dark:text-zinc-400">
              {completedAssignments} of {totalAssignments}
            </span>
          </dd>
        </div>
        <div className="pt-2 sm:pt-0">
          <dt className="text-xs uppercase font-mono tracking-wider text-zinc-500 dark:text-zinc-400">Focus sessions</dt>
          <dd className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 mt-1">
            {pomodorosCompleted}
            <span className="ml-2 text-xs font-normal font-sans text-brand-gold dark:text-brand-gold font-medium">
              {pomodorosCompleted >= 7 ? '🔥 On a roll!' : pomodorosCompleted >= 3 ? '⚡ In the flow' : `about ${focusHours} h`}
            </span>
          </dd>
        </div>
        <div className="pt-2 sm:pt-0">
          <dt className="text-xs uppercase font-mono tracking-wider text-zinc-500 dark:text-zinc-400">
            {scale === 'us4' ? 'Projected GPA' : 'Average so far'}
          </dt>
          <dd className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 mt-1">
            {overall.hasData ? overall.value : '—'}
            <span className="ml-2 text-xs font-normal font-sans text-zinc-500 dark:text-zinc-400">
              {overall.hasData ? (overall.standing ?? overall.unit) : 'Add graded work'}
            </span>
          </dd>
        </div>
      </dl>

      {/* Suggested Action Nudge Strip (when work is queued) */}
      {nextUp && (
        <div className="rounded-xl border border-dashed border-brand-gold/40 dark:border-brand-gold/30 bg-surface-light/60 dark:bg-surface-dark/60 p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 text-brand-gold shrink-0" aria-hidden="true" />
            <p className="text-zinc-700 dark:text-zinc-300 truncate">
              {nextUpDue.isUrgent ? (
                <><strong>Priority deadline:</strong> “{nextUp.title}” is due soon.</>
              ) : pomodorosCompleted === 0 ? (
                <><strong>Start momentum:</strong> Jump into a 25-minute Pomodoro for “{nextUp.title}”.</>
              ) : (
                <><strong>Up next:</strong> Keep the flow going on “{nextUp.title}”.</>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('timer')}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy font-semibold hover:opacity-90 active:scale-95 transition-all cursor-pointer self-start sm:self-auto"
          >
            <Flame className="h-3.5 w-3.5" />
            <span>Focus on this</span>
          </button>
        </div>
      )}

      {/* Onboarding Checklist if new */}
      {assignments.length > 0 && !assignments.some((a) => !a.sample && a.status === 'completed') && (
        <GettingStartedChecklist
          onOpenAddModal={onOpenAddModal || (() => setIsModalOpen(true))}
          onOpenBackup={onOpenBackup}
        />
      )}

      {/* Main Content Split: Upcoming Deadlines & Today's Classes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Upcoming Deadlines Queue (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Upcoming deadlines</h2>
              <span className="tabular-nums font-mono text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">
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
                        <span className="tabular-nums font-mono text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60 shrink-0">
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
                      <span className="tabular-nums text-xs text-zinc-500 dark:text-zinc-400 hidden sm:inline capitalize">
                        {asg.priority}
                      </span>

                      <button
                        type="button"
                        onClick={() => setEditing(asg)}
                        aria-label={`Edit assignment "${asg.title}"`}
                        title="Edit"
                        className="min-h-[44px] min-w-[44px] -my-2 flex items-center justify-center rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>

                      <span
                        className={`tabular-nums font-mono text-xs font-medium ${
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

        {/* Right: Today's Classes Timeline (1 col) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Today’s classes</h2>
            <button
              onClick={() => setActiveTab('calendar')}
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 min-h-[44px] inline-flex items-center py-2 px-1 transition-colors cursor-pointer"
            >
              Full week →
            </button>
          </div>

          <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 space-y-3 shadow-2xs">
            {todaysSessions.length === 0 ? (
              <div className="py-6 text-center">
                <EmptyIllustration kind="sunrise" className="h-20 w-28 mb-1" />
                <p className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">No lecture sessions scheduled today.</p>
              </div>
            ) : (
              todaysSessions.map((session) => {
                const isNow = nowTimeString >= session.startTime && nowTimeString <= session.endTime;
                return (
                  <div key={session.id} className="flex items-start gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80 last:border-0 last:pb-0">
                    <div className="w-14 shrink-0 text-right tabular-nums font-mono">
                      <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{session.startTime}</span>
                      <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">{session.endTime}</span>
                    </div>
                    <div className={`h-full w-0.5 shrink-0 self-stretch rounded-full ${isNow ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
                    <div className="overflow-hidden min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="tabular-nums font-mono text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                          {session.course}
                        </span>
                        <span className="text-xs capitalize text-zinc-500 dark:text-zinc-400 tabular-nums">{session.type}</span>
                        {isNow && (
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60">
                            Now
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{session.title}</h3>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

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
