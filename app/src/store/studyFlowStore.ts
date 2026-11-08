import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Assignment,
  StudySession,
  TimerMode,
  TimerSettings,
  UserPreferences,
  Assessment,
  CourseGrade,
  Note,
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
  syncProfile,
  syncTimerPrefs,
  syncNoteToFirestore,
  deleteNoteFromFirestore,
  syncGradeToFirestore,
  deleteGradeFromFirestore,
  pushTimerState,
  completeFocusSession
} from '../services/cloud';
import { calculateSubtaskProgress } from '../utils/subtasks';
import { LIMITS, clampText } from '../utils/limits';
import { syncThemeColor } from '../utils/themeColor';
import { readSavedMode, resolveTheme, saveMode, systemPrefersDark, type ThemeMode } from '../utils/themePreference';
import { DEFAULT_SOUND, DEFAULT_TIMER_SETTINGS, DEFAULT_VOLUME, sanitizeTimerPrefs, takeLegacyDevicePrefs, type TimerPrefs } from '../utils/devicePrefs';
import { reportSyncError } from '../lib/syncErrors';
import { TIMER_LIMITS_MIN, complete as completeEngine, idleTimer, pause as pauseEngine, reset as resetEngine, start as startEngine, switchMode, type TimerState } from '../lib/timerEngine';
import { buildSampleData, isLegacySeedId } from '../utils/sampleData';
import { clampScore } from '../utils/academicCalculations';
import { normalizeAssessments } from '../utils/assessments';

export type NavigationTab = 'dashboard' | 'assignments' | 'calendar' | 'timer' | 'grades' | 'notes';

export function getTabFromPath(path: string): NavigationTab {
  const clean = path.replace(/\/$/, '').toLowerCase();
  if (clean === '/assignments') return 'assignments';
  if (clean === '/calendar') return 'calendar';
  if (clean === '/timer') return 'timer';
  if (clean === '/grades') return 'grades';
  if (clean === '/notes') return 'notes';
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
  userPhotoUrl: string | null;
  /** A picture the student chose on this device (small, kept locally). Wins over the Google photo. */
  customPhotoUrl: string | null;
  setCustomPhoto: (url: string | null) => void;
  isSyncing: boolean;
  setAuthUser: (uid: string | null, isAnonymous: boolean, email?: string | null, displayName?: string | null, photoUrl?: string | null) => void;
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
  importLedger: (ledger: { assignments: Assignment[]; sessions: StudySession[]; grades: CourseGrade[]; notes?: Note[] }) => void;
  clearSampleData: () => void;
  clearAllData: () => void;

  // Active Navigation Tab
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;

  // Theme Mode
  /** The theme being shown right now. */
  theme: 'light' | 'dark';
  /** What the student chose: light, dark, or "system" (match the device, and follow it when it changes). */
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setThemeMode: (mode: ThemeMode) => void;

  // Assignments
  assignments: Assignment[];
  addAssignment: (assignment: Omit<Assignment, 'id' | 'createdAt'>) => void;
  updateAssignment: (id: string, updates: Partial<Assignment>) => void;
  deleteAssignment: (id: string) => void;
  /** Puts a just-deleted assignment back (same id), for the Undo button. */
  restoreAssignment: (assignment: Assignment) => void;
  toggleAssignmentComplete: (id: string) => void;

  // Notes
  notes: Note[];
  /** Adds a note and returns its id. */
  addNote: (input: { title: string; body: string; course: string; pinned?: boolean }) => string;
  updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'body' | 'course' | 'pinned'>>, opts?: { touch?: boolean }) => void;
  deleteNote: (id: string) => void;
  /** Puts a just-deleted note back (same id), for the Undo button. */
  restoreNote: (note: Note) => void;
  toggleSubtask: (assignmentId: string, subtaskId: string) => void;
  addSubtask: (assignmentId: string, title: string) => void;
  deleteSubtask: (assignmentId: string, subtaskId: string) => void;

  // Study Sessions (Calendar)
  sessions: StudySession[];
  addSession: (session: Omit<StudySession, 'id'>) => void;
  updateSession: (id: string, updates: Partial<Omit<StudySession, 'id'>>) => void;
  deleteSession: (id: string) => void;

  // Academic Grades & GPA
  grades: CourseGrade[];
  updateAssessmentScore: (courseId: string, assessmentId: string, score: number | undefined) => void;
  /** Replaces a course's assessments (names, weights, scores), after tidying them. */
  setCourseAssessments: (courseId: string, assessments: Assessment[]) => void;
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
  /** Minutes of focus completed. Counted as blocks finish, so changing the timer length never rewrites history. */
  focusMinutes: number;
  /** Sound while focusing. */
  soundscape: SoundscapeType;
  /** Sound during short and long breaks. */
  breakSoundscape: SoundscapeType;
  soundscapeVolume: number;
  setTimerMode: (mode: TimerMode) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  completeTimer: () => void;
  setNowMs: (ms: number) => void;
  adoptRemoteTimer: (t: TimerState) => void;
  incrementPomodoros: () => void;
  /** Changes the lengths. An idle timer takes them at once; with `restartCurrent` a running or paused block restarts at the new length. */
  updateTimerSettings: (settings: Partial<TimerSettings>, opts?: { restartCurrent?: boolean }) => void;
  /** Applies the timer choices stored on the account (from the cloud; never written back). */
  applyAccountTimerPrefs: (prefs: Partial<TimerPrefs>) => void;
  /** Chooses the sound for focus blocks or for breaks (defaults to the current mode). */
  setSoundscape: (type: SoundscapeType, forMode?: 'focus' | 'break') => void;
  setSoundscapeVolume: (volume: number) => void;
}

