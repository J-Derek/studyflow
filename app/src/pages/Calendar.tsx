import React, { useState, useMemo } from 'react';
import { Clock, ChevronLeft, ChevronRight, Plus, X, Download, RotateCcw } from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { exportTimetable } from '../lib/exportTimetable';
import type { StudySession } from '../types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const CalendarPage: React.FC = () => {
  const { sessions, addSession, deleteSession } = useStudyFlowStore();

  const [modalOpen, setModalOpen] = useState(false);
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
        dayName: name,
        dayNumber: i + 1,
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

  const handleAddSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !course) return;

    addSession({
      title,
      course,
      dayOfWeek,
      startTime,
      endTime,
      type: sessionType
    });

    setTitle('');
    setCourse('');
    setModalOpen(false);
  };

  return (
    <div className="space-y-5 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Timetable</h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 font-sans">Your weekly classes and study blocks.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => exportTimetable()}
            title="Export calendar to Apple Calendar, Google Calendar, or Outlook (.ics)"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-surface-dark hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-xs transition shadow-2xs active:scale-95"
          >
            <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:inline tabular-nums">Export .ICS</span>
          </button>

          <div className="flex items-center gap-1 bg-surface-light dark:bg-surface-dark border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg p-0.5 shadow-2xs">
            <button
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="p-1 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
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
              className="p-1 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              aria-label="Next week"
              title="Next week"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs transition"
              title="Return to current week"
              aria-label="Return to current week"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white/90 text-white dark:text-zinc-900 font-medium text-xs transition shadow-2xs active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> <span>Add Block</span>
          </button>
        </div>
      </div>

      {/* Empty State Onboarding Guidance */}
      {sessions.length === 0 && (
        <div className="p-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Your weekly class schedule is empty
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              Add your lectures, labs, and study blocks to organize your week, or load demo courses from the Help menu (?).
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[44px] rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium shrink-0 cursor-pointer shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Class Block</span>
          </button>
        </div>
      )}

      {/* Unified 7-Day Continuous Calendar Grid (Cron / Notion Calendar Architecture) */}
      <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark shadow-2xs overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-zinc-200/80 dark:divide-zinc-800/80 min-h-[500px]">
          {weekDays.map((day) => {
            const daySessions = sessions.filter((s) => s.dayOfWeek === day.dayNumber);

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
                      <span className="text-xs tabular-nums font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">{day.dayName}</span>
                      <h3 className="text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <span>{day.monthName} {day.dateNumber}</span>
                        {day.isToday && (
                          <span className="text-xs tabular-nums px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-semibold">Today</span>
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
                          className={`p-2 rounded-md border text-xs transition relative group border-l-[3px] ${
                            session.type === 'lecture'
                              ? 'border-l-blue-600 border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-850/60 text-zinc-900 dark:text-zinc-100'
                              : session.type === 'lab'
                              ? 'border-l-purple-600 border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-850/60 text-zinc-900 dark:text-zinc-100'
                              : session.type === 'review'
                              ? 'border-l-amber-600 border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-850/60 text-zinc-900 dark:text-zinc-100'
                              : 'border-l-emerald-600 border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-850/60 text-zinc-900 dark:text-zinc-100'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="tabular-nums text-xs font-medium text-zinc-600 dark:text-zinc-400">
                              {session.course.split('—')[0].trim()}
                            </span>
                            <button
                              onClick={() => deleteSession(session.id)}
                              className="opacity-0 group-hover:opacity-100 transition p-0.5 hover:text-rose-600 dark:hover:text-rose-400"
                              title="Delete block"
                              aria-label={`Delete block ${session.title}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                          
                          <h5 className="font-medium text-zinc-900 dark:text-zinc-100 text-xs leading-snug line-clamp-2">{session.title}</h5>
                          
                          <div className="mt-1 flex items-center gap-1 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                            <Clock className="h-2.5 w-2.5" />
                            <span>
                              {session.startTime} - {session.endTime}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Quick Add slot button */}
                <button
                  onClick={() => {
                    setDayOfWeek(day.dayNumber);
                    setModalOpen(true);
                  }}
                  className="mt-3 w-full py-1 rounded-md border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700 text-xs tabular-nums transition"
                >
                  + Add Block
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Session Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in motion-reduce:animate-none">
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl w-full max-w-md shadow-2xl border border-zinc-200/80 dark:border-zinc-800/80 overflow-hidden transition-colors">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-850/40">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Add a block</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                title="Close modal"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddSession} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Session Title
                </label>
                <input
                  type="text"
                  required
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
                  placeholder="e.g. CS 4400"
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
                      <option key={d} value={i + 1}>
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

              <div className="pt-2 flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-md text-xs font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white/90 transition shadow-2xs"
                >
                  Add Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
