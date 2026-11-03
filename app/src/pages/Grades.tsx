import React, { useState } from 'react';
import {
  Award,
  Calculator,
  BookOpen,
  Plus,
  Trash2,
  ChevronRight,
  Sliders
} from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import type { Assessment } from '../types';
import {
  percentageToGpa,
  percentageToLetter,
  calculateCoursePercentage,
  calculateCumulativeGpa,
  getAcademicStanding
} from '../utils/academicCalculations';

export const GradesPage: React.FC = () => {
  const { grades, updateAssessmentScore, addCourseGrade, deleteCourseGrade } = useStudyFlowStore();
  const [selectedCourseId, setSelectedCourseId] = useState<string>(grades[0]?.id || '');
  const [simulatedFinalScore, setSimulatedFinalScore] = useState<number>(85);
  const [showAddCourseModal, setShowAddCourseModal] = useState<boolean>(false);

  // Form state for adding new course
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCredits, setNewCredits] = useState(4);
  const [newTarget, setNewTarget] = useState('A');

  // Compute overall Term GPA using unified utility
  const { gpaString: termGpa, gpa: numericGpa, totalCredits } = calculateCumulativeGpa(grades);
  const standing = getAcademicStanding(numericGpa);
  const selectedCourse = grades.find((c) => c.id === selectedCourseId) || grades[0];

  // Simulation calculations for selected course
  let simCoursePct = 0;
  let upcomingAssessment: Assessment | undefined;

  if (selectedCourse) {
    let earnedSoFar = 0;
    let gradedWeight = 0;

    selectedCourse.assessments.forEach((a) => {
      if (a.score !== undefined && a.score !== null) {
        earnedSoFar += (a.score * a.weight) / 100;
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
      courseCode: newCode.trim().toUpperCase(),
      courseName: newName.trim(),
      credits: Number(newCredits) || 3,
      targetLetter: newTarget,
      color: '#6366F1',
      assessments: [
        { id: `a-${Date.now()}-1`, name: 'Midterm Exam', weight: 30, score: 90 },
        { id: `a-${Date.now()}-2`, name: 'Homework & Assignments', weight: 30, score: 92 },
        { id: `a-${Date.now()}-3`, name: 'Final Comprehensive Exam', weight: 40, score: undefined }
      ]
    });

    setNewCode('');
    setNewName('');
    setShowAddCourseModal(false);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Top Banner & KPI Stat Row (Unified Academic Ledger Strip) */}
      <div className="bg-surface-light dark:bg-surface-dark border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-zinc-200/80 dark:divide-zinc-800/80 grid grid-cols-1 md:grid-cols-3 shadow-2xs overflow-hidden">
        {/* Cumulative GPA Card */}
        <div className="p-4 md:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Cumulative Grade Point Average</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
              Dean’s List
            </span>
          </div>

          <div className="my-2.5 flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-mono font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight tabular-nums">
              {termGpa}
            </span>
            <span className="text-xs font-mono text-zinc-400">/ 4.00 Max</span>
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <span>{totalCredits} Enrolled Credits</span>
            <span className="text-emerald-600 dark:text-emerald-400">100% Passing Track</span>
          </div>
        </div>

        {/* Total Courses Card */}
        <div className="p-4 md:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Credits Enrolled</span>
            <BookOpen className="h-3.5 w-3.5 text-zinc-400" />
          </div>
          <div className="my-2.5 flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-mono font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight tabular-nums">
              {totalCredits}
            </span>
            <span className="text-xs font-mono text-zinc-400">load units</span>
          </div>
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <span>{grades.length} Active Courses</span>
            <span className="text-blue-600 dark:text-blue-400">Full-Time Status</span>
          </div>
        </div>

        {/* Target Standing */}
        <div className="p-4 md:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Class Standing</span>
            <Award className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="my-2.5 flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-mono font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
              {standing.tier}
            </span>
            <span className="text-xs font-mono text-amber-600 dark:text-amber-400">{standing.standing}</span>
          </div>
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <span>Honors Track Status</span>
            <span className="text-zinc-400">Term 2026</span>
          </div>
        </div>
      </div>

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
                    Syllabus "What-If" Outcome Simulator
                  </h2>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                    {selectedCourse.courseCode}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Simulate required assessment scores to guarantee your target course honors letter
                </p>
              </div>
            </div>

            {/* Course Selector Dropdown */}
            <select
              value={selectedCourse.id}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="px-2.5 py-1 rounded-md text-xs font-mono bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:outline-none"
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
                <span className="font-mono text-xl font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                  {simulatedFinalScore}%
                </span>
              </div>

              <input
                type="range"
                min="50"
                max="100"
                value={simulatedFinalScore}
                onChange={(e) => setSimulatedFinalScore(Number(e.target.value))}
                className="w-full h-1 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />

              <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                <span>50% (Passing)</span>
                <span>75% (Average)</span>
                <span>85% (Target)</span>
                <span>100% (Maximum)</span>
              </div>
            </div>

            {/* Projected Result Callout */}
            <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-800 text-center space-y-1">
              <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                Projected Course Grade
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-mono font-semibold text-zinc-900 dark:text-white tabular-nums">
                  {simCoursePct.toFixed(1)}%
                </span>
                <span className="text-sm font-mono font-semibold px-2 py-0.5 rounded bg-blue-600 text-white">
                  {percentageToLetter(simCoursePct)}
                </span>
              </div>
              <p className="text-[10px] font-mono text-zinc-400">
                Target: {selectedCourse.targetLetter} (GPA: {percentageToGpa(simCoursePct).toFixed(1)})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Course Breakdown Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Enrolled Course Portfolio</h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Edit individual assessment scores in real time to model syllabus progression
            </p>
          </div>

          <button
            onClick={() => setShowAddCourseModal(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white/90 text-white dark:text-zinc-900 text-xs font-medium shadow-2xs transition-transform active:scale-95"
          >
            <Plus className="h-3 w-3" />
            <span>Add Course</span>
          </button>
        </div>

        {grades.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-surface-light dark:bg-surface-dark text-center">
            <Calculator className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
            <h3 className="text-xs font-medium text-zinc-800 dark:text-zinc-200">No courses enrolled</h3>
            <p className="text-[11px] text-zinc-400 max-w-sm mx-auto mt-0.5">
              Add your classes and syllabus grade weights to calculate your cumulative GPA and simulate target final exam scores.
            </p>
            <div className="mt-3">
              <button
                onClick={() => setShowAddCourseModal(true)}
                className="px-3.5 py-1.5 min-h-[44px] rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-white/90 transition shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add First Course</span>
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
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-mono font-semibold text-xs shadow-2xs"
                      style={{ backgroundColor: course.color }}
                    >
                      {course.courseCode.slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">{course.courseCode}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {course.credits} Credits
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">
                        {course.courseName}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-1.5">
                    <span className="text-sm font-mono font-semibold text-zinc-900 dark:text-white tabular-nums">{currentPct.toFixed(1)}%</span>
                    <span className="px-1.5 py-0.2 rounded text-xs font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                      {letter}
                    </span>
                  </div>
                </div>

                {/* Assessments list with live score inputs */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  <p className="text-[10px] font-mono text-zinc-400">
                    Syllabus Weights ({gradedWeight}% Graded)
                  </p>

                  <div className="space-y-1">
                    {course.assessments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between p-1.5 rounded-md bg-zinc-50/60 dark:bg-zinc-850/60 text-xs"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-zinc-700 dark:text-zinc-300">{a.name}</span>
                          <span className="text-[10px] font-mono text-zinc-400">({a.weight}%)</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={a.score !== undefined ? a.score : ''}
                            placeholder="—"
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : Number(e.target.value);
                              updateAssessmentScore(course.id, a.id, val);
                            }}
                            className="w-14 px-1.5 py-0.5 text-right font-mono text-xs font-semibold rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="text-[11px] font-mono text-zinc-400">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <button
                    onClick={() => setSelectedCourseId(course.id)}
                    className="text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <span>Simulate Final</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>

                  {grades.length > 1 && (
                    <button
                      onClick={() => deleteCourseGrade(course.id)}
                      className="text-zinc-400 hover:text-rose-500 transition-colors p-1"
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
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Add Academic Course</h3>
              <button
                onClick={() => setShowAddCourseModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-mono p-1"
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
                  placeholder="e.g. CS 240"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Course Name</label>
                <input
                  type="text"
                  placeholder="e.g. Advanced Operating Systems"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Credits</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={newCredits}
                    onChange={(e) => setNewCredits(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Target Grade</label>
                  <select
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    className="mt-1 w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
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