// Friendly names for the things that can fail to save, used in the "couldn't save" message.
const SYNC_WHAT: Record<string, string> = {
  syncAssignmentToFirestore: 'your assignment',
  deleteAssignmentFromFirestore: 'an assignment you deleted',
  syncSessionToFirestore: 'your class',
  deleteSessionFromFirestore: 'a class you deleted',
  syncGradeToFirestore: 'your course',
  deleteGradeFromFirestore: 'a course you deleted',
  syncNoteToFirestore: 'your note',
  deleteNoteFromFirestore: 'a note you deleted',
  syncProfile: 'your profile',
  syncTimerPrefs: 'your timer settings',
  syncOnboardingDismissed: 'your checklist choice'
};

/** The handler for a failed cloud save: tell the student (with Retry when the save can simply be repeated). */
const failed = (fn: string, retry?: () => Promise<unknown>) => (err: unknown) =>
  reportSyncError(SYNC_WHAT[fn] ?? 'your changes', err, retry);

const defaultSettings: TimerSettings = DEFAULT_TIMER_SETTINGS;

// Timer lengths and sound choices belong to the signed-in account (they sync through the user document),
// so a new person on this device starts from the defaults and never inherits the last person's choices.
let timerPrefsTimer: ReturnType<typeof setTimeout> | undefined;
function saveTimerPrefsSoon(uid: string | null, delayMs = 0): void {
  if (!uid) return;
  clearTimeout(timerPrefsTimer);
  const save = () => syncTimerPrefs(uid).catch(failed('syncTimerPrefs', () => syncTimerPrefs(uid)));
  if (delayMs > 0) timerPrefsTimer = setTimeout(save, delayMs);
  else void save();
}

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
      userPhotoUrl: null,
      customPhotoUrl: null,
      setCustomPhoto: (url) => {
        set({ customPhotoUrl: url });
        const uid = get().userId;
        if (uid) syncProfile(uid).catch(failed('syncProfile', () => syncProfile(uid)));
      },
      isSyncing: false,
      setAuthUser: (uid, isAnonymous, email, displayName, photoUrl) => {
        set((state) => ({
          userId: uid,
          dataOwnerUid: uid,
          isAnonymous,
          userEmail: email || null,
          userPhotoUrl: photoUrl || null,
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
          userPhotoUrl: null,
          customPhotoUrl: null,
          isSyncing: false,
          assignments: [],
          sessions: [],
          grades: [],
          notes: [],
          onboardingDismissed: false,
          guestNoticeDismissed: false,
          pomodorosCompleted: 0,
          focusMinutes: 0,
          timerSettings: defaultSettings,
          soundscape: DEFAULT_SOUND,
          breakSoundscape: DEFAULT_SOUND,
          soundscapeVolume: DEFAULT_VOLUME,
          timer: idleTimer('focus', defaultSettings.focusDuration),
          focusCompletedAtMs: null,
          user: {
            name: 'Student',
            university: 'Academic Workspace',
            program: 'Undergraduate',
            semester: 'Current semester'
          }
        });
      },

      user: {
        name: 'Student',
        university: 'Academic Workspace',
        program: 'Undergraduate',
        semester: 'Current semester'
      },

      updateUser: (updates) => {
        set((state) => ({
          user: { ...state.user, ...updates }
        }));
        const uid = get().userId;
        if (uid) syncProfile(uid).catch(failed('syncProfile', () => syncProfile(uid)));
      },

      guestNoticeDismissed: false,
      dismissGuestNotice: () => set({ guestNoticeDismissed: true }),

      onboardingDismissed: false,
      dismissOnboarding: () => {
        set({ onboardingDismissed: true });
        const uid = get().userId;
        if (uid) syncOnboardingDismissed(uid).catch(failed('syncOnboardingDismissed', () => syncOnboardingDismissed(uid)));
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
          newAssignments.forEach((x) => syncAssignmentToFirestore(uid, x).catch(failed('syncAssignmentToFirestore', () => syncAssignmentToFirestore(uid, x))));
          newSessions.forEach((x) => syncSessionToFirestore(uid, x).catch(failed('syncSessionToFirestore', () => syncSessionToFirestore(uid, x))));
          newGrades.forEach((x) => syncGradeToFirestore(uid, x).catch(failed('syncGradeToFirestore', () => syncGradeToFirestore(uid, x))));
        }
      },

      importLedger: (ledger) => {
        const state = get();
        const uid = state.userId;
        const keepA = new Set(ledger.assignments.map((x) => x.id));
        const keepS = new Set(ledger.sessions.map((x) => x.id));
        const keepG = new Set(ledger.grades.map((x) => x.id));
        const removedG = state.grades.filter((x) => !keepG.has(x.id));
        const removedA = state.assignments.filter((x) => !keepA.has(x.id));
        const removedS = state.sessions.filter((x) => !keepS.has(x.id));
        set({ assignments: ledger.assignments, sessions: ledger.sessions, grades: ledger.grades });
        if (ledger.notes) {
          const keepN = new Set(ledger.notes.map((x) => x.id));
          const removedN = state.notes.filter((x) => !keepN.has(x.id));
          set({ notes: ledger.notes });
          if (uid) {
            ledger.notes.forEach((x) => syncNoteToFirestore(uid, x).catch(failed('syncNoteToFirestore', () => syncNoteToFirestore(uid, x))));
            removedN.forEach((x) => deleteNoteFromFirestore(uid, x.id).catch(failed('deleteNoteFromFirestore', () => deleteNoteFromFirestore(uid, x.id))));
          }
        }
        if (uid) {
          // A restore replaces the account's data in the cloud too; otherwise the next snapshot undoes it.
          ledger.assignments.forEach((x) => syncAssignmentToFirestore(uid, x).catch(failed('syncAssignmentToFirestore', () => syncAssignmentToFirestore(uid, x))));
          ledger.sessions.forEach((x) => syncSessionToFirestore(uid, x).catch(failed('syncSessionToFirestore', () => syncSessionToFirestore(uid, x))));
          removedA.forEach((x) => deleteAssignmentFromFirestore(uid, x.id).catch(failed('deleteAssignmentFromFirestore', () => deleteAssignmentFromFirestore(uid, x.id))));
          removedS.forEach((x) => deleteSessionFromFirestore(uid, x.id).catch(failed('deleteSessionFromFirestore', () => deleteSessionFromFirestore(uid, x.id))));
          ledger.grades.forEach((x) => syncGradeToFirestore(uid, x).catch(failed('syncGradeToFirestore', () => syncGradeToFirestore(uid, x))));
          removedG.forEach((x) => deleteGradeFromFirestore(uid, x.id).catch(failed('deleteGradeFromFirestore', () => deleteGradeFromFirestore(uid, x.id))));
        }
      },

      clearSampleData: () => {
        const state = get();
        const sampleAssignments = state.assignments.filter((x) => x.sample);
        const sampleSessions = state.sessions.filter((x) => x.sample);
        const sampleGrades = state.grades.filter((x) => x.sample);
        set({
          assignments: state.assignments.filter((x) => !x.sample),
          sessions: state.sessions.filter((x) => !x.sample),
          grades: state.grades.filter((x) => !x.sample)
        });
        const uid = state.userId;
        if (uid) {
          sampleAssignments.forEach((x) => deleteAssignmentFromFirestore(uid, x.id).catch(failed('deleteAssignmentFromFirestore', () => deleteAssignmentFromFirestore(uid, x.id))));
          sampleSessions.forEach((x) => deleteSessionFromFirestore(uid, x.id).catch(failed('deleteSessionFromFirestore', () => deleteSessionFromFirestore(uid, x.id))));
          sampleGrades.forEach((x) => deleteGradeFromFirestore(uid, x.id).catch(failed('deleteGradeFromFirestore', () => deleteGradeFromFirestore(uid, x.id))));
        }
      },

      clearAllData: () => {
        const state = get();
        const uid = state.userId;
        if (uid) {
          state.assignments.forEach((x) => deleteAssignmentFromFirestore(uid, x.id).catch(failed('deleteAssignmentFromFirestore', () => deleteAssignmentFromFirestore(uid, x.id))));
          state.sessions.forEach((x) => deleteSessionFromFirestore(uid, x.id).catch(failed('deleteSessionFromFirestore', () => deleteSessionFromFirestore(uid, x.id))));
          state.grades.forEach((x) => deleteGradeFromFirestore(uid, x.id).catch(failed('deleteGradeFromFirestore', () => deleteGradeFromFirestore(uid, x.id))));
          state.notes.forEach((x) => deleteNoteFromFirestore(uid, x.id).catch(failed('deleteNoteFromFirestore', () => deleteNoteFromFirestore(uid, x.id))));
        }
        set({
          assignments: [],
          sessions: [],
          grades: [],
          notes: [],
          pomodorosCompleted: 0,
          focusMinutes: 0
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

      // The choice is kept per device in its own entry, so signing out does not reset it.
      themeMode: readSavedMode() ?? 'light',
      theme: resolveTheme(readSavedMode() ?? 'light', systemPrefersDark()),
      toggleTheme: () => {
        set((state) => {
          const next = state.theme === 'light' ? 'dark' : 'light';
          saveMode(next);
          if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', next === 'dark');
            syncThemeColor(next === 'dark');
          }
          return { theme: next, themeMode: next };
        });
      },
      setThemeMode: (mode) => {
        const theme = resolveTheme(mode, systemPrefersDark());
        set({ themeMode: mode, theme });
        saveMode(mode);
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', theme === 'dark');
          syncThemeColor(theme === 'dark');
        }
      },
      setTheme: (theme) => {
        set({ theme, themeMode: theme });
        saveMode(theme);
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', theme === 'dark');
          syncThemeColor(theme === 'dark');
        }
      },

      assignments: [],
      addAssignment: (assignment) => {
        const newAssignment: Assignment = {
          ...assignment,
          // Whatever the screen sent, never keep text the cloud would refuse.
          title: clampText(assignment.title, LIMITS.assignmentTitle),
          course: clampText(assignment.course, LIMITS.assignmentCourse),
          ...(assignment.notes !== undefined ? { notes: assignment.notes.slice(0, LIMITS.assignmentNotes) } : {}),
          id: `asg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date().toISOString()
        };
        set((state) => ({
          assignments: [newAssignment, ...state.assignments]
        }));
        const uid = get().userId;
        if (uid) {
          syncAssignmentToFirestore(uid, newAssignment).catch((err) => {
            failed('syncAssignmentToFirestore', () => syncAssignmentToFirestore(uid, newAssignment))(err);
          });
        }
      },

      updateAssignment: (id, updates) => {
        set((state) => ({
          assignments: state.assignments.map((a) => {
            if (a.id === id) {
              const updated = { ...a, ...updates };
              if (updates.title !== undefined) updated.title = clampText(updates.title, LIMITS.assignmentTitle);
              if (updates.course !== undefined) updated.course = clampText(updates.course, LIMITS.assignmentCourse);
              if (updates.notes !== undefined) updated.notes = updates.notes.slice(0, LIMITS.assignmentNotes);
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
                  failed('syncAssignmentToFirestore', () => syncAssignmentToFirestore(uid, updated))(err);
                });
              }
              return updated;
            }
            return a;
          })
        }));
      },

      deleteAssignment: (id) => {
        const removed = get().assignments.find((a) => a.id === id);
        set((state) => ({
          assignments: state.assignments.filter((a) => a.id !== id)
        }));
        const uid = get().userId;
        if (uid) {
          deleteAssignmentFromFirestore(uid, id).catch((err) => {
            failed('deleteAssignmentFromFirestore')(err);
            // Put back only this assignment, so anything done since is not undone.
            if (removed) {
              set((state) => (state.assignments.some((a) => a.id === id) ? state : { assignments: [removed, ...state.assignments] }));
            }
          });
        }
      },

      restoreAssignment: (assignment) => {
        set((state) =>
          state.assignments.some((a) => a.id === assignment.id) ? state : { assignments: [assignment, ...state.assignments] }
        );
        const uid = get().userId;
        if (uid) {
          syncAssignmentToFirestore(uid, assignment).catch((err) => {
            failed('syncAssignmentToFirestore', () => syncAssignmentToFirestore(uid, assignment))(err);
          });
        }
      },

      notes: [],
      addNote: (input) => {
        const now = new Date().toISOString();
        const note: Note = {
          id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: input.title.trim().slice(0, 200) || 'Untitled note',
          body: input.body.slice(0, 20000),
          course: input.course.trim().slice(0, 50),
          pinned: input.pinned === true,
          createdAt: now,
          editedAt: now
        };
        set((state) => ({ notes: [note, ...state.notes] }));
        const uid = get().userId;
        if (uid) syncNoteToFirestore(uid, note).catch(failed('syncNoteToFirestore', () => syncNoteToFirestore(uid, note)));
        return note.id;
      },

      updateNote: (id, updates, opts) => {
        let updated: Note | undefined;
        set((state) => ({
          notes: state.notes.map((n) => {
            if (n.id !== id) return n;
            updated = {
              ...n,
              ...(updates.title !== undefined ? { title: updates.title.trim().slice(0, 200) || 'Untitled note' } : {}),
              ...(updates.body !== undefined ? { body: updates.body.slice(0, 20000) } : {}),
              ...(updates.course !== undefined ? { course: updates.course.trim().slice(0, 50) } : {}),
              ...(updates.pinned !== undefined ? { pinned: updates.pinned } : {}),
              editedAt: opts?.touch === false ? n.editedAt : new Date().toISOString()
            };
            return updated;
          })
        }));
        const uid = get().userId;
        const saved = updated as Note | undefined;
        if (uid && saved) syncNoteToFirestore(uid, saved).catch(failed('syncNoteToFirestore', () => syncNoteToFirestore(uid, saved)));
      },

      deleteNote: (id) => {
        const removed = get().notes.find((n) => n.id === id);
        set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
        const uid = get().userId;
        if (uid) {
          deleteNoteFromFirestore(uid, id).catch((err) => {
            failed('deleteNoteFromFirestore')(err);
            if (removed) set((state) => (state.notes.some((n) => n.id === id) ? state : { notes: [removed, ...state.notes] }));
          });
        }
      },

      restoreNote: (note) => {
        set((state) => (state.notes.some((n) => n.id === note.id) ? state : { notes: [note, ...state.notes] }));
        const uid = get().userId;
        if (uid) syncNoteToFirestore(uid, note).catch(failed('syncNoteToFirestore', () => syncNoteToFirestore(uid, note)));
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
                  failed('syncAssignmentToFirestore', () => syncAssignmentToFirestore(uid, updated))(err);
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
              if (uid) syncAssignmentToFirestore(uid, updated).catch(failed('syncAssignmentToFirestore', () => syncAssignmentToFirestore(uid, updated)));
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
              const text = clampText(title, LIMITS.subtaskTitle);
              // The cloud holds at most 100 checklist items per assignment, and an empty one is not useful.
              if (!text || currentSubtasks.length >= LIMITS.subtasksPerAssignment) return a;
              const newSubtask: Subtask = {
                id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                title: text,
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
              if (uid) syncAssignmentToFirestore(uid, updated).catch(failed('syncAssignmentToFirestore', () => syncAssignmentToFirestore(uid, updated)));
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
              if (uid) syncAssignmentToFirestore(uid, updated).catch(failed('syncAssignmentToFirestore', () => syncAssignmentToFirestore(uid, updated)));
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
          title: clampText(session.title, LIMITS.blockTitle),
          course: clampText(session.course, LIMITS.blockCourse),
          id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        };
        set((state) => ({
          sessions: [...state.sessions, newSession]
        }));
        const uid = get().userId;
        if (uid) {
          syncSessionToFirestore(uid, newSession).catch((err) => {
            failed('syncSessionToFirestore', () => syncSessionToFirestore(uid, newSession))(err);
          });
        }
      },

      updateSession: (id, updates) => {
        const previousSessions = get().sessions;
        const current = previousSessions.find((s) => s.id === id);
        if (!current) return;
        const updated: StudySession = { ...current, ...updates, id };
        if (updates.title !== undefined) updated.title = clampText(updates.title, LIMITS.blockTitle);
        if (updates.course !== undefined) updated.course = clampText(updates.course, LIMITS.blockCourse);
        set((state) => ({ sessions: state.sessions.map((s) => (s.id === id ? updated : s)) }));
        const uid = get().userId;
        if (uid) {
          syncSessionToFirestore(uid, updated).catch((err) => {
            failed('syncSessionToFirestore')(err);
            set({ sessions: previousSessions });
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
            failed('deleteSessionFromFirestore')(err);
            set({ sessions: previousSessions });
          });
        }
      },

      grades: [],
      updateAssessmentScore: (courseId, assessmentId, score) => {
        const course = get().grades.find((c) => c.id === courseId);
        if (!course) return;
        const next: CourseGrade = {
          ...course,
          assessments: course.assessments.map((a) => (a.id === assessmentId ? { ...a, score: clampScore(score) } : a))
        };
        set((state) => ({ grades: state.grades.map((c) => (c.id === courseId ? next : c)) }));
        const uid = get().userId;
        if (uid) syncGradeToFirestore(uid, next).catch(failed('syncGradeToFirestore', () => syncGradeToFirestore(uid, next)));
      },

      setCourseAssessments: (courseId, assessments) => {
        const course = get().grades.find((c) => c.id === courseId);
        if (!course) return;
        const next: CourseGrade = { ...course, assessments: normalizeAssessments(assessments) };
        set((state) => ({ grades: state.grades.map((c) => (c.id === courseId ? next : c)) }));
        const uid = get().userId;
        if (uid) syncGradeToFirestore(uid, next).catch(failed('syncGradeToFirestore', () => syncGradeToFirestore(uid, next)));
      },

      addCourseGrade: (course) => {
        const newCourse: CourseGrade = {
          ...course,
          courseCode: clampText(course.courseCode, LIMITS.courseCode),
          courseName: clampText(course.courseName, LIMITS.courseName),
          id: `cg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        };
        set((state) => ({ grades: [...state.grades, newCourse] }));
        const uid = get().userId;
        if (uid) syncGradeToFirestore(uid, newCourse).catch(failed('syncGradeToFirestore', () => syncGradeToFirestore(uid, newCourse)));
      },

      deleteCourseGrade: (courseId) => {
        set((state) => ({ grades: state.grades.filter((c) => c.id !== courseId) }));
        const uid = get().userId;
        if (uid) deleteGradeFromFirestore(uid, courseId).catch(failed('deleteGradeFromFirestore', () => deleteGradeFromFirestore(uid, courseId)));
      },

      // Focus Timer
      timerSettings: defaultSettings,
      timer: idleTimer('focus', defaultSettings.focusDuration),
      nowMs: Date.now(),
      focusCompletedAtMs: null,
      pomodorosCompleted: 0,
      focusMinutes: 0,
      soundscape: DEFAULT_SOUND,
      breakSoundscape: DEFAULT_SOUND,
      soundscapeVolume: DEFAULT_VOLUME,

      setTimerMode: (mode) => {
        stopSoundscape();
        const next = switchMode(mode, durationFor(mode, get().timerSettings));
        set({ timer: next, nowMs: Date.now() });
        const uid = get().userId;
        if (uid) pushTimerState(uid, next);
      },

      startTimer: () => {
        const { soundscape, breakSoundscape, soundscapeVolume, timer } = get();
        if (timer.status === 'running') return;
        const sound = timer.mode === 'focus' ? soundscape : breakSoundscape;
        if (sound !== 'off') playSoundscape(sound, soundscapeVolume);
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
          focusMinutes: wasFocus ? state.focusMinutes + Math.round(timer.durationSec / 60) : state.focusMinutes,
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

      updateTimerSettings: (settings, opts) => {
        const state = get();
        const merged = { ...state.timerSettings, ...settings };
        // Keep every length within the limits (the screen only offers whole minutes; seconds stay possible for tests).
        const within = (sec: number, maxMin: number) => (Number.isFinite(sec) ? Math.min(maxMin * 60, Math.max(1, Math.round(sec))) : 60);
        merged.focusDuration = within(merged.focusDuration, TIMER_LIMITS_MIN.focus);
        merged.shortBreakDuration = within(merged.shortBreakDuration, TIMER_LIMITS_MIN.shortBreak);
        merged.longBreakDuration = within(merged.longBreakDuration, TIMER_LIMITS_MIN.longBreak);
        set({ timerSettings: merged });
        saveTimerPrefsSoon(state.userId);
        // An idle timer takes the new length straight away; a running or paused block keeps its own
        // unless the student asked to restart it at the new length.
        if (state.timer.status === 'idle' || opts?.restartCurrent) {
          if (state.timer.status === 'running') stopSoundscape();
          const next = switchMode(state.timer.mode, durationFor(state.timer.mode, merged));
          set({ timer: next, nowMs: Date.now() });
          if (state.userId) pushTimerState(state.userId, next);
        }
      },

      applyAccountTimerPrefs: (prefs) => {
        const st = get();
        const next: Partial<StudyFlowState> = {};
        if (prefs.timerSettings) next.timerSettings = prefs.timerSettings;
        if (prefs.soundscape) next.soundscape = prefs.soundscape;
        if (prefs.breakSoundscape) next.breakSoundscape = prefs.breakSoundscape;
        if (prefs.soundscapeVolume !== undefined) next.soundscapeVolume = prefs.soundscapeVolume;
        const changedLengths = prefs.timerSettings && JSON.stringify(prefs.timerSettings) !== JSON.stringify(st.timerSettings);
        set(next);
        if (prefs.soundscapeVolume !== undefined) setAudioVolume(prefs.soundscapeVolume);
        // An idle timer shows the account's length; a running or paused block is never disturbed.
        if (changedLengths && prefs.timerSettings && st.timer.status === 'idle') {
          set({ timer: switchMode(st.timer.mode, durationFor(st.timer.mode, prefs.timerSettings)), nowMs: Date.now() });
        }
      },

      setSoundscape: (type, forMode) => {
        const { timer, soundscapeVolume } = get();
        const target = forMode ?? (timer.mode === 'focus' ? 'focus' : 'break');
        set(target === 'focus' ? { soundscape: type } : { breakSoundscape: type });
        saveTimerPrefsSoon(get().userId);
        const playing = target === (timer.mode === 'focus' ? 'focus' : 'break');
        if (!playing) return;
        if (type === 'off' || timer.status !== 'running') {
          stopSoundscape();
        } else {
          playSoundscape(type, soundscapeVolume);
        }
      },

      setSoundscapeVolume: (volume) => {
        set({ soundscapeVolume: volume });
        saveTimerPrefsSoon(get().userId, 600); // the slider fires often; save once it settles
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
        customPhotoUrl: state.customPhotoUrl,
        theme: state.theme,
        assignments: state.assignments,
        sessions: state.sessions,
        grades: state.grades,
        notes: state.notes,
        pomodorosCompleted: state.pomodorosCompleted,
        focusMinutes: state.focusMinutes,
        timer: state.timer,
        timerSettings: state.timerSettings,
        soundscape: state.soundscape,
        breakSoundscape: state.breakSoundscape,
        soundscapeVolume: state.soundscapeVolume
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Older saves only counted blocks; estimate their minutes at the old fixed 25.
        if (typeof state.focusMinutes !== 'number') state.focusMinutes = (state.pomodorosCompleted ?? 0) * 25;
        // Before "match my device" existed the theme lived only in the saved data. Keep that choice.
        const savedMode = readSavedMode();
        if (savedMode === null) {
          state.themeMode = state.theme === 'dark' ? 'dark' : 'light';
          saveMode(state.themeMode);
        } else {
          state.themeMode = savedMode;
          state.theme = resolveTheme(savedMode, systemPrefersDark());
        }
        // Timer and sound choices belong to the account. Keep only valid values from the saved copy, and
        // carry an older per-device entry over once, to the account whose data this device holds.
        const legacy = takeLegacyDevicePrefs();
        const prefs = { ...sanitizeTimerPrefs(state), ...(state.dataOwnerUid ? legacy ?? {} : {}) };
        state.timerSettings = prefs.timerSettings ?? defaultSettings;
        state.soundscape = prefs.soundscape ?? DEFAULT_SOUND;
        state.breakSoundscape = prefs.breakSoundscape ?? DEFAULT_SOUND;
        state.soundscapeVolume = prefs.soundscapeVolume ?? DEFAULT_VOLUME;
        // Earlier builds seeded demo rows as the student's own data. Flag them so they are labelled
        // and excluded from GPA, backups and exports.
        state.assignments = (state.assignments ?? []).map((x) => (isLegacySeedId('assignment', x.id) ? { ...x, sample: true } : x));
        state.sessions = (state.sessions ?? []).map((x) => (isLegacySeedId('session', x.id) ? { ...x, sample: true } : x));
        state.grades = (state.grades ?? []).map((x) => (isLegacySeedId('grade', x.id) ? { ...x, sample: true } : x));
        // An older timetable saved Sunday as 7, which the cloud rules and .ics export reject. Sunday is 0.
        state.sessions = state.sessions.map((x) => (x.dayOfWeek === 7 ? { ...x, dayOfWeek: 0 } : x));
      }
    }
  )
);
