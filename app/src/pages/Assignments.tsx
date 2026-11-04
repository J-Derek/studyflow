import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  Edit3, 
  CheckSquare
} from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import type { Assignment, Subtask } from '../types';
import { getDaysRemaining } from '../utils/formatters';
import { AssignmentModal } from '../components/AssignmentModal';

export const AssignmentsPage: React.FC = () => {
  const { assignments, toggleAssignmentComplete, deleteAssignment, toggleSubtask, addSubtask } = useStudyFlowStore();
  const [newSubtaskInputs, setNewSubtaskInputs] = useState<Record<string, string>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCourse, selectedPriority, selectedStatus]);

  // Extract unique courses
  const courses = useMemo(() => {
    const list = Array.from(new Set(assignments.map((a) => a.course)));
    return list;
  }, [assignments]);

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const matchesSearch =
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.course.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.notes && a.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCourse = selectedCourse === 'all' || a.course === selectedCourse;
      const matchesPriority = selectedPriority === 'all' || a.priority === selectedPriority;
      const matchesStatus =
        selectedStatus === 'all'
          ? true
          : selectedStatus === 'completed'
          ? a.status === 'completed'
          : a.status !== 'completed';

      return matchesSearch && matchesCourse && matchesPriority && matchesStatus;
    });
  }, [assignments, searchQuery, selectedCourse, selectedPriority, selectedStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredAssignments.length / ITEMS_PER_PAGE));
  const paginatedAssignments = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAssignments.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAssignments, currentPage]);

  const handleEdit = (asg: Assignment) => {
    setEditingAssignment(asg);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditingAssignment(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-5 animate-fade-in pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Assignments Registry</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-sans">Track course assignments, milestones, and grading deadlines</p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white/90 text-white dark:text-zinc-900 font-medium text-xs transition shadow-2xs active:scale-95 self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Assignment</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-light dark:bg-surface-dark p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs space-y-2.5 transition-colors">
        <div className="flex flex-col md:flex-row items-center gap-2.5">
          {/* Search Box */}
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search assignments by title, course code, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 transition"
            />
          </div>

          {/* Quick Status Filter Pills */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg w-full md:w-auto self-start md:self-auto">
            {(['all', 'pending', 'completed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSelectedStatus(s)}
                className={`flex-1 md:flex-none px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                  selectedStatus === s 
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold' 
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Dropdown Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs">
          <div className="flex items-center gap-3">
            {/* Course filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400 tabular-nums text-[11px]">Course:</span>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs tabular-nums text-zinc-700 dark:text-zinc-200 focus:outline-none"
              >
                <option value="all">All Courses ({assignments.length})</option>
                {courses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400 tabular-nums text-[11px]">Priority:</span>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs tabular-nums text-zinc-700 dark:text-zinc-200 focus:outline-none"
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] tabular-nums text-zinc-400">
            {filteredAssignments.length} of {assignments.length} assignments
          </div>
        </div>
      </div>

      {/* Linear-Tier Unified Issue Matrix Container */}
      <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark overflow-hidden divide-y divide-zinc-200/70 dark:divide-zinc-800/70 shadow-2xs">
        {filteredAssignments.length === 0 ? (
          <div className="py-12 text-center p-6">
            <CheckSquare className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
            <h3 className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
              {assignments.length === 0 ? 'Your assignments data is empty' : 'No assignments match filters'}
            </h3>
            <p className="text-[11px] text-zinc-400 max-w-sm mx-auto mt-0.5">
              {assignments.length === 0 
                ? 'Add your first problem set, paper, or lab report to start tracking your deadlines.' 
                : 'Adjust your search filters or click "New Assignment" to add an assignments milestone.'}
            </p>
            {assignments.length === 0 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => setModalOpen(true)}
                  className="px-3.5 py-1.5 min-h-[44px] rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-white/90 transition shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add First Assignment</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          paginatedAssignments.map((asg) => {
            const isCompleted = asg.status === 'completed';
            const { label, isUrgent } = getDaysRemaining(asg.dueDate);
            const effectiveSubtasks: Subtask[] = asg.subtasks ?? [];

            return (
              <div
                key={asg.id}
                className={`p-3.5 transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 flex flex-col gap-2.5 ${
                  isCompleted ? 'opacity-70 bg-zinc-50/30 dark:bg-zinc-900/30' : ''
                }`}
              >
                {/* Main Assignment Row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 overflow-hidden min-w-0">
                    <button
                      onClick={() => toggleAssignmentComplete(asg.id)}
                      className="text-zinc-300 dark:text-zinc-600 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors shrink-0"
                      title={isCompleted ? `Mark "${asg.title}" incomplete` : `Mark "${asg.title}" complete`}
                      aria-label={isCompleted ? `Mark "${asg.title}" incomplete` : `Mark "${asg.title}" complete`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </button>

                    <div className="flex items-center gap-2 overflow-hidden min-w-0">
                      <span className="tabular-nums text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60 shrink-0">
                        {asg.course.split('—')[0].trim()}
                      </span>

                      <span
                        className={`text-xs font-medium truncate ${
                          isCompleted ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-zinc-100'
                        }`}
                      >
                        {asg.title}
                      </span>
                      {asg.sample && (
                        <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400">
                          Sample
                        </span>
                      )}

                      {asg.notes && (
                        <span className="text-[11px] text-zinc-400 truncate hidden md:inline">
                          — {asg.notes}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Metadata & Controls */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Priority — monochrome text only */}
                    <span className="tabular-nums text-[10px] text-zinc-400 dark:text-zinc-500 hidden sm:inline capitalize">
                      {asg.priority}
                    </span>

                    {/* Progress Percentage */}
                    <div className="hidden lg:flex items-center gap-1.5 tabular-nums text-[11px] text-zinc-400">
                      <div className="w-12 bg-zinc-100 dark:bg-zinc-800 rounded-full h-1 overflow-hidden">
                        <div
                          className="bg-zinc-400 dark:bg-zinc-500 h-full rounded-full"
                          style={{ width: `${asg.progress}%` }}
                        />
                      </div>
                      <span className="tabular-nums">{asg.progress}%</span>
                    </div>

                    {/* Due Date — clean monospace */}
                    <span
                      className={`tabular-nums text-[11px]  ${
                        isUrgent && !isCompleted
                          ? 'text-red-500 dark:text-red-400'
                          : 'text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {label}
                    </span>

                    {/* Edit and Delete Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(asg)}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                        title="Edit Assignment"
                        aria-label={`Edit assignment "${asg.title}"`}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteAssignment(asg.id)}
                        className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        title="Delete Assignment"
                        aria-label={`Delete assignment "${asg.title}"`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subtasks Milestones (Linear style expandable list) */}
                <div className="pl-7 pr-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/60 space-y-1">
                  <div className="flex items-center justify-between text-[10px] tabular-nums text-zinc-400 mb-1">
                    <span>Milestones ({effectiveSubtasks.filter(s => s.completed).length}/{effectiveSubtasks.length})</span>
                    {!isCompleted && (
                      <span className="text-[10px] text-zinc-400">press enter to add</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    {effectiveSubtasks.map((st) => (
                      <div
                        key={st.id}
                        onClick={() => toggleSubtask(asg.id, st.id)}
                        className="flex items-center gap-1.5 p-1 rounded hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60 cursor-pointer text-xs transition"
                      >
                        <input
                          type="checkbox"
                          checked={st.completed}
                          onChange={() => {}}
                          className="h-3 w-3 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0 cursor-pointer"
                        />
                        <span
                          className={`truncate text-[11px] ${
                            st.completed
                              ? 'line-through text-zinc-400 dark:text-zinc-500'
                              : 'text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          {st.title}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Inline Subtask Quick Add */}
                  {!isCompleted && (
                    <div className="pt-1 flex items-center gap-2 max-w-sm">
                      <input
                        type="text"
                        placeholder="+ Add milestone subtask..."
                        value={newSubtaskInputs[asg.id] || ''}
                        onChange={(e) =>
                          setNewSubtaskInputs((prev) => ({ ...prev, [asg.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (newSubtaskInputs[asg.id] || '').trim()) {
                            e.preventDefault();
                            addSubtask(asg.id, newSubtaskInputs[asg.id].trim());
                            setNewSubtaskInputs((prev) => ({ ...prev, [asg.id]: '' }));
                          }
                        }}
                        className="px-2 py-0.8 text-[11px] rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1 tabular-nums"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Linear-Grade Pagination Footer */}
        {filteredAssignments.length > ITEMS_PER_PAGE && (
          <div className="p-3 bg-zinc-50/50 dark:bg-zinc-850/40 border-t border-zinc-200/70 dark:border-zinc-800/70 flex items-center justify-between text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            <span>
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredAssignments.length)} of {filteredAssignments.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
              >
                Previous
              </button>
              <span className="px-2 text-zinc-400">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
                className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <AssignmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        assignmentToEdit={editingAssignment}
      />
    </div>
  );
};
