import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cleanSignedInHint, type SignedInHint } from '../utils/accountView';
import type {
  Assignment,
  StudySession,
  TimerMode,
  TimerSettings,
  UserPreferences,
  Assessment,
  CourseGrade,
  Draft,
  Note,
  Period,
  PeriodLabel,
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
  syncDraftToFirestore,
  deleteDraftFromFirestore,
  commitArchive,
  syncPeriodToFirestore,
  syncGradeToFirestore,
  deleteGradeFromFirestore,
  pushTimerState,
  completeFocusSession
} from '../services/cloud';
import { calculateSubtaskProgress } from '../utils/subtasks';
import { LIMITS, clampText } from '../utils/limits';
import { syncThemeColor } from '../utils/themeColor';
import { readSavedMode, resolveTheme, saveMode, systemPrefersDark, type ThemeMode } from '../utils/themePreference';
import { isPlaceholderName } from '../utils/placeholderProfile';
import { DEFAULT_SOUND, DEFAULT_TIMER_SETTINGS, DEFAULT_VOLUME, sanitizeTimerPrefs, takeLegacyDevicePrefs, type TimerPrefs } from '../utils/devicePrefs';
import { reportSyncError } from '../lib/syncErrors';
import { TIMER_LIMITS_MIN, complete as completeEngine, idleTimer, pause as pauseEngine, reset as resetEngine, start as startEngine, switchMode, type TimerState } from '../lib/timerEngine';
import { buildSampleData, isLegacySeedId } from '../utils/sampleData';
import { clampScore } from '../utils/academicCalculations';
import { afterUncomplete } from '../utils/progress';
import { newPeriodId, planArchive, type CarryChoice } from '../utils/periods';
import { MAX_DRAFT_BODY } from '../services/firestoreMappers';
import { normalizeAssessments } from '../utils/assessments';

export type NavigationTab = 'dashboard' | 'assignments' | 'calendar' | 'timer' | 'courses' | 'notes';

/** The pages that explain the app's rules (draft legal text). */
export type LegalTab = 'privacy' | 'terms' | 'children' | 'storage' | 'accessibility';
export const LEGAL_TABS: LegalTab[] = ['privacy', 'terms', 'children', 'storage', 'accessibility'];

/** The six pages, the legal pages, and what the app shows for an address it does not have. */
export type AppTab = NavigationTab | LegalTab | 'notfound';

export function getTabFromPath(path: string): AppTab {
  const clean = path.replace(/\/$/, '').toLowerCase();
  if (clean === '' || clean === '/') return 'dashboard';
  if (clean === '/assignments') return 'assignments';
  if (clean === '/calendar') return 'calendar';
  if (clean === '/timer') return 'timer';
  // "Grades" became "Courses"; the old address (bookmarks, links, the sitemap) still lands on the right page.
  if (clean === '/courses' || clean === '/grades') return 'courses';
  if (clean === '/notes') return 'notes';
  const legal = LEGAL_TABS.find((t) => clean === `/${t}`);
  if (legal) return legal;
  return 'notfound';
}

