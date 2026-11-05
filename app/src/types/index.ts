export type Priority = 'low' | 'medium' | 'high';
export type AssignmentStatus = 'pending' | 'in_progress' | 'completed';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Assignment {
  id: string;
  title: string;
  course: string;
  dueDate: string; // ISO date string YYYY-MM-DD
  dueTime?: string; // HH:mm
  priority: Priority;
  status: AssignmentStatus;
  progress: number; // 0 - 100
  notes?: string;
  subtasks?: Subtask[];
  createdAt: string;
  completedAt?: string;
  /** Demo content added via the Help menu. Excluded from GPA, backups, .ics and the checklist. */
  sample?: boolean;
}

export interface StudySession {
  id: string;
  title: string;
  course: string;
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  type: 'lecture' | 'lab' | 'study' | 'review' | 'exam';
  color?: string;
  sample?: boolean;
}

export interface Assessment {
  id: string;
  name: string;
  weight: number; // percentage (e.g. 25 = 25%)
  score?: number; // percentage 0-100 or null/undefined if upcoming
}

export interface CourseGrade {
  id: string;
  courseCode: string;
  courseName: string;
  credits: number;
  targetLetter: string; // e.g. 'A', 'A-', 'B+'
  color: string;
  assessments: Assessment[];
  sample?: boolean;
}

export type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

export interface TimerSettings {
  focusDuration: number; // in seconds (e.g. 25 * 60)
  shortBreakDuration: number; // in seconds (e.g. 5 * 60)
  longBreakDuration: number; // in seconds (e.g. 15 * 60)
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
}

export interface UserPreferences {
  name: string;
  university: string;
  program: string;
  semester: string;
  avatarUrl?: string;
  /** Term dates and zone used by the .ics export. Stored on this device only. */
  semesterStart?: string;
  semesterEnd?: string;
  timeZone?: string;
}

export type SoundscapeType = 'off' | 'rain' | 'brown' | 'white' | 'binaural';
