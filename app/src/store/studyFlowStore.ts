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
import { playSoundscape, stopSoundscape, playCompletionChime, setSoundscapeVolume as setAudioVolume } from '../lib/soundscapes';
import {
  syncAssignmentToFirestore,
  deleteAssignmentFromFirestore,
  syncSessionToFirestore,
  deleteSessionFromFirestore,
  syncOnboardingDismissed,
  pushTimerState,
  completeFocusSession
} from '../services/firestoreSync';
import { calculateSubtaskProgress } from '../utils/subtasks';
import { syncThemeColor } from '../utils/themeColor';
import { complete as completeEngine, idleTimer, pause as pauseEngine, reset as resetEngine, start as startEngine, switchMode, type TimerState } from '../lib/timerEngine';
import { buildSampleData, isLegacySeedId } from '../utils/sampleData';

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
  /** uid that the persisted records on this device belong to. */
  dataOwnerUid: string | null;
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
  guestNoticeDismissed: boolean;
  dismissGuestNotice: () => void;
  loadSampleData: () => void;
  icsExportCount: number;
  bumpIcsExport: () => void;
  importLedger: (ledger: { assignments: Assignment[]; sessions: StudySession[]; grades: CourseGrade[] }) => void;
  clearSampleData: () => void;
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
  /** Timestamps and durations only. Remaining time is derived with remainingSeconds(timer, nowMs). */
  timer: TimerState;
  /** Wall clock, refreshed once a second by the scheduler while a timer runs. */
  nowMs: number;
  /** Set when a focus block finishes, so the page can celebrate. */
  focusCompletedAtMs: number | null;
  pomodorosCompleted: number;
  soundscape: SoundscapeType;
  soundscapeVolume: number;
  setTimerMode: (mode: TimerMode) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  completeTimer: () => void;
  setNowMs: (ms: number) => void;
  adoptRemoteTimer: (t: TimerState) => void;
  incrementPomodoros: () => void;
  updateTimerSettings: (settings: Partial<TimerSettings>) => void;
  setSoundscape: (type: SoundscapeType) => void;
  setSoundscapeVolume: (volume: number) => void;
}

const defaultSettings: TimerSettings = {
  focusDuration: 25 * 60,
  shortBreakDuration: 5 * 60,
  longBreakDuration: 15 * 60,
  autoStartBreaks: false,
  autoStartFocus: false
};

function durationFor(mode: TimerMode, settings: TimerSettings): number {
  if (mode === 'shortBreak') return settings.shortBreakDuration;
  if (mode === 'longBreak') return settings.longBreakDuration;
  return settings.focusDuration;
}