export function getPathFromTab(tab: NavigationTab | LegalTab): string {
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
  /** The name on the student's Google account (null for guests). Used to replace a placeholder profile name. */
  authDisplayName: string | null;
  /** Last signed-in account on this device, for the header while auth starts up after a reload (display only, see utils/accountView). */
  signedInHint: SignedInHint | null;
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
  importLedger: (ledger: { assignments: Assignment[]; sessions: StudySession[]; grades: CourseGrade[]; notes?: Note[]; drafts?: Draft[]; periods?: Period[] }) => void;
  clearSampleData: () => void;
  clearAllData: () => void;

  // Active Navigation Tab
  activeTab: AppTab;
  setActiveTab: (tab: NavigationTab | LegalTab) => void;

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

  // Past semesters: what was archived (never deleted), and the periods it belongs to.
  periods: Period[];
  archived: { assignments: Assignment[]; sessions: StudySession[]; grades: CourseGrade[]; notes: Note[] };
  /** Archives everything not carried over, starts the new period with this name and label. Returns the new period's id. */
  startNewPeriod: (opts: { name: string; label: PeriodLabel; carry: CarryChoice }) => string;

  // Writing space: one draft per assignment (id = the assignment's id)
  drafts: Draft[];
  /** Saves the text written for an assignment (an empty text removes the draft). */
  saveDraft: (assignmentId: string, body: string) => void;
  deleteDraft: (assignmentId: string) => void;

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
  syncDraftToFirestore: 'your writing',
  commitArchive: 'the archive of your old semester',
  syncPeriodToFirestore: 'your semester record',
  deleteDraftFromFirestore: 'writing you deleted',
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
      authDisplayName: null,
      signedInHint: null,
      setAuthUser: (uid, isAnonymous, email, displayName, photoUrl) => {
        set((state) => ({
          userId: uid,
          dataOwnerUid: uid,
          isAnonymous,
          userEmail: email || null,
          userPhotoUrl: photoUrl || null,
          authDisplayName: isAnonymous ? null : displayName || null,
          signedInHint: uid && !isAnonymous ? cleanSignedInHint({ uid, email: email || null, photoUrl: photoUrl || null }) : null,
          // On this device only (never written from here): a placeholder name shows the Google name. If the
          // account has a stored profile, the listener replaces this with it; if not, this is what gets stored.
          user: displayName && !isAnonymous && isPlaceholderName(state.user.name) ? { ...state.user, name: displayName } : state.user
        }));
        // A placeholder name in the account's stored profile is replaced by firestoreSync.cleanUpStoredProfile,
        // which reads the stored copy first, so this device's guest name can never overwrite a real one.
      },

      resetStore: () => {
        set({
          userId: null,
          dataOwnerUid: null,
          isAnonymous: true,
          userEmail: null,
          userPhotoUrl: null,
          authDisplayName: null,
          signedInHint: null,
          customPhotoUrl: null,
          isSyncing: false,
          assignments: [],
          sessions: [],
          grades: [],
          notes: [],
          drafts: [],
          archived: { assignments: [], sessions: [], grades: [], notes: [] },
          periods: [],
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
        // Everything the student has now, current and archived, that the file does not contain is removed, as before.
        const removedG = [...state.grades, ...state.archived.grades].filter((x) => !keepG.has(x.id));
        const removedA = [...state.assignments, ...state.archived.assignments].filter((x) => !keepA.has(x.id));
        const removedS = [...state.sessions, ...state.archived.sessions].filter((x) => !keepS.has(x.id));
        // Items in the file that belong to a past semester go to the archive, the rest are current.
        const cur = <T extends { archivedPeriod?: string }>(l: T[]) => l.filter((x) => !x.archivedPeriod);
        const arc = <T extends { archivedPeriod?: string }>(l: T[]) => l.filter((x) => !!x.archivedPeriod);
        set({
          assignments: cur(ledger.assignments),
          sessions: cur(ledger.sessions),
          grades: cur(ledger.grades),
          archived: { assignments: arc(ledger.assignments), sessions: arc(ledger.sessions), grades: arc(ledger.grades), notes: ledger.notes ? arc(ledger.notes) : state.archived.notes }
        });
        if (ledger.periods) {
          set({ periods: ledger.periods });
          if (uid) ledger.periods.forEach((p) => syncPeriodToFirestore(uid, p).catch(failed('syncPeriodToFirestore', () => syncPeriodToFirestore(uid, p))));
        }
        if (ledger.drafts) {
          const keepD = new Set(ledger.drafts.map((x) => x.id));
          const removedD = state.drafts.filter((x) => !keepD.has(x.id));
          set({ drafts: ledger.drafts });
          if (uid) {
            ledger.drafts.forEach((x) => syncDraftToFirestore(uid, x).catch(failed('syncDraftToFirestore', () => syncDraftToFirestore(uid, x))));
            removedD.forEach((x) => deleteDraftFromFirestore(uid, x.id).catch(failed('deleteDraftFromFirestore', () => deleteDraftFromFirestore(uid, x.id))));
          }
        }
        if (ledger.notes) {
          const keepN = new Set(ledger.notes.map((x) => x.id));
          const removedN = [...state.notes, ...state.archived.notes].filter((x) => !keepN.has(x.id));
          set((st) => ({ notes: cur(ledger.notes ?? []), archived: { ...st.archived, notes: arc(ledger.notes ?? []) } }));
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
          state.drafts.forEach((x) => deleteDraftFromFirestore(uid, x.id).catch(failed('deleteDraftFromFirestore', () => deleteDraftFromFirestore(uid, x.id))));
          state.archived.assignments.forEach((x) => deleteAssignmentFromFirestore(uid, x.id).catch(failed('deleteAssignmentFromFirestore', () => deleteAssignmentFromFirestore(uid, x.id))));
          state.archived.sessions.forEach((x) => deleteSessionFromFirestore(uid, x.id).catch(failed('deleteSessionFromFirestore', () => deleteSessionFromFirestore(uid, x.id))));
          state.archived.grades.forEach((x) => deleteGradeFromFirestore(uid, x.id).catch(failed('deleteGradeFromFirestore', () => deleteGradeFromFirestore(uid, x.id))));
          state.archived.notes.forEach((x) => deleteNoteFromFirestore(uid, x.id).catch(failed('deleteNoteFromFirestore', () => deleteNoteFromFirestore(uid, x.id))));
        }
        set({
          assignments: [],
          sessions: [],
          grades: [],
          notes: [],
          drafts: [],
          archived: { assignments: [], sessions: [], grades: [], notes: [] },
          periods: [],
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
              // With a checklist the ticks decide progress; a number sent from outside is ignored (see utils/progress).
              if (updates.progress !== undefined && a.subtasks && a.subtasks.length > 0) updated.progress = a.progress;
              if (updates.progress !== undefined && !(a.subtasks && a.subtasks.length > 0)) {
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

      periods: [],
      archived: { assignments: [], sessions: [], grades: [], notes: [] },
      startNewPeriod: ({ name, label, carry }) => {
        const state = get();
        const id = newPeriodId();
        const plan = planArchive({ assignments: state.assignments, sessions: state.sessions, grades: state.grades, notes: state.notes }, carry, id);
        const tag = <T extends object>(list: T[]): (T & { archivedPeriod: string })[] => list.map((x) => ({ ...x, archivedPeriod: id }));
        const archivedNow = { assignments: tag(plan.archive.assignments), sessions: tag(plan.archive.sessions), grades: tag(plan.archive.grades), notes: tag(plan.archive.notes) };
        const period: Period = {
          id,
          name: name.trim().slice(0, 100) || state.user.semester || 'Past semester',
          label,
          archivedAt: new Date().toISOString(),
          // What is being archived is named after the period that has just ended, so the name is the OLD period's.
          counts: { assignments: archivedNow.assignments.length, sessions: archivedNow.sessions.length, grades: archivedNow.grades.length, notes: archivedNow.notes.length }
        };
        // The record is named after the period that ended; the new one is named by the student in the dialog.
        const ended: Period = { ...period, name: (state.user.semester || 'Past semester').trim().slice(0, 100), label: state.user.periodLabel ?? 'semester' };
        set((st) => ({
          assignments: plan.keep.assignments,
          sessions: plan.keep.sessions,
          grades: plan.keep.grades,
          notes: plan.keep.notes,
          archived: {
            assignments: [...st.archived.assignments, ...archivedNow.assignments],
            sessions: [...st.archived.sessions, ...archivedNow.sessions],
            grades: [...st.archived.grades, ...archivedNow.grades],
            notes: [...st.archived.notes, ...archivedNow.notes]
          },
          periods: [ended, ...st.periods],
          user: { ...st.user, semester: period.name, periodLabel: label, semesterStart: undefined, semesterEnd: undefined }
        }));
        const uid = get().userId;
        if (uid) {
          commitArchive(uid, ended, archivedNow, plan.keep.grades).catch(failed('commitArchive', () => commitArchive(uid, ended, archivedNow, plan.keep.grades)));
          syncProfile(uid).catch(failed('syncProfile', () => syncProfile(uid)));
        }
        return id;
      },

      drafts: [],
      saveDraft: (assignmentId, body) => {
        const text = body.slice(0, MAX_DRAFT_BODY);
        const uid = get().userId;
        if (text.trim() === '') {
          get().deleteDraft(assignmentId);
          return;
        }
        const draft: Draft = { id: assignmentId, body: text, editedAt: new Date().toISOString() };
        set((state) => ({ drafts: [draft, ...state.drafts.filter((d) => d.id !== assignmentId)] }));
        if (uid) syncDraftToFirestore(uid, draft).catch(failed('syncDraftToFirestore', () => syncDraftToFirestore(uid, draft)));
      },
      deleteDraft: (assignmentId) => {
        if (!get().drafts.some((d) => d.id === assignmentId)) return;
        set((state) => ({ drafts: state.drafts.filter((d) => d.id !== assignmentId) }));
        const uid = get().userId;
        if (uid) deleteDraftFromFirestore(uid, assignmentId).catch(failed('deleteDraftFromFirestore', () => deleteDraftFromFirestore(uid, assignmentId)));
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
              // Un-marking recalculates: from the checklist ticks if there is one, otherwise the usual halfway value.
              const back = afterUncomplete(a);
              const updated: Assignment = {
                ...a,
                status: isCompleted ? back.status : 'completed',
                progress: isCompleted ? back.progress : 100,
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
        signedInHint: state.signedInHint,
        guestNoticeDismissed: state.guestNoticeDismissed,
        icsExportCount: state.icsExportCount,
        user: state.user,
        customPhotoUrl: state.customPhotoUrl,
        theme: state.theme,
        assignments: state.assignments,
        sessions: state.sessions,
        grades: state.grades,
        notes: state.notes,
        drafts: state.drafts,
        periods: state.periods,
        archived: state.archived,
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
        state.signedInHint = cleanSignedInHint(state.signedInHint);
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
