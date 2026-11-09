import React, { useState, useMemo } from 'react';
import { Clock, ChevronLeft, ChevronRight, Plus, X, Download, RotateCcw, CalendarDays, CalendarRange } from 'lucide-react';
import { EmptyIllustration } from '../components/EmptyIllustration';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { useDialog } from '../lib/useDialog';
import { exportTimetable } from '../lib/exportTimetable';
import { clashingIds, findClashes, toMinutes } from '../utils/timetable';
import type { StudySession } from '../types';
import { Legend } from '../components/Legend';
import { CLASS_TYPE_META } from '../utils/kinds';
import { LIMITS, localDateISO } from '../utils/limits';
import type { Assignment } from '../types';
import { MonthGrid } from '../components/MonthGrid';
import { DaySheet } from '../components/DaySheet';
import { AssignmentModal } from '../components/AssignmentModal';
import { KindBadge } from '../components/KindBadge';
import { classesOn, deadlinesByDate, monthLabel, selectPendingDeadlines } from '../utils/calendarMonth';
import { kindOf } from '../utils/kinds';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const CalendarPage: React.FC = () => {
  const { sessions, assignments, addSession, updateSession, deleteSession } = useStudyFlowStore();

  // Week or month, which month is shown, the day whose list is open, and the deadline being added or edited from a day.
  const [view, setView] = useState<'week' | 'month'>('week');
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [deadlineDialog, setDeadlineDialog] = useState<{ date?: string; edit?: Assignment } | null>(null);
  const todayISO = localDateISO();
  const deadlines = useMemo(() => deadlinesByDate(assignments, { withoutSample: false }), [assignments]);
  const dueSoon = useMemo(() => selectPendingDeadlines(assignments).slice(0, 3), [assignments]);
  const stepMonth = (by: number) =>
    setMonthCursor((c) => {
      const t = c.year * 12 + (c.month - 1) + by;
      return { year: Math.floor(t / 12), month: (t % 12) + 1 };
    });

  const [modalOpen, setModalOpen] = useState(false);
  // The block being edited, or null when adding a new one.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:30');
  const [sessionType, setSessionType] = useState<StudySession['type']>('lecture');

  const weekDays = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday + weekOffset * 7);

    return DAYS.map((name, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isToday = d.toDateString() === now.toDateString();
      return {
        date: localDateISO(d),
        dayName: name,
        dayNumber: (i + 1) % 7, // Mon = 1 ... Sat = 6, Sun = 0 (same as StudySession.dayOfWeek)
        dateNumber: d.getDate(),
        monthName: d.toLocaleDateString('en-US', { month: 'short' }),
        isToday
      };
    });
  }, [weekOffset]);

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length < 7) return 'Week 10';
    const first = weekDays[0];
    const last = weekDays[6];
    return `${first.monthName} ${first.dateNumber} – ${last.monthName} ${last.dateNumber}`;
  }, [weekDays]);

  const clashing = useMemo(() => clashingIds(sessions), [sessions]);
  const timesInvalid = toMinutes(endTime) <= toMinutes(startTime);
  const newClashes = useMemo(
    () =>
      timesInvalid
        ? []
        : findClashes(
            sessions.filter((s) => s.id !== editingId),
            { dayOfWeek, startTime, endTime }
          ),
    [sessions, editingId, dayOfWeek, startTime, endTime, timesInvalid]
  );

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };
  const dialogRef = useDialog(modalOpen, closeModal);

  const openAdd = (day?: number) => {
    setEditingId(null);
    setTitle('');
    setCourse('');
    setStartTime('10:00');
    setEndTime('11:30');
    setSessionType('lecture');
    if (day !== undefined) setDayOfWeek(day);
    setModalOpen(true);
  };

  const openEdit = (session: StudySession) => {
    setEditingId(session.id);
    setTitle(session.title);
    setCourse(session.course);
    setDayOfWeek(session.dayOfWeek);
    setStartTime(session.startTime);
    setEndTime(session.endTime);
    setSessionType(session.type);
    setModalOpen(true);
  };

  const handleSaveSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !course.trim() || timesInvalid) return;

    const data = { title: title.trim(), course: course.trim(), dayOfWeek, startTime, endTime, type: sessionType };
    if (editingId) updateSession(editingId, data);
    else addSession(data);
    closeModal();
  };

  const handleDeleteEditing = () => {
    if (!editingId) return;
    if (!window.confirm('Delete this block?')) return;
    deleteSession(editingId);
    closeModal();
  };

  return (
    <div className="space-y-5 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Timetable</h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 font-sans">Your weekly classes and study blocks.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => exportTimetable()}
            title="Export calendar to Apple Calendar, Google Calendar, or Outlook (.ics)"
            className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-surface-dark hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-xs transition shadow-2xs active:scale-95"
          >
            <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:inline tabular-nums">Export .ICS</span>
          </button>

          <div role="group" aria-label="Calendar view" className="flex items-center gap-1 bg-surface-light dark:bg-surface-dark border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg p-0.5 shadow-2xs">
            {(['week', 'month'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] md:min-h-0 px-3 py-1 rounded text-xs font-medium capitalize transition-colors cursor-pointer ${
                  view === v ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {v === 'week' ? <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" /> : <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />}
                {v}
              </button>
            ))}
          </div>

          {view === 'month' && (
            <div className="flex items-center gap-1 bg-surface-light dark:bg-surface-dark border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg p-0.5 shadow-2xs">
              <button
                onClick={() => stepMonth(-1)}
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 p-1 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span data-testid="month-label" className="text-xs tabular-nums font-medium text-zinc-800 dark:text-zinc-200 px-2 min-w-[120px] text-center">
                {monthLabel(monthCursor.year, monthCursor.month)}
              </span>
              <button
                onClick={() => stepMonth(1)}
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 p-1 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                aria-label="Next month"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {view === 'week' && (
          <div className="flex items-center gap-1 bg-surface-light dark:bg-surface-dark border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg p-0.5 shadow-2xs">
            <button
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 p-1 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              aria-label="Previous week"
              title="Previous week"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs tabular-nums font-medium text-zinc-800 dark:text-zinc-200 px-2 min-w-[140px] text-center">
              {weekRangeLabel}
            </span>
            <button
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 p-1 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              aria-label="Next week"
              title="Next week"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          )}

          {view === 'week' && weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs transition"
              title="Return to current week"
              aria-label="Return to current week"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          
          <button
            onClick={() => openAdd()}
            className="min-h-[44px] md:min-h-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white/90 text-white dark:text-zinc-900 font-medium text-xs transition shadow-2xs active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> <span>Add Block</span>
          </button>
        </div>
      </div>

      {/* Empty State Onboarding Guidance */}
      {sessions.length === 0 && (
        <div className="p-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <EmptyIllustration kind="timetable" className="hidden sm:block h-20 w-28 mx-0 shrink-0" />
            <div>
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Your weekly class schedule is empty
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                Add your lectures, labs, and study blocks to organize your week, or load demo courses from the Help menu (?).
              </p>
            </div>
          </div>
          <button
            onClick={() => openAdd()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[44px] rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium shrink-0 cursor-pointer shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add a class</span>
          </button>
        </div>
      )}

      {dueSoon.length > 0 && (
        <section aria-label="Due soon" data-testid="due-soon" className="rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark px-3 py-2 text-xs">
          <h2 className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Due soon</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {dueSoon.map((a) => (
              <li key={a.id} className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 [overflow-wrap:anywhere]">
                <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{a.dueDate.slice(5)}</span>
                {a.title}
                {kindOf(a) !== 'assignment' && <KindBadge kind={kindOf(a)} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Legend show={view === 'month' ? ['month', 'classTypes', 'kinds'] : ['classTypes', 'kinds']} />

      {view === 'month' && (
        <MonthGrid year={monthCursor.year} month={monthCursor.month} sessions={sessions} deadlines={deadlines} today={todayISO} onSelectDay={setSelectedDate} />
      )}

      {/* Unified 7-Day Continuous Calendar Grid (Cron / Notion Calendar Architecture) */}
      {view === 'week' && (
      <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark shadow-2xs overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-zinc-200/80 dark:divide-zinc-800/80 min-h-[500px]">
          {weekDays.map((day) => {
            const daySessions = sessions
              .filter((s) => s.dayOfWeek === day.dayNumber)
              .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

            return (
              <div
                key={day.dayName}
                className={`p-3 flex flex-col justify-between transition-colors ${
                  day.isToday 
                    ? 'bg-blue-50/20 dark:bg-blue-950/20' 
                    : ''
                }`}
              >
                <div>
                  {/* Day Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800/80 mb-2.5">
                    <div>
                      <span className="text-xs tabular-nums font-medium text-zinc-600 dark:text-zinc-400">{day.dayName}</span>
                      <h3 className="text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <span>{day.monthName} {day.dateNumber}</span>
                        {day.isToday && (
                          <span className="text-xs tabular-nums px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-semibold">Today</span>
                        )}
                      </h3>
                    </div>
                    {day.isToday && (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                    )}
                  </div>

                  {/* Day's Scheduled Blocks */}
                  <div className="space-y-2">
                    {daySessions.length === 0 ? (
                      <div className="py-12 text-center text-zinc-600 dark:text-zinc-400">
                        <p className="text-xs tabular-nums">No blocks</p>
                      </div>
                    ) : (
                      daySessions.map((session) => (
                        <div
                          key={session.id}
                          data-class-type={session.type}
                          className={`rounded-md border border-l-4 text-xs transition relative group bg-zinc-50/70 dark:bg-zinc-850/60 text-zinc-900 dark:text-zinc-100 ${
                            CLASS_TYPE_META[session.type]?.edge ?? 'border-l-zinc-400'
                          } ${clashing.has(session.id) ? 'border-amber-400 dark:border-amber-600' : 'border-zinc-200/80 dark:border-zinc-800/80'}`}
                        >
                          <button
                            type="button"
                            onClick={() => openEdit(session)}
                            title="Tap to edit"
                            className="block w-full min-h-[44px] text-left p-2 pr-8 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 cursor-pointer"
                          >
                            <span className="block tabular-nums text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">
                              <span className="sr-only">Edit </span>
                              {session.course.split('—')[0].trim()}
                              <span className="font-normal"> · {CLASS_TYPE_META[session.type]?.label ?? session.type}</span>
                            </span>
                            <span className="block font-medium text-zinc-900 dark:text-zinc-100 text-xs leading-snug line-clamp-2">{session.title}</span>
                            <span className="mt-1 flex items-center gap-1 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                              <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                              {session.startTime} - {session.endTime}
                            </span>
                            {clashing.has(session.id) && (
                              <span className="mt-1 block text-xs font-medium text-amber-800 dark:text-amber-300">Clashes with another block</span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSession(session.id)}
                            className="hidden [@media(hover:hover)]:block absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus:opacity-100 transition p-1 hover:text-rose-600 dark:hover:text-rose-400"
                            title="Delete block"
                            aria-label={`Delete block ${session.title}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Deadlines due on this day */}
                  {(deadlines.get(day.date) ?? []).length > 0 && (
                    <ul aria-label={`Deadlines on ${day.dayName} ${day.dateNumber}`} data-testid="week-deadlines" className="mt-2 space-y-1">
                      {(deadlines.get(day.date) ?? []).map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => setDeadlineDialog({ edit: a })}
                            className="w-full min-h-[44px] flex items-center gap-1.5 rounded-md border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 px-2 py-1 text-left text-xs cursor-pointer hover:bg-rose-100/70 dark:hover:bg-rose-950/50"
                          >
                            <span className={`flex-1 min-w-0 [overflow-wrap:anywhere] ${a.status === 'completed' ? 'line-through text-zinc-600 dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                              <span className="sr-only">Deadline: </span>
                              {a.title}
                            </span>
                            {kindOf(a) !== 'assignment' && <KindBadge kind={kindOf(a)} />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Quick Add slot button */}
                <button
                  onClick={() => openAdd(day.dayNumber)}
                  className="min-h-[44px] md:min-h-0 mt-3 w-full py-1 rounded-md border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700 text-xs tabular-nums transition"
                >
                  + Add Block
                </button>
              </div>
            );
          })}
        </div>
      </div>
      )}

      <DaySheet
        date={selectedDate}
        classes={selectedDate ? classesOn(sessions, selectedDate) : []}
        deadlines={selectedDate ? (deadlines.get(selectedDate) ?? []) : []}
        onClose={() => setSelectedDate(null)}
        onAddDeadline={(date) => {
          setSelectedDate(null);
          setDeadlineDialog({ date });
        }}
        onAddClass={(dow) => {
          setSelectedDate(null);
          openAdd(dow);
        }}
        onEditDeadline={(a) => {
          setSelectedDate(null);
          setDeadlineDialog({ edit: a });
        }}
        onEditClass={(s) => {
          setSelectedDate(null);
          openEdit(s);
        }}
      />

      <AssignmentModal
        isOpen={deadlineDialog !== null}
        onClose={() => setDeadlineDialog(null)}
        assignmentToEdit={deadlineDialog?.edit ?? null}
        initialDueDate={deadlineDialog?.date}
      />

      {/* Add Session Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in motion-reduce:animate-none"
          onClick={closeModal}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? 'Edit block' : 'Add a block'}
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-light dark:bg-surface-dark rounded-xl w-full max-w-md shadow-2xl border border-zinc-200/80 dark:border-zinc-800/80 overflow-hidden transition-colors max-h-[calc(100dvh-2rem)] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-850/40">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{editingId ? 'Edit block' : 'Add a block'}</h2>
              <button
                onClick={closeModal}
                className="p-1 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                title="Close modal"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Session Title
                </label>
                <input
                  type="text"
                  required
                  maxLength={LIMITS.blockTitle}
                  placeholder="e.g. Distributed Systems Lab"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Course Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={LIMITS.blockCourse}
                  placeholder="e.g. CS 101"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Day of Week
                  </label>
                  <select
                    aria-label="Day of the week"
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                  >
                    {DAYS.map((d, i) => (
                      <option key={d} value={(i + 1) % 7}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Type
                  </label>
                  <select
                    aria-label="Block type"
                    value={sessionType}
                    onChange={(e) => setSessionType(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                  >
                    <option value="lecture">Lecture</option>
                    <option value="lab">Lab</option>
                    <option value="study">Study</option>
                    <option value="review">Review</option>
                    <option value="exam">Exam</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    aria-label="Start time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    aria-label="End time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>

              {timesInvalid && (
                <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300">
                  The end time must be after the start time.
                </p>
              )}
              {newClashes.length > 0 && (
                <p role="status" className="text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 px-3 py-2">
                  This clashes with {newClashes.map((c) => `${c.title} (${c.startTime}-${c.endTime})`).join(', ')}. You can still add it.
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800">
                {editingId && (
                  <button
                    type="button"
                    onClick={handleDeleteEditing}
                    className="mr-auto px-3 py-1.5 rounded-md text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-md text-xs font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white/90 transition shadow-2xs"
                >
                  {editingId ? 'Save changes' : 'Add Block'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
