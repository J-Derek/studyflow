import React, { useState } from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  Flame, 
  Plus
} from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import type { Priority } from '../types';

interface FirstDeadlineCardProps {
  onSuccessFocus?: (assignmentTitle: string) => void;
}

export const FirstDeadlineCard: React.FC<FirstDeadlineCardProps> = ({ onSuccessFocus }) => {
  const { addAssignment, setActiveTab, setTimerMode } = useStudyFlowStore();
  
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('');
  const [priority, setPriority] = useState<Priority>('high');
  const [dueDate, setDueDate] = useState<string>('');
  const [activeChip, setActiveChip] = useState<'today' | 'tomorrow' | 'friday' | 'nextWeek' | 'custom'>('tomorrow');
  
  // Payoff state after saving
  const [savedAssignment, setSavedAssignment] = useState<{ id: string; title: string } | null>(null);

  // Helper date calculators
  const getCalculatedDate = (type: 'today' | 'tomorrow' | 'friday' | 'nextWeek'): string => {
    const now = new Date();
    if (type === 'today') {
      return now.toISOString().split('T')[0];
    }
    if (type === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    if (type === 'friday') {
      const friday = new Date(now);
      const day = now.getDay();
      const diff = (5 - day + 7) % 7 || 7;
      friday.setDate(now.getDate() + diff);
      return friday.toISOString().split('T')[0];
    }
    if (type === 'nextWeek') {
      const nextMon = new Date(now);
      const day = now.getDay();
      const diff = (8 - day + 7) % 7 || 7;
      nextMon.setDate(now.getDate() + diff);
      return nextMon.toISOString().split('T')[0];
    }
    return now.toISOString().split('T')[0];
  };

  // Initialize with tomorrow
  React.useEffect(() => {
    setDueDate(getCalculatedDate('tomorrow'));
  }, []);

  const handleChipClick = (type: 'today' | 'tomorrow' | 'friday' | 'nextWeek') => {
    setActiveChip(type);
    setDueDate(getCalculatedDate(type));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !course.trim()) return;

    const finalDate = dueDate || getCalculatedDate('tomorrow');
    addAssignment({
      title: title.trim(),
      course: course.trim(),
      dueDate: finalDate,
      dueTime: '23:59',
      priority,
      status: 'pending',
      progress: 0,
      subtasks: [
        { id: `st-${Date.now()}-1`, title: 'Review lecture notes & course guidelines', completed: false },
        { id: `st-${Date.now()}-2`, title: 'Draft initial outline or code prototype', completed: false }
      ]
    });

    setSavedAssignment({
      id: `saved-${Date.now()}`,
      title: title.trim()
    });
  };

  const handleStartFocus = () => {
    setTimerMode('focus');
    setActiveTab('timer');
    if (onSuccessFocus && savedAssignment) {
      onSuccessFocus(savedAssignment.title);
    }
  };

  if (savedAssignment) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 p-5 md:p-6 transition-all duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Assignment Saved
                </span>
                <span className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">Live countdown active</span>
              </div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
                "{savedAssignment.title}" is locked in.
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                Take immediate momentum: launch a focus round now or review your schedule.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 pt-2 sm:pt-0">
            <button
              onClick={handleStartFocus}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium text-xs hover:bg-zinc-800 dark:hover:bg-white/90 transition shadow-2xs cursor-pointer"
            >
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              <span>Launch Focus Round</span>
            </button>
            <button
              onClick={() => {
                setSavedAssignment(null);
                setTitle('');
                setCourse('');
              }}
              className="inline-flex items-center gap-1 px-3 py-2 min-h-[44px] rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Another</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark p-5 md:p-6 transition-colors shadow-2xs">
      <div className="space-y-1 mb-4">
        <h2 className="text-lg md:text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
          What is your next deadline?
        </h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Add an exam, paper or homework. StudyFlow shows how many days are left.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Assignment title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Problem Set 2 or Chapter 4 Summary"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Course
            </label>
            <input
              type="text"
              required
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              placeholder="e.g. CS 101 or Physics"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 min-h-[44px]"
            />
          </div>
        </div>

        {/* Date Quick Chips */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            When is it due?
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleChipClick('today')}
              className={`px-3 py-1.5 min-h-[44px] rounded-lg text-xs tabular-nums transition cursor-pointer ${
                activeChip === 'today'
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleChipClick('tomorrow')}
              className={`px-3 py-1.5 min-h-[44px] rounded-lg text-xs tabular-nums transition cursor-pointer ${
                activeChip === 'tomorrow'
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => handleChipClick('friday')}
              className={`px-3 py-1.5 min-h-[44px] rounded-lg text-xs tabular-nums transition cursor-pointer ${
                activeChip === 'friday'
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              This Friday
            </button>
            <button
              type="button"
              onClick={() => handleChipClick('nextWeek')}
              className={`px-3 py-1.5 min-h-[44px] rounded-lg text-xs tabular-nums transition cursor-pointer ${
                activeChip === 'nextWeek'
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              Next Week
            </button>

            {/* Custom Date Input */}
            <div className="relative inline-flex items-center min-h-[44px]">
              <input
                type="date"
                aria-label="Due date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setActiveChip('custom');
                }}
                className="px-2.5 py-1.5 min-h-[44px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 text-xs tabular-nums text-zinc-800 dark:text-zinc-200 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Priority & Submit */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Priority:</span>
            {(['low', 'medium', 'high'] as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`text-xs tabular-nums px-2.5 py-1 min-h-[44px] rounded capitalize transition cursor-pointer ${
                  priority === p
                    ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium text-xs hover:bg-zinc-800 dark:hover:bg-white/90 transition shadow-2xs cursor-pointer"
          >
            <span>Save deadline</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
