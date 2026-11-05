import { useDialog } from '../lib/useDialog';
import React, { useState } from 'react';
import { X, Calendar, Clock, BookOpen, AlertCircle } from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import type { Priority, Assignment } from '../types';

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentToEdit?: Assignment | null;
}

export const AssignmentModal: React.FC<AssignmentModalProps> = ({ isOpen, onClose, assignmentToEdit }) => {
  const { addAssignment, updateAssignment } = useStudyFlowStore();

  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState('23:59');
  const [priority, setPriority] = useState<Priority>('medium');
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState(0);

  React.useEffect(() => {
    if (assignmentToEdit) {
      setTitle(assignmentToEdit.title);
      setCourse(assignmentToEdit.course);
      setDueDate(assignmentToEdit.dueDate);
      setDueTime(assignmentToEdit.dueTime || '23:59');
      setPriority(assignmentToEdit.priority);
      setNotes(assignmentToEdit.notes || '');
      setProgress(assignmentToEdit.progress);
    } else {
      setTitle('');
      setCourse('');
      setDueDate(new Date().toISOString().split('T')[0]);
      setDueTime('23:59');
      setPriority('medium');
      setNotes('');
      setProgress(0);
    }
  }, [assignmentToEdit, isOpen]);

  const dialogRef = useDialog(isOpen, onClose);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !course.trim()) return;

    if (assignmentToEdit) {
      updateAssignment(assignmentToEdit.id, {
        title,
        course,
        dueDate,
        dueTime,
        priority,
        notes,
        progress
      });
    } else {
      addAssignment({
        title,
        course,
        dueDate,
        dueTime,
        priority,
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
        className="bg-surface-light dark:bg-surface-dark rounded-xl w-full max-w-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 id="assignment-modal-title" className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
              {assignmentToEdit ? 'Edit Assignment' : 'Create New Assignment'}
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
              placeholder="e.g. Problem Set 2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <BookOpen className="h-3 w-3 text-zinc-600 dark:text-zinc-400" /> Course Code & Name
            </label>
            <input
              type="text"
              required
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
              <AlertCircle className="h-3 w-3 text-zinc-600 dark:text-zinc-400" /> Priority Level
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

          {assignmentToEdit && (
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
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Assignment Notes & Syllabus Specs
            </label>
            <textarea
              rows={3}
              placeholder="Anything you want to remember (optional)"
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
              {assignmentToEdit ? 'Save Changes' : 'Create Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