export const useStudyFlowStore = create<StudyFlowState>()(
  persist(
    (set, get) => ({
      userId: null,
      dataOwnerUid: null,
      isAnonymous: true,
      userEmail: null,
      isSyncing: false,
      setAuthUser: (uid, isAnonymous, email, displayName) => {
        set((state) => ({
          userId: uid,
          dataOwnerUid: uid,
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
          dataOwnerUid: null,
          isAnonymous: true,
          userEmail: null,
          isSyncing: false,
          assignments: [],
          sessions: [],
          grades: [],
          onboardingDismissed: false,
          guestNoticeDismissed: false,
          pomodorosCompleted: 0,
          timer: idleTimer('focus', defaultSettings.focusDuration),
          focusCompletedAtMs: null,
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

      guestNoticeDismissed: false,
      dismissGuestNotice: () => set({ guestNoticeDismissed: true }),

      onboardingDismissed: false,
      dismissOnboarding: () => {
        set({ onboardingDismissed: true });
        const uid = get().userId;
        if (uid) syncOnboardingDismissed(uid).catch(console.warn);
      },

      icsExportCount: 0,
      bumpIcsExport: () => set((state) => ({ icsExportCount: state.icsExportCount + 1 })),

      loadSampleData: () => {
        const sample = buildSampleData();
        const state = get();
        const known = new Set(state.assignments.map((x) => x.id));
        const newAssignments = sample.assignments.filter((x) => !known.has(x.id));
        const knownSessions = new Set(state.sessions.map((x) => x.id));
        const newSessions = sample.sessions.filter((x) => !knownSessions.has(x.id));
        const knownGrades = new Set(state.grades.map((x) => x.id));
        const newGrades = sample.grades.filter((x) => !knownGrades.has(x.id));
        set({
          assignments: [...newAssignments, ...state.assignments],
          sessions: [...state.sessions, ...newSessions],
          grades: [...state.grades, ...newGrades]
        });
        const uid = state.userId;
        if (uid) {
          newAssignments.forEach((x) => syncAssignmentToFirestore(uid, x).catch(console.warn));
          newSessions.forEach((x) => syncSessionToFirestore(uid, x).catch(console.warn));
        }
      },

      importLedger: (ledger) => {
        const state = get();
        const uid = state.userId;
        const keepA = new Set(ledger.assignments.map((x) => x.id));
        const keepS = new Set(ledger.sessions.map((x) => x.id));
        const removedA = state.assignments.filter((x) => !keepA.has(x.id));
        const removedS = state.sessions.filter((x) => !keepS.has(x.id));
        set({ assignments: ledger.assignments, sessions: ledger.sessions, grades: ledger.grades });
        if (uid) {
          // A restore replaces the account's data in the cloud too; otherwise the next snapshot undoes it.
          ledger.assignments.forEach((x) => syncAssignmentToFirestore(uid, x).catch(console.warn));
          ledger.sessions.forEach((x) => syncSessionToFirestore(uid, x).catch(console.warn));
          removedA.forEach((x) => deleteAssignmentFromFirestore(uid, x.id).catch(console.warn));
          removedS.forEach((x) => deleteSessionFromFirestore(uid, x.id).catch(console.warn));
        }
      },

      clearSampleData: () => {
        const state = get();
        const sampleAssignments = state.assignments.filter((x) => x.sample);
        const sampleSessions = state.sessions.filter((x) => x.sample);
        set({
          assignments: state.assignments.filter((x) => !x.sample),
          sessions: state.sessions.filter((x) => !x.sample),
          grades: state.grades.filter((x) => !x.sample)
        });
        const uid = state.userId;
        if (uid) {
          sampleAssignments.forEach((x) => deleteAssignmentFromFirestore(uid, x.id).catch(console.warn));
          sampleSessions.forEach((x) => deleteSessionFromFirestore(uid, x.id).catch(console.warn));
        }
      },

      clearAllData: () => {
        const state = get();
        const uid = state.userId;
        if (uid) {
          state.assignments.forEach((x) => deleteAssignmentFromFirestore(uid, x.id).catch(console.warn));
          state.sessions.forEach((x) => deleteSessionFromFirestore(uid, x.id).catch(console.warn));
        }
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

      assignments: [],
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
              const currentSubtasks: Subtask[] = a.subtasks ?? [];
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
              const currentSubtasks: Subtask[] = a.subtasks ?? [];
              const newSubtask: Subtask = {
                id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                title,
                completed: false
              };
              const updatedSubtasks = [...currentSubtasks, newSubtask];
              const { progress, status, allDone } = calculateSubtaskProgress(updatedSubtasks, a.progress, { allowComplete: false });
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
              const { progress, status, allDone } = calculateSubtaskProgress(updatedSubtasks, a.progress, { allowComplete: false });
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

      sessions: [],
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

      grades: [],
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
      timer: idleTimer('focus', defaultSettings.focusDuration),
      nowMs: Date.now(),
      focusCompletedAtMs: null,
      pomodorosCompleted: 0,
      soundscape: 'off',
      soundscapeVolume: 0.35,

      setTimerMode: (mode) => {
        stopSoundscape();
        const next = switchMode(mode, durationFor(mode, get().timerSettings));
        set({ timer: next, nowMs: Date.now() });
        const uid = get().userId;
        if (uid) pushTimerState(uid, next);
      },

      startTimer: () => {
        const { soundscape, soundscapeVolume, timer } = get();
        if (timer.status === 'running') return;
        if (soundscape !== 'off') playSoundscape(soundscape, soundscapeVolume);
        const now = Date.now();
        const next = startEngine(timer, now);
        set({ timer: next, nowMs: now });
        const uid = get().userId;
        if (uid) pushTimerState(uid, next);
      },

      pauseTimer: () => {
        stopSoundscape();
        const now = Date.now();
        const next = pauseEngine(get().timer, now);
        set({ timer: next, nowMs: now });
        const uid = get().userId;
        if (uid) pushTimerState(uid, next);
      },

      resetTimer: () => {
        stopSoundscape();
        const next = resetEngine(get().timer);
        set({ timer: next, nowMs: Date.now() });
        const uid = get().userId;
        if (uid) pushTimerState(uid, next);
      },

      /** Called by the scheduler when a running block has used all of its time. Safe to call twice. */
      completeTimer: () => {
        const { timer, userId } = get();
        if (timer.status !== 'running') return;
        stopSoundscape();
        const wasFocus = timer.mode === 'focus';
        const now = Date.now();
        const next = completeEngine(timer);
        set((state) => ({
          timer: next,
          nowMs: now,
          pomodorosCompleted: wasFocus ? state.pomodorosCompleted + 1 : state.pomodorosCompleted,
          focusCompletedAtMs: wasFocus ? now : state.focusCompletedAtMs
        }));
        if (wasFocus) playCompletionChime();
        if (userId) {
          if (wasFocus) completeFocusSession(userId, timer);
          else pushTimerState(userId, next);
        }
      },

      setNowMs: (ms) => set({ nowMs: ms }),

      adoptRemoteTimer: (t) => {
        if (get().timer.status === 'running' && t.status !== 'running') stopSoundscape();
        set({ timer: t, nowMs: Date.now() });
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
        const { timer, soundscapeVolume } = get();
        set({ soundscape: type });
        if (type === 'off' || timer.status !== 'running') {
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
        dataOwnerUid: state.dataOwnerUid,
        guestNoticeDismissed: state.guestNoticeDismissed,
        icsExportCount: state.icsExportCount,
        user: state.user,
        theme: state.theme,
        assignments: state.assignments,
        sessions: state.sessions,
        grades: state.grades,
        pomodorosCompleted: state.pomodorosCompleted,
        timer: state.timer,
        timerSettings: state.timerSettings,
        soundscapeVolume: state.soundscapeVolume
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Earlier builds seeded demo rows as the student's own data. Flag them so they are labelled
        // and excluded from GPA, backups and exports.
        state.assignments = (state.assignments ?? []).map((x) => (isLegacySeedId('assignment', x.id) ? { ...x, sample: true } : x));
        state.sessions = (state.sessions ?? []).map((x) => (isLegacySeedId('session', x.id) ? { ...x, sample: true } : x));
        state.grades = (state.grades ?? []).map((x) => (isLegacySeedId('grade', x.id) ? { ...x, sample: true } : x));
      }
    }
  )
);
