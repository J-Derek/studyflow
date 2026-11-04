import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Assignment,
  StudySession,
  TimerMode,
  TimerSettings,
  UserPreferences,
  CourseGrade,
  SoundscapeType,
  Subtask
} from '../types';
import { playSoundscape, stopSoundscape, setSoundscapeVolume as setAudioVolume } from '../lib/soundscapes';
import {
  syncAssignmentToFirestore,
  deleteAssignmentFromFirestore,
  syncSessionToFirestore,
  deleteSessionFromFirestore
} from '../services/firestoreSync';
import { calculateSubtaskProgress } from '../utils/subtasks';
import { syncThemeColor } from '../utils/themeColor';

export type NavigationTab = 'dashboard' | 'assignments' | 'calendar' | 'timer' | 'grades';

export function getTabFromPath(path: string): NavigationTab {
  const clean = path.replace(/\/$/, '').toLowerCase();
  if (clean === '/assignments') return 'assignments';
  if (clean === '/calendar') return 'calendar';
  if (clean === '/timer') return 'timer';
  if (clean === '/grades') return 'grades';
  return 'dashboard';
}

export function getPathFromTab(tab: NavigationTab): string {
  if (tab === 'dashboard') return '/';
  return `/${tab}`;
}

interface StudyFlowState {
  // Authentication & Sync State
  userId: string | null;
  isAnonymous: boolean;
  userEmail: string | null;
  isSyncing: boolean;
  setAuthUser: (uid: string | null, isAnonymous: boolean, email?: string | null, displayName?: string | null) => void;
  resetStore: () => void;

  // User Profile
  user: UserPreferences;
  updateUser: (user: Partial<UserPreferences>) => void;

  // Onboarding & Demo Sandbox
  onboardingDismissed: boolean;
  dismissOnboarding: () => void;
  loadSampleData: () => void;
  clearAllData: () => void;

  // Active Navigation Tab
  activeTab: 'dashboard' | 'assignments' | 'calendar' | 'timer' | 'grades';
  setActiveTab: (tab: 'dashboard' | 'assignments' | 'calendar' | 'timer' | 'grades') => void;

  // Theme Mode
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;

  // Assignments
  assignments: Assignment[];
  addAssignment: (assignment: Omit<Assignment, 'id' | 'createdAt'>) => void;
  updateAssignment: (id: string, updates: Partial<Assignment>) => void;
  deleteAssignment: (id: string) => void;
  toggleAssignmentComplete: (id: string) => void;
  toggleSubtask: (assignmentId: string, subtaskId: string) => void;
  addSubtask: (assignmentId: string, title: string) => void;
  deleteSubtask: (assignmentId: string, subtaskId: string) => void;

  // Study Sessions (Calendar)
  sessions: StudySession[];
  addSession: (session: Omit<StudySession, 'id'>) => void;
  deleteSession: (id: string) => void;

  // Academic Grades & GPA
  grades: CourseGrade[];
  updateAssessmentScore: (courseId: string, assessmentId: string, score: number | undefined) => void;
  addCourseGrade: (course: Omit<CourseGrade, 'id'>) => void;
  deleteCourseGrade: (courseId: string) => void;

  // Focus Timer
  timerSettings: TimerSettings;
  timerMode: TimerMode;
  timerSecondsLeft: number;
  timerIsRunning: boolean;
  timerLastTimestamp: number | null;
  pomodorosCompleted: number;
  soundscape: SoundscapeType;
  soundscapeVolume: number;
  setTimerMode: (mode: TimerMode) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  tickTimer: () => void;
  syncInactiveTime: () => void;
  incrementPomodoros: () => void;
  updateTimerSettings: (settings: Partial<TimerSettings>) => void;
  setSoundscape: (type: SoundscapeType) => void;
  setSoundscapeVolume: (volume: number) => void;
}

