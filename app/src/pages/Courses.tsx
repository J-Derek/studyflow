import React, { lazy, Suspense, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Clock, NotebookPen } from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { courseSummary } from '../utils/courses';
import { gradeLabel, targetLabel } from '../utils/gradingScale';
import { getDaysRemaining } from '../utils/formatters';
import { kindOf, CLASS_TYPE_META } from '../utils/kinds';
import { KindBadge } from '../components/KindBadge';
import type { CourseGrade } from '../types';

// The grades calculator (weights, scores, what-if) is the page that used to be "Grades"; it stays, below the course list.
const GradesPage = lazy(() => import('./Grades').then((m) => ({ default: m.GradesPage })));

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function useSummaries(courses: CourseGrade[]) {
  const { assignments, sessions, notes } = useStudyFlowStore();
  return useMemo(() => new Map(courses.map((c) => [c.id, courseSummary(c, { assignments, sessions, notes })])), [courses, assignments, sessions, notes]);
}

/** Everything for one course on one screen: work that is still to do, work done, this course's classes, its notes and its grade. */
const CourseDetail: React.FC<{ course: CourseGrade; onBack: () => void }> = ({ course, onBack }) => {
  const summary = useSummaries([course]).get(course.id)!;
  const scale = useStudyFlowStore((s) => s.user.gradingScale) ?? 'us4';
  const setActiveTab = useStudyFlowStore((s) => s.setActiveTab);
  return (
    <div data-testid="course-detail" className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 min-h-[44px] -ml-2 px-2 text-sm text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All courses
      </button>
      <div>
        <h2 className="font-display text-2xl font-semibold text-zinc-900 dark:text-zinc-50 [overflow-wrap:anywhere]">
          {course.courseCode} <span className="font-normal text-zinc-700 dark:text-zinc-300">{course.courseName}</span>
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 tabular-nums">
          {course.credits} credits · target {targetLabel(scale, course.targetLetter)} · {summary.gradePct === null ? 'no grades yet' : `${summary.gradePct}% so far${scale === 'uk' || scale === 'ke' ? `, ${gradeLabel(scale, summary.gradePct)}` : ''}`}
        </p>
      </div>

      <section aria-label="Work still to do" className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">To do ({summary.pending.length})</h3>
        {summary.pending.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Nothing to do for this course. Add exams, tests and readings from Today or Assignments.</p>
        ) : (
          <ul className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark">
            {summary.pending.map((a) => (
              <li key={a.id} className="flex items-center gap-2 px-3 py-2.5 min-h-[44px] text-sm">
                <span className="flex-1 min-w-0 text-zinc-900 dark:text-zinc-100 [overflow-wrap:anywhere]">{a.title}</span>
                {kindOf(a) !== 'assignment' && <KindBadge kind={kindOf(a)} />}
                <span className="tabular-nums text-xs text-zinc-600 dark:text-zinc-400 shrink-0">{getDaysRemaining(a.dueDate).label}</span>
              </li>
            ))}
          </ul>
        )}
        {summary.done.length > 0 && <p className="text-xs text-zinc-600 dark:text-zinc-400">{summary.done.length} finished.</p>}
      </section>

      <section aria-label="Classes" className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Classes ({summary.classes.length})</h3>
        {summary.classes.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No classes in the timetable for this course.</p>
        ) : (
          <ul className="space-y-1">
            {summary.classes.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                <Clock className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" aria-hidden="true" />
                <span className="tabular-nums">{DAY[s.dayOfWeek]} {s.startTime} - {s.endTime}</span>
                <span className="text-zinc-600 dark:text-zinc-400">· {CLASS_TYPE_META[s.type]?.label ?? s.type}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Notes" className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notes ({summary.notes.length})</h3>
        {summary.notes.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No notes filed under this course.</p>
        ) : (
          <ul className="space-y-1">
            {summary.notes.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => setActiveTab('notes')} className="inline-flex items-center gap-2 min-h-[44px] text-sm text-blue-700 dark:text-blue-300 underline underline-offset-2 cursor-pointer text-left [overflow-wrap:anywhere]">
                  <NotebookPen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {n.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

/**
 * Courses: one card per course with what is still to do, the next deadline, classes, notes and the grade so far. Tap a card for the whole
 * course. The grades calculator (formerly the Grades page) follows below, where courses are added and weights and scores are set.
 */
export const CoursesPage: React.FC = () => {
  const { grades } = useStudyFlowStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const summaries = useSummaries(grades);
  const open = grades.find((c) => c.id === openId) ?? null;

  if (open) return <div className="space-y-6 animate-fade-in pb-16"><CourseDetail course={open} onBack={() => setOpenId(null)} /></div>;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      <div className="space-y-1">
        <h1 className="text-3xl md:text-4xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Courses</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Each course with its work, classes, notes and grade.</p>
      </div>

      {grades.length > 0 && (
        <ul data-testid="course-list" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {grades.map((c) => {
            const s = summaries.get(c.id)!;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(c.id)}
                  data-course={c.courseCode}
                  className="w-full h-full text-left p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors cursor-pointer space-y-2"
                >
                  <span className="flex items-start gap-2">
                    <BookOpen className="h-4 w-4 mt-0.5 shrink-0 text-zinc-600 dark:text-zinc-400" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block font-semibold text-zinc-900 dark:text-zinc-50 [overflow-wrap:anywhere]">{c.courseCode}</span>
                      <span className="block text-xs text-zinc-600 dark:text-zinc-400 [overflow-wrap:anywhere]">{c.courseName}</span>
                    </span>
                  </span>
                  <span className="block text-sm text-zinc-800 dark:text-zinc-200 tabular-nums">
                    {s.pending.length} to do · {s.classes.length} {s.classes.length === 1 ? 'class' : 'classes'} · {s.notes.length} {s.notes.length === 1 ? 'note' : 'notes'}
                  </span>
                  <span className="block text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
                    {s.nextDeadline ? `Next: ${s.nextDeadline.title}, ${getDaysRemaining(s.nextDeadline.dueDate).label}` : 'No deadlines'}
                    {' · '}
                    {s.gradePct === null ? 'no grades yet' : `${s.gradePct}% so far`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Suspense fallback={<p className="text-sm text-zinc-600 dark:text-zinc-400">Loading grades…</p>}>
        <GradesPage embedded />
      </Suspense>
    </div>
  );
};
