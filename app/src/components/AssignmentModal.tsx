import { useDialog } from '../lib/useDialog';
import { KindPicker } from './KindPicker';
import { kindOf } from '../utils/kinds';
import { RepeatToggle } from './RepeatToggle';
import { progressInfo } from '../utils/progress';
import { celebrate } from './CelebrateBurst';
import React, { useState } from 'react';
import { X, Calendar, Clock, BookOpen, AlertCircle } from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import type { Priority, Assignment, AssignmentKind, Repeat } from '../types';
import { DATE_MAX, DATE_MIN, LIMITS, isDateInRange, localDateISO } from '../utils/limits';

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentToEdit?: Assignment | null;
  /** For a new item: the due date to start with (for example the day tapped on the calendar). */
  initialDueDate?: string;
}

export const AssignmentModal: React.FC<AssignmentModalProps> = ({ isOpen, onClose, assignmentToEdit, initialDueDate }) => {
  const { addAssignment, updateAssignment } = useStudyFlowStore();

  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('');
  const [dueDate, setDueDate] = useState(localDateISO());
  const [dueTime, setDueTime] = useState('23:59');
  const [priority, setPriority] = useState<Priority>('medium');
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState(0);
  const [kind, setKind] = useState<AssignmentKind>('assignment');
  const [repeat, setRepeat] = useState<Repeat | undefined>(undefined);

  React.useEffect(() => {
    if (assignmentToEdit) {
      setTitle(assignmentToEdit.title);
      setCourse(assignmentToEdit.course);
      setDueDate(assignmentToEdit.dueDate);
      setDueTime(assignmentToEdit.dueTime || '23:59');
      setPriority(assignmentToEdit.priority);
      setNotes(assignmentToEdit.notes || '');
      setProgress(assignmentToEdit.progress);
      setKind(kindOf(assignmentToEdit));
      setRepeat(assignmentToEdit.repeat);
    } else {
      setTitle('');
      setCourse('');
      setDueDate(initialDueDate && isDateInRange(initialDueDate) ? initialDueDate : localDateISO());
      setDueTime('23:59');
      setPriority('medium');
      setNotes('');
      setProgress(0);
      setKind('assignment');
      setRepeat(undefined);
    }
  }, [assignmentToEdit, isOpen, initialDueDate]);

  const dialogRef = useDialog(isOpen, onClose);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !course.trim() || !isDateInRange(dueDate)) return;

    if (assignmentToEdit) {
      const hasChecklist = (assignmentToEdit.subtasks?.length ?? 0) > 0;
      updateAssignment(assignmentToEdit.id, {
        title: title.trim(),
        course: course.trim(),
        dueDate,
        dueTime,
        priority,
        kind,
        repeat,
        notes,
        // With a checklist the ticks decide progress, so the dialog does not send a number.
        ...(hasChecklist ? {} : { progress })
      });
      if (!hasChecklist && progress === 100 && assignmentToEdit.status !== 'completed') celebrate(title.trim());
    } else {
      addAssignment({
        title: title.trim(),
        course: course.trim(),
        dueDate,
        dueTime,
        priority,
        kind,
        ...(repeat ? { repeat } : {}),
        status: 'pending',
        progress: 0,
        notes
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in motion-reduce:animate-none">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-modal-title"
        className="bg-surface-light dark:bg-surface-dark rounded-xl w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl border border-zinc-200 dark:border-zinc-800 transition-colors"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 id="assignment-modal-title" className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
              {assignmentToEdit ? 'Edit Assignment' : 'New assignment'}
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Add the title, course and due date</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Assignment title
            </label>
            <input
              type="text"
              required
              maxLength={LIMITS.assignmentTitle}
              placeholder="e.g. Problem Set 2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <BookOpen className="h-3 w-3 text-zinc-600 dark:text-zinc-400" /> Course
            </label>
            <input
              type="text"
              required
              maxLength={LIMITS.assignmentCourse}
              list="course-suggestions"
              placeholder="e.g. CS 101 or Physics"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-zinc-600 dark:text-zinc-400" /> Due Date
              </label>
              <input
                type="date"
                aria-label="Due date"
                required
                min={DATE_MIN}
                max={DATE_MAX}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-zinc-600 dark:text-zinc-400" /> Due Time
              </label>
              <input
                type="time"
                aria-label="Due time (optional)"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3 text-zinc-600 dark:text-zinc-400" /> Priority
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as Priority[]).map((p) => {
                const isSelected = priority === p;
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`py-1.5 rounded-md text-xs tabular-nums capitalize border transition-colors ${
                      isSelected
                        ? p === 'high'
                          ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold'
                          : p === 'medium'
                          ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-semibold'
                          : 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <KindPicker value={kind} onChange={setKind} />

          <RepeatToggle value={repeat} onChange={setRepeat} />

          {assignmentToEdit && (assignmentToEdit.subtasks?.length ?? 0) > 0 && (
            <div data-testid="checklist-progress" className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
              <p className="font-medium tabular-nums">Progress {progressInfo(assignmentToEdit).progress}%</p>
              <p className="text-zinc-600 dark:text-zinc-400">{progressInfo(assignmentToEdit).note}. Tick items on the Assignments page to change it.</p>
            </div>
          )}

          {assignmentToEdit && (assignmentToEdit.subtasks?.length ?? 0) === 0 && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">
                  Progress ({progress}%)
                </label>
              </div>
              <input
                type="range"
                aria-label="Progress, percent"
                min="0"
                max="100"
                step="5"
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full accent-blue-600 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg cursor-pointer"
              />
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Set by you. Add a checklist on the Assignments page and it will be worked out from the ticks instead.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Notes (optional)
            </label>
            <textarea
              rows={4}
              maxLength={LIMITS.assignmentNotes}
              placeholder="What to include, page numbers, what the lecturer said…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-2.5 flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition shadow-2xs"
            >
              {assignmentToEdit ? 'Save changes' : 'Add assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
