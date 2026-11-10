import React, { useState } from 'react';
import {
  Calculator,
  BookOpen,
  Plus,
  Trash2,
  ChevronRight,
  Sliders
} from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import type { Assessment } from '../types';
import { GradingEditor } from '../components/GradingEditor';
import { LIMITS } from '../utils/limits';
import {
  percentageToGpa,
  percentageToLetter,
  calculateCoursePercentage,
  calculateCumulativeGpa,
  clampScore,
  getAcademicStanding
} from '../utils/academicCalculations';

export const GradesPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { grades, updateAssessmentScore, setCourseAssessments, addCourseGrade, deleteCourseGrade } = useStudyFlowStore();
  // The course whose weights are being edited (one at a time).
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(grades[0]?.id || '');
  const [simulatedFinalScore, setSimulatedFinalScore] = useState<number>(85);
  const [showAddCourseModal, setShowAddCourseModal] = useState<boolean>(false);

  // Form state for adding new course
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCredits, setNewCredits] = useState(4);
  const [newTarget, setNewTarget] = useState('A');

  // Compute overall Term GPA using unified utility
  const { gpaString: termGpa, gpa: numericGpa, totalCredits, hasData: hasGpa } = calculateCumulativeGpa(grades);
  const standing = getAcademicStanding(numericGpa);
  const selectedCourse = grades.find((c) => c.id === selectedCourseId) || grades[0];

  // Simulation calculations for selected course
  let simCoursePct = 0;
  let upcomingAssessment: Assessment | undefined;

  if (selectedCourse) {
    let earnedSoFar = 0;
    let gradedWeight = 0;

    selectedCourse.assessments.forEach((a) => {
      const score = clampScore(a.score ?? undefined);
      if (score !== undefined) {
        earnedSoFar += (score * a.weight) / 100;
        gradedWeight += a.weight;
      } else if (!upcomingAssessment) {
        upcomingAssessment = a;
      }
    });

    const simulatedEarned = earnedSoFar + (simulatedFinalScore * (upcomingAssessment ? upcomingAssessment.weight : 0)) / 100;
    const simTotalGradedWeight = gradedWeight + (upcomingAssessment ? upcomingAssessment.weight : 0);
    simCoursePct = simTotalGradedWeight > 0 ? (simulatedEarned / simTotalGradedWeight) * 100 : 0;
  }

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;

    addCourseGrade({
      courseCode: newCode.trim().toUpperCase().slice(0, LIMITS.courseCode),
      courseName: newName.trim().slice(0, LIMITS.courseName),
      credits: Number(newCredits) || 3,
      targetLetter: newTarget,
      color: '#4F46E5',
      assessments: [
        { id: `a-${Date.now()}-1`, name: 'Midterm exam', weight: 30, score: undefined },
        { id: `a-${Date.now()}-2`, name: 'Coursework', weight: 30, score: undefined },
        { id: `a-${Date.now()}-3`, name: 'Final exam', weight: 40, score: undefined }
      ]
    });

    setNewCode('');
    setNewName('');
    setShowAddCourseModal(false);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      <div className="space-y-1">
        {embedded ? (
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Grades and GPA</h2>
        ) : (
          <h1 className="text-3xl md:text-4xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Grades</h1>
        )}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Your courses, and what they add up to.</p>
      </div>
      {grades.length > 0 && (
      <div className="bg-surface-light dark:bg-surface-dark border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-zinc-200/80 dark:divide-zinc-800/80 grid grid-cols-1 md:grid-cols-3 overflow-hidden">
        <div className="p-4 md:p-5 flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Projected GPA</span>
          <div className="my-2.5 flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl tabular-nums font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
              {hasGpa ? termGpa : '—'}
            </span>
            {hasGpa && <span className="text-xs text-zinc-600 dark:text-zinc-400">out of 4.00</span>}
          </div>
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-600 dark:text-zinc-400">
            {hasGpa ? 'Based on the grades you have entered so far.' : 'Enter a score for any assessment to see it.'}
          </div>
        </div>

        <div className="p-4 md:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
            <span className="text-xs font-medium">Credits</span>
            <BookOpen className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div className="my-2.5 flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl tabular-nums font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
              {totalCredits}
            </span>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">counted in GPA</span>
          </div>
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-600 dark:text-zinc-400">
            {grades.length} {grades.length === 1 ? 'course' : 'courses'} added
          </div>
        </div>

        <div className="p-4 md:p-5 flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Your standing</span>
          <div className="my-2.5">
            <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {hasGpa ? standing.standing.replace('Projected: ', '') : '—'}
            </span>
          </div>
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-600 dark:text-zinc-400">
            Cut-offs are a common default (3.8, 3.5, 3.0). Your university may differ.
          </div>
        </div>
      </div>
      )}

      {/* Main Interactive "What-If" Final Exam Simulator */}
      {selectedCourse && (
        <div className="p-5 md:p-6 rounded-xl bg-surface-light dark:bg-surface-dark border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                <Calculator className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    What-if calculator
                  </h2>
                  <span className="tabular-nums text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                    {selectedCourse.courseCode}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Try a score on your next assessment and see the grade it would give you.
                </p>
              </div>
            </div>

            {/* Course Selector Dropdown */}
            <select
              aria-label="Course to simulate"
              value={selectedCourse.id}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="min-h-[44px] md:min-h-0 px-2.5 py-1 rounded-md text-xs tabular-nums bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:outline-none"
            >
              {grades.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseCode}: {c.courseName}
                </option>
              ))}
            </select>
          </div>

          {/* Simulation Slider & Live Result Box */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <label className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-blue-600" />
                  <span>
                    Simulated Score on{' '}
                    <strong className="text-zinc-900 dark:text-white">
                      {upcomingAssessment ? upcomingAssessment.name : 'Final Assessment'} ({upcomingAssessment ? upcomingAssessment.weight : 30}% weight)
                    </strong>
                  </span>
                </label>
                <span className="tabular-nums text-xl font-semibold text-blue-600 dark:text-blue-400 ">
                  {simulatedFinalScore}%
                </span>
              </div>

              <input
                type="range"
                aria-label="Score on the next assessment, percent"
                min="50"
                max="100"
                value={simulatedFinalScore}
                onChange={(e) => setSimulatedFinalScore(Number(e.target.value))}
                className="w-full h-11 md:h-1 py-[20px] md:py-0 bg-clip-content bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />

              <div className="flex justify-between text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                <span>50%</span>
                <span>75%</span>
                <span>85%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Projected Result Callout */}
            <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-800 text-center space-y-1">
              <p className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                Projected Course Grade
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl tabular-nums font-semibold text-zinc-900 dark:text-white ">
                  {simCoursePct.toFixed(1)}%
                </span>
                <span className="text-sm tabular-nums font-semibold px-2 py-0.5 rounded bg-blue-600 text-white">
                  {percentageToLetter(simCoursePct)}
                </span>
              </div>
              <p className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                Grade points at this score: {percentageToGpa(simCoursePct).toFixed(1)} · Your target: {selectedCourse.targetLetter}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Course Breakdown Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Your courses</h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Enter scores as you get them.
            </p>
          </div>

          <button
            onClick={() => setShowAddCourseModal(true)}
            className="min-h-[44px] md:min-h-0 flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white/90 text-white dark:text-zinc-900 text-xs font-medium shadow-2xs transition-transform active:scale-95"
          >
            <Plus className="h-3 w-3" />
            <span>Add Course</span>
          </button>
        </div>

        {grades.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-surface-light dark:bg-surface-dark text-center">
            <Calculator className="h-8 w-8 text-zinc-600 dark:text-zinc-400 mx-auto mb-2" />
            <h2 className="text-xs font-medium text-zinc-800 dark:text-zinc-200">No courses enrolled</h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto mt-0.5">
              Add your classes and course grade weights to calculate your cumulative GPA and simulate target final exam scores.
            </p>
            <div className="mt-3">
              <button
                onClick={() => setShowAddCourseModal(true)}
                className="px-3.5 py-1.5 min-h-[44px] rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-white/90 transition shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add your first course</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {grades.map((course) => {
              const { currentPct, gradedWeight } = calculateCoursePercentage(course);
              const letter = percentageToLetter(currentPct);

              return (
                <div
                  key={course.id}
                  className="p-4 rounded-xl bg-surface-light dark:bg-surface-dark border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs space-y-3 transition-colors"
                >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 tabular-nums font-semibold text-xs"
                    >
                      {course.courseCode.slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">{course.courseCode}</span>
                        <span className="text-xs tabular-nums px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {course.credits} Credits
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[200px]">
                        {course.courseName}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-1.5">
                    {gradedWeight > 0 ? (
                      <>
                        <span className="text-sm tabular-nums font-semibold text-zinc-900 dark:text-white ">{currentPct.toFixed(1)}%</span>
                        <span className="px-1.5 py-0.5 rounded text-xs tabular-nums font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                          {letter}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">No scores yet</span>
                    )}
                  </div>
                </div>

                {editingCourseId === course.id ? (
                  <GradingEditor
                    course={course}
                    onCancel={() => setEditingCourseId(null)}
                    onSave={(next) => {
                      setCourseAssessments(course.id, next);
                      setEditingCourseId(null);
                    }}
                  />
                ) : (
                /* Assessments list with live score inputs */
                <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  <p className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                    Weights ({gradedWeight}% Graded)
                  </p>

                  <div className="space-y-1">
                    {course.assessments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between p-1.5 rounded-md bg-zinc-50/60 dark:bg-zinc-850/60 text-xs"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-zinc-700 dark:text-zinc-300">{a.name}</span>
                          <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">({a.weight}%)</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            aria-label={`Score for ${a.name}, percent`}
                            min="0"
                            max="100"
                            value={a.score !== undefined ? a.score : ''}
                            placeholder="—"
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : Number(e.target.value);
                              updateAssessmentScore(course.id, a.id, val);
                            }}
                            className="min-h-[44px] md:min-h-0 w-16 md:w-14 px-1.5 py-0.5 text-right tabular-nums text-xs font-semibold rounded border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                )}

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedCourseId(course.id)}
                      className="text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1 text-xs min-h-[44px]"
                    >
                      <span>Try the final</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                    {editingCourseId !== course.id && (
                      <button
                        onClick={() => setEditingCourseId(course.id)}
                        className="text-zinc-700 dark:text-zinc-300 font-medium hover:underline text-xs min-h-[44px] cursor-pointer"
                      >
                        Edit grading
                      </button>
                    )}
                  </div>

                  {grades.length > 1 && (
                    <button
                      onClick={() => deleteCourseGrade(course.id)}
                      className="text-zinc-600 dark:text-zinc-400 hover:text-rose-500 transition-colors p-1"
                      title={`Delete ${course.courseCode} from portfolio`}
                      aria-label={`Delete ${course.courseCode} from portfolio`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Modal: Add New Course */}
      {showAddCourseModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-light dark:bg-surface-dark w-full max-w-md rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Add a course</h2>
              <button
                onClick={() => setShowAddCourseModal(false)}
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs tabular-nums p-1"
                title="Close modal"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Course Code</label>
                <input
                  type="text"
                  maxLength={LIMITS.courseCode}
                  placeholder="e.g. CS 240"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Course Name</label>
                <input
                  type="text"
                  maxLength={LIMITS.courseName}
                  placeholder="e.g. Advanced Operating Systems"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Credits</label>
                  <input
                    type="number"
                    aria-label="Credits"
                    min="1"
                    max="6"
                    value={newCredits}
                    onChange={(e) => setNewCredits(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Target Grade</label>
                  <select
                    aria-label="Target grade"
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    className="mt-1 w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="A">A (4.0)</option>
                    <option value="A-">A- (3.7)</option>
                    <option value="B+">B+ (3.3)</option>
                    <option value="B">B (3.0)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCourseModal(false)}
                  className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 shadow-2xs"
                >
                  Add Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