const initialAssignments: Assignment[] = [
  {
    id: 'asg-1',
    title: 'Distributed Consensus Algorithm Synthesis',
    course: 'CS 4400 — Distributed Systems',
    dueDate: '2026-11-03',
    dueTime: '23:59',
    priority: 'high',
    status: 'in_progress',
    progress: 75,
    notes: 'Implement Raft leader election and log replication with fault-injection test harness.',
    subtasks: [
      { id: 'st-1', title: 'Review Ongaro-Ousterhout Raft paper', completed: true },
      { id: 'st-2', title: 'Implement Leader Election RPC states', completed: true },
      { id: 'st-3', title: 'Write Log Replication appendEntries handler', completed: true },
      { id: 'st-4', title: 'Run network partition chaos suite', completed: false }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'asg-2',
    title: 'Linear State-Space Control Problem Set',
    course: 'MATH 310 — Applied Linear Algebra',
    dueDate: '2026-11-05',
    dueTime: '17:00',
    priority: 'high',
    status: 'in_progress',
    progress: 40,
    notes: 'Derive eigenspaces, compute Jordan canonical form, and prove observability matrices.',
    subtasks: [
      { id: 'st-5', title: 'Questions 1–3: Eigenvalues & diagonalization', completed: true },
      { id: 'st-6', title: 'Question 4: Generalized eigenvectors', completed: true },
      { id: 'st-7', title: 'Question 5: Jordan form transformation matrix', completed: false },
      { id: 'st-8', title: 'Question 6: Proof of Kalman rank condition', completed: false },
      { id: 'st-9', title: 'Format solutions in LaTeX', completed: false }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'asg-3',
    title: 'Design System & Component Token Spec',
    course: 'DES 202 — Interaction Systems',
    dueDate: '2026-11-08',
    dueTime: '12:00',
    priority: 'medium',
    status: 'in_progress',
    progress: 80,
    notes: 'Figma code layer integration, WCAG AA contrast audit, and mobile tap targets.',
    subtasks: [
      { id: 'st-10', title: 'Color token hierarchy (Light & Dark mode)', completed: true },
      { id: 'st-11', title: 'Typography roles & baseline grid', completed: true },
      { id: 'st-12', title: 'WCAG 2.2 AA Contrast verification (4.5:1 ratio)', completed: true },
      { id: 'st-13', title: 'Export Figma Code Connect specs', completed: false }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'asg-4',
    title: 'Query Optimization & B+ Tree Indexing Benchmark',
    course: 'CS 3200 — Database Internals',
    dueDate: '2026-11-12',
    dueTime: '23:59',
    priority: 'low',
    status: 'pending',
    progress: 0,
    notes: 'Compare buffer pool hit ratios across LRU and Clock-sweep algorithms.',
    subtasks: [
      { id: 'st-14', title: 'Scaffold disk page layout', completed: false },
      { id: 'st-15', title: 'Implement B+ Tree leaf split and merge', completed: false },
      { id: 'st-16', title: 'Benchmark concurrent latching under 100 threads', completed: false }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'asg-5',
    title: 'Ethics in Autonomous Intelligence Memo',
    course: 'PHIL 105 — Technology & Society',
    dueDate: '2026-10-28',
    dueTime: '18:00',
    priority: 'medium',
    status: 'completed',
    progress: 100,
    notes: 'Submitted peer review synthesis on moral agency in multi-agent autonomous software.',
    subtasks: [
      { id: 'st-17', title: 'Read Russell & Norvig alignment chapter', completed: true },
      { id: 'st-18', title: 'Write 1,500 word policy memo', completed: true },
      { id: 'st-19', title: 'Submit on Canvas portal', completed: true }
    ],
    createdAt: new Date().toISOString(),
    completedAt: '2026-10-28T16:45:00.000Z'
  }
];

const initialSessions: StudySession[] = [
  { id: 's-1', title: 'Distributed Systems Lecture', course: 'CS 4400', dayOfWeek: 1, startTime: '09:00', endTime: '10:30', type: 'lecture' },
  { id: 's-2', title: 'Deep Work: Raft Implementation', course: 'CS 4400', dayOfWeek: 1, startTime: '14:00', endTime: '16:30', type: 'study' },
  { id: 's-3', title: 'Applied Linear Algebra', course: 'MATH 310', dayOfWeek: 2, startTime: '11:00', endTime: '12:30', type: 'lecture' },
  { id: 's-4', title: 'Interaction Systems Studio', course: 'DES 202', dayOfWeek: 3, startTime: '13:00', endTime: '15:00', type: 'lab' },
  { id: 's-5', title: 'Problem Set Review & Eigenvectors', course: 'MATH 310', dayOfWeek: 3, startTime: '16:00', endTime: '18:00', type: 'review' },
  { id: 's-6', title: 'Database Systems Architecture', course: 'CS 3200', dayOfWeek: 4, startTime: '10:00', endTime: '11:30', type: 'lecture' },
  { id: 's-7', title: 'B+ Tree Benchmark Lab', course: 'CS 3200', dayOfWeek: 5, startTime: '14:00', endTime: '16:00', type: 'lab' },
  { id: 's-8', title: 'Weekly Academic Retrospective', course: 'General', dayOfWeek: 6, startTime: '10:00', endTime: '11:30', type: 'review' }
];

const initialGrades: CourseGrade[] = [
  {
    id: 'cg-1',
    courseCode: 'CS 4400',
    courseName: 'Distributed Systems',
    credits: 4,
    targetLetter: 'A',
    color: '#6366F1',
    assessments: [
      { id: 'a-1', name: 'Midterm Exam', weight: 25, score: 92 },
      { id: 'a-2', name: 'Raft Consensus Project', weight: 30, score: 96 },
      { id: 'a-3', name: 'Weekly Problem Sets', weight: 20, score: 90 },
      { id: 'a-4', name: 'Final Comprehensive Exam', weight: 25, score: undefined }
    ]
  },
  {
    id: 'cg-2',
    courseCode: 'MATH 310',
    courseName: 'Applied Linear Algebra',
    credits: 4,
    targetLetter: 'A-',
    color: '#EC4899',
    assessments: [
      { id: 'a-5', name: 'Problem Sets (Total)', weight: 20, score: 86 },
      { id: 'a-6', name: 'Midterm 1 (Vector Spaces)', weight: 25, score: 84 },
      { id: 'a-7', name: 'Midterm 2 (Eigenvalues)', weight: 25, score: 91 },
      { id: 'a-8', name: 'Final Exam', weight: 30, score: undefined }
    ]
  },
  {
    id: 'cg-3',
    courseCode: 'DES 202',
    courseName: 'Interaction Systems',
    credits: 3,
    targetLetter: 'A',
    color: '#10B981',
    assessments: [
      { id: 'a-9', name: 'Design Sprint 1: Typography', weight: 20, score: 95 },
      { id: 'a-10', name: 'Design Sprint 2: Design Tokens', weight: 25, score: 98 },
      { id: 'a-11', name: 'Heuristic Usability Evaluation', weight: 25, score: 92 },
      { id: 'a-12', name: 'Final Product Prototype', weight: 30, score: undefined }
    ]
  },
  {
    id: 'cg-4',
    courseCode: 'CS 3200',
    courseName: 'Database Internals',
    credits: 4,
    targetLetter: 'A',
    color: '#F59E0B',
    assessments: [
      { id: 'a-13', name: 'Lab 1: Disk Storage Engine', weight: 15, score: 94 },
      { id: 'a-14', name: 'Lab 2: B+ Tree Concurrency', weight: 20, score: 91 },
      { id: 'a-15', name: 'Midterm Examination', weight: 25, score: 88 },
      { id: 'a-16', name: 'Final Query Engine Capstone', weight: 40, score: undefined }
    ]
  }
];

const defaultSettings: TimerSettings = {
  focusDuration: 25 * 60,
  shortBreakDuration: 5 * 60,
  longBreakDuration: 15 * 60,
  autoStartBreaks: false,
  autoStartFocus: false
};

export const useStudyFlowStore = create<StudyFlowState>()(
  persist(
    (set, get) => ({
      userId: null,
      isAnonymous: true,
      userEmail: null,
      isSyncing: false,
      setAuthUser: (uid, isAnonymous, email, displayName) => {
        set((state) => ({
          userId: uid,
          isAnonymous,
          userEmail: email || null,
          user: {
            ...state.user,
            name: displayName || state.user.name
          }
        }));
      },

      resetStore: () => {
        set({
          userId: null,
          isAnonymous: true,
          userEmail: null,
          isSyncing: false,
          assignments: [],
          sessions: [],
          grades: [],
          onboardingDismissed: false,
          user: {
            name: 'Student',
            university: 'Academic Workspace',
            program: 'Undergraduate',
            semester: 'Current Term'
          }
        });
      },

      user: {
        name: 'Student',
        university: 'Academic Workspace',
        program: 'Undergraduate',
        semester: 'Current Term'
      },

      updateUser: (updates) =>
        set((state) => ({
          user: { ...state.user, ...updates }
        })),

      onboardingDismissed: false,
      dismissOnboarding: () => set({ onboardingDismissed: true }),

      loadSampleData: () => {
        set({
          assignments: initialAssignments,
          sessions: initialSessions,
          grades: initialGrades,
          user: {
            name: 'Alex Vance',
            university: 'Polytechnic Institute',
            program: 'Computer Engineering',
            semester: 'Fall 2026'
          }
        });
      },

      clearAllData: () => {
        set({
          assignments: [],
          sessions: [],
          grades: [],
          pomodorosCompleted: 0
        });
      },

      activeTab: typeof window !== 'undefined' ? getTabFromPath(window.location.pathname) : 'dashboard',
      setActiveTab: (tab) => {
        set({ activeTab: tab });
        if (typeof window !== 'undefined') {
          const targetPath = getPathFromTab(tab);
          if (window.location.pathname !== targetPath) {
            window.history.pushState({ tab }, '', targetPath);
          }
        }
      },

      theme: 'light',
      toggleTheme: () => {
        set((state) => {
          const next = state.theme === 'light' ? 'dark' : 'light';
          if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', next === 'dark');
            syncThemeColor(next === 'dark');
          }
          return { theme: next };
        });
      },
      setTheme: (theme) => {
        set({ theme });
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', theme === 'dark');
          syncThemeColor(theme === 'dark');
        }
      },

      assignments: initialAssignments,
      addAssignment: (assignment) => {
        const newAssignment: Assignment = {
          ...assignment,
          id: `asg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date().toISOString()
        };
        set((state) => ({
          assignments: [newAssignment, ...state.assignments]
        }));
        const uid = get().userId;
        if (uid) {
          syncAssignmentToFirestore(uid, newAssignment).catch((err) => {
            console.warn('Sync error adding assignment:', err);
          });
        }
      },

      updateAssignment: (id, updates) => {
        set((state) => ({
          assignments: state.assignments.map((a) => {
            if (a.id === id) {
              const updated = { ...a, ...updates };
              if (updates.progress !== undefined) {
                if (updates.progress === 100 && a.status !== 'completed') {
                  updated.status = 'completed';
                  updated.completedAt = new Date().toISOString();
                } else if (updates.progress < 100 && a.status === 'completed') {
                  updated.status = 'in_progress';
                  updated.completedAt = undefined;
                }
              }
              const uid = get().userId;
              if (uid) {
                syncAssignmentToFirestore(uid, updated).catch((err) => {
                  console.warn('Sync error updating assignment:', err);
                });
              }
              return updated;
            }
            return a;
          })
        }));
      },

      deleteAssignment: (id) => {
        const previousAssignments = get().assignments;
        set((state) => ({
          assignments: state.assignments.filter((a) => a.id !== id)
        }));
        const uid = get().userId;
        if (uid) {
          deleteAssignmentFromFirestore(uid, id).catch((err) => {
            console.warn('Sync error deleting assignment, rolling back state:', err);
            set({ assignments: previousAssignments });
          });
        }
      },

      toggleAssignmentComplete: (id) => {
        set((state) => ({
          assignments: state.assignments.map((a) => {
            if (a.id === id) {
              const isCompleted = a.status === 'completed';
              const updated: Assignment = {
                ...a,
                status: isCompleted ? 'in_progress' : 'completed',
                progress: isCompleted ? 50 : 100,
                completedAt: isCompleted ? undefined : new Date().toISOString()
              };
              const uid = get().userId;
              if (uid) {
                syncAssignmentToFirestore(uid, updated).catch((err) => {
                  console.warn('Sync error toggling assignment:', err);
                });
              }
              return updated;
            }
            return a;
          })
        }));
      },

      toggleSubtask: (assignmentId, subtaskId) => {
        set((state) => ({
          assignments: state.assignments.map((a) => {
            if (a.id === assignmentId) {
              const currentSubtasks: Subtask[] = (a.subtasks && a.subtasks.length > 0)
                ? a.subtasks
                : [
                    { id: `${a.id}-st-1`, title: 'Read requirements & synthesize outline', completed: a.progress >= 30 },
                    { id: `${a.id}-st-2`, title: 'Execute core technical deliverables & tests', completed: a.progress >= 70 },
                    { id: `${a.id}-st-3`, title: 'Final proofing, documentation & submission', completed: a.progress === 100 }
                  ];
              const updatedSubtasks = currentSubtasks.map((st) =>
                st.id === subtaskId ? { ...st, completed: !st.completed } : st
              );
              const { progress, status, allDone } = calculateSubtaskProgress(updatedSubtasks, a.progress);
              const updated: Assignment = {
                ...a,
                subtasks: updatedSubtasks,
                progress,
                status,
                completedAt: allDone ? (a.completedAt || new Date().toISOString()) : undefined
              };
              const uid = get().userId;
              if (uid) syncAssignmentToFirestore(uid, updated).catch(console.warn);
              return updated;
            }
            return a;
          })
        }));
      },

      addSubtask: (assignmentId, title) => {
        set((state) => ({
          assignments: state.assignments.map((a) => {
            if (a.id === assignmentId) {
              const currentSubtasks: Subtask[] = (a.subtasks && a.subtasks.length > 0)
                ? a.subtasks
                : [
                    { id: `${a.id}-st-1`, title: 'Read requirements & synthesize outline', completed: a.progress >= 30 },
                    { id: `${a.id}-st-2`, title: 'Execute core technical deliverables & tests', completed: a.progress >= 70 },
                    { id: `${a.id}-st-3`, title: 'Final proofing, documentation & submission', completed: a.progress === 100 }
                  ];
              const newSubtask: Subtask = {
                id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                title,
                completed: false
              };
              const updatedSubtasks = [...currentSubtasks, newSubtask];
              const { progress, status, allDone } = calculateSubtaskProgress(updatedSubtasks, a.progress);
              const updated: Assignment = {
                ...a,
                subtasks: updatedSubtasks,
                progress,
                status,
                completedAt: allDone ? (a.completedAt || new Date().toISOString()) : undefined
              };
              const uid = get().userId;
              if (uid) syncAssignmentToFirestore(uid, updated).catch(console.warn);
              return updated;
            }
            return a;
          })
        }));
      },

      deleteSubtask: (assignmentId, subtaskId) => {
        set((state) => ({
          assignments: state.assignments.map((a) => {
            if (a.id === assignmentId && a.subtasks) {
              const updatedSubtasks = a.subtasks.filter((st) => st.id !== subtaskId);
              const { progress, status, allDone } = calculateSubtaskProgress(updatedSubtasks, a.progress);
              const updated: Assignment = {
                ...a,
                subtasks: updatedSubtasks,
                progress,
                status,
                completedAt: allDone ? (a.completedAt || new Date().toISOString()) : undefined
              };
              const uid = get().userId;
              if (uid) syncAssignmentToFirestore(uid, updated).catch(console.warn);
              return updated;
            }
            return a;
          })
        }));
      },

      sessions: initialSessions,
      addSession: (session) => {
        const newSession: StudySession = {
          ...session,
          id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        };
        set((state) => ({
          sessions: [...state.sessions, newSession]
        }));
        const uid = get().userId;
        if (uid) {
          syncSessionToFirestore(uid, newSession).catch((err) => {
            console.warn('Sync error adding session:', err);
          });
        }
      },

      deleteSession: (id) => {
        const previousSessions = get().sessions;
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id)
        }));
        const uid = get().userId;
        if (uid) {
          deleteSessionFromFirestore(uid, id).catch((err) => {
            console.warn('Sync error deleting session, rolling back state:', err);
            set({ sessions: previousSessions });
          });
        }
      },

      grades: initialGrades,
      updateAssessmentScore: (courseId, assessmentId, score) => {
        set((state) => ({
          grades: state.grades.map((c) => {
            if (c.id === courseId) {
              return {
                ...c,
                assessments: c.assessments.map((a) =>
                  a.id === assessmentId ? { ...a, score } : a
                )
              };
            }
            return c;
          })
        }));
      },

      addCourseGrade: (course) => {
        const newCourse: CourseGrade = {
          ...course,
          id: `cg-${Date.now()}`
        };
        set((state) => ({
          grades: [...state.grades, newCourse]
        }));
      },

      deleteCourseGrade: (courseId) => {
        set((state) => ({
          grades: state.grades.filter((c) => c.id !== courseId)
        }));
      },

      // Focus Timer
      timerSettings: defaultSettings,
      timerMode: 'focus',
      timerSecondsLeft: defaultSettings.focusDuration,
      timerIsRunning: false,
      timerLastTimestamp: null,
      pomodorosCompleted: 4,
      soundscape: 'off',
      soundscapeVolume: 0.35,

      setTimerMode: (mode) => {
        const { timerSettings } = get();
        let seconds = timerSettings.focusDuration;
        if (mode === 'shortBreak') seconds = timerSettings.shortBreakDuration;
        if (mode === 'longBreak') seconds = timerSettings.longBreakDuration;

        set({
          timerMode: mode,
          timerSecondsLeft: seconds,
          timerIsRunning: false,
          timerLastTimestamp: null
        });
      },

      startTimer: () => {
        const { soundscape, soundscapeVolume } = get();
        if (soundscape !== 'off') {
          playSoundscape(soundscape, soundscapeVolume);
        }
        set({
          timerIsRunning: true,
          timerLastTimestamp: Date.now()
        });
      },

      pauseTimer: () => {
        stopSoundscape();
        set({
          timerIsRunning: false,
          timerLastTimestamp: null
        });
      },

      resetTimer: () => {
        stopSoundscape();
        const { timerMode, timerSettings } = get();
        let seconds = timerSettings.focusDuration;
        if (timerMode === 'shortBreak') seconds = timerSettings.shortBreakDuration;
        if (timerMode === 'longBreak') seconds = timerSettings.longBreakDuration;

        set({
          timerSecondsLeft: seconds,
          timerIsRunning: false,
          timerLastTimestamp: null
        });
      },

      tickTimer: () => {
        const { timerSecondsLeft, timerIsRunning, timerLastTimestamp } = get();
        if (!timerIsRunning) return;

        const now = Date.now();
        const elapsedSeconds = timerLastTimestamp
          ? Math.max(1, Math.round((now - timerLastTimestamp) / 1000))
          : 1;

        if (timerSecondsLeft <= elapsedSeconds) {
          get().pauseTimer();
          set({ timerSecondsLeft: 0 });

          if (get().timerMode === 'focus') {
            get().incrementPomodoros();
          }
        } else {
          set({
            timerSecondsLeft: timerSecondsLeft - elapsedSeconds,
            timerLastTimestamp: now
          });
        }
      },

      syncInactiveTime: () => {
        const { timerIsRunning, timerLastTimestamp, timerSecondsLeft } = get();
        if (!timerIsRunning || !timerLastTimestamp) return;

        const now = Date.now();
        const elapsed = Math.round((now - timerLastTimestamp) / 1000);
        if (elapsed > 2) {
          if (elapsed >= timerSecondsLeft) {
            get().pauseTimer();
            set({ timerSecondsLeft: 0 });
            if (get().timerMode === 'focus') {
              get().incrementPomodoros();
            }
          } else {
            set({
              timerSecondsLeft: timerSecondsLeft - elapsed,
              timerLastTimestamp: now
            });
          }
        }
      },

      incrementPomodoros: () =>
        set((state) => ({
          pomodorosCompleted: state.pomodorosCompleted + 1
        })),

      updateTimerSettings: (settings) =>
        set((state) => ({
          timerSettings: { ...state.timerSettings, ...settings }
        })),

      setSoundscape: (type) => {
        const { timerIsRunning, soundscapeVolume } = get();
        set({ soundscape: type });
        if (type === 'off' || !timerIsRunning) {
          stopSoundscape();
        } else {
          playSoundscape(type, soundscapeVolume);
        }
      },

      setSoundscapeVolume: (volume) => {
        set({ soundscapeVolume: volume });
        setAudioVolume(volume);
      }
    }),
    {
      name: 'studyflow_storage_v1',
      partialize: (state) => ({
        user: state.user,
        activeTab: state.activeTab,
        theme: state.theme,
        assignments: state.assignments,
        sessions: state.sessions,
        grades: state.grades,
        pomodorosCompleted: state.pomodorosCompleted,
        timerSettings: state.timerSettings,
        soundscapeVolume: state.soundscapeVolume
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const subtaskMap: Record<string, Subtask[]> = {
            'asg-1': [
              { id: 'st-1', title: 'Review Ongaro-Ousterhout Raft paper', completed: true },
              { id: 'st-2', title: 'Implement Leader Election RPC states', completed: true },
              { id: 'st-3', title: 'Write Log Replication appendEntries handler', completed: true },
              { id: 'st-4', title: 'Run network partition chaos suite', completed: false }
            ],
            'asg-2': [
              { id: 'st-5', title: 'Questions 1–3: Eigenvalues & diagonalization', completed: true },
              { id: 'st-6', title: 'Question 4: Generalized eigenvectors', completed: true },
              { id: 'st-7', title: 'Question 5: Jordan form transformation matrix', completed: false },
              { id: 'st-8', title: 'Question 6: Proof of Kalman rank condition', completed: false }
            ],
            'asg-3': [
              { id: 'st-10', title: 'Color token hierarchy (Light & Dark mode)', completed: true },
              { id: 'st-11', title: 'Typography roles & baseline grid', completed: true },
              { id: 'st-12', title: 'WCAG 2.2 AA Contrast verification (4.5:1 ratio)', completed: true },
              { id: 'st-13', title: 'Export Figma Code Connect specs', completed: false }
            ]
          };

          state.assignments = state.assignments.map((a) => {
            if ((!a.subtasks || a.subtasks.length === 0) && subtaskMap[a.id]) {
              return { ...a, subtasks: subtaskMap[a.id] };
            }
            return a;
          });

          if (!state.grades) {
            state.grades = [];
          }
        }
      }
    }
  )
);
