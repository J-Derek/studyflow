import type { Assignment, CourseGrade, Note, StudySession, Subtask, UserPreferences } from '../types';
import { sanitizeTimerPrefs, type TimerPrefs } from '../utils/devicePrefs';

type Doc = Record<string, unknown>;

const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Firestore rejects `undefined`; the rules also reject unknown keys, so only known keys are emitted. */
export function assignmentToDoc(a: Assignment): Doc {
  const out: Doc = {
    id: a.id,
    title: a.title,
    course: a.course,
    dueDate: a.dueDate,
    priority: a.priority,
    status: a.status,
    progress: Number.isFinite(a.progress) ? a.progress : 0,
    createdAt: a.createdAt
  };
  if (a.dueTime && TIME_RE.test(a.dueTime)) out.dueTime = a.dueTime;
  if (a.notes) out.notes = a.notes;
  if (a.completedAt) out.completedAt = a.completedAt;
  if (a.sample) out.sample = true;
  if (a.subtasks && a.subtasks.length > 0) {
    // A map keyed by subtask id so concurrent edits to different subtasks both survive.
    const map: Record<string, { id: string; title: string; completed: boolean; order: number }> = {};
    a.subtasks.forEach((s, order) => {
      map[s.id] = { id: s.id, title: s.title, completed: s.completed, order };
    });
    out.subtasks = map;
  }
  return out;
}

function readSubtasks(raw: unknown): Subtask[] | undefined {
  if (Array.isArray(raw)) {
    // Legacy documents stored a list.
    return raw
      .filter((s): s is Subtask => !!s && typeof s === 'object' && typeof (s as Subtask).id === 'string')
      .map((s) => ({ id: s.id, title: String(s.title ?? ''), completed: s.completed === true }));
  }
  if (raw && typeof raw === 'object') {
    return Object.values(raw as Record<string, { id?: unknown; title?: unknown; completed?: unknown; order?: unknown }>)
      .filter((s) => typeof s?.id === 'string')
      .sort((x, y) => (Number(x.order) || 0) - (Number(y.order) || 0))
      .map((s) => ({ id: s.id as string, title: String(s.title ?? ''), completed: s.completed === true }));
  }
  return undefined;
}

export function docToAssignment(id: string, data: Doc): Assignment {
  const subtasks = readSubtasks(data.subtasks);
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    course: typeof data.course === 'string' ? data.course : '',
    dueDate: typeof data.dueDate === 'string' ? data.dueDate : '',
    dueTime: typeof data.dueTime === 'string' ? data.dueTime : undefined,
    priority: data.priority === 'low' || data.priority === 'high' ? data.priority : 'medium',
    status: data.status === 'in_progress' || data.status === 'completed' ? data.status : 'pending',
    progress: typeof data.progress === 'number' && Number.isFinite(data.progress) ? data.progress : 0,
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    subtasks,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
    completedAt: typeof data.completedAt === 'string' ? data.completedAt : undefined,
    sample: data.sample === true ? true : undefined
  };
}

export function sessionToDoc(s: StudySession): Doc {
  const out: Doc = {
    id: s.id,
    title: s.title,
    course: s.course,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    type: s.type
  };
  if (s.color) out.color = s.color;
  if (s.sample) out.sample = true;
  return out;
}

export function docToSession(id: string, data: Doc): StudySession {
  const types = ['lecture', 'lab', 'study', 'review', 'exam'] as const;
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    course: typeof data.course === 'string' ? data.course : '',
    dayOfWeek: typeof data.dayOfWeek === 'number' ? data.dayOfWeek : 1,
    startTime: typeof data.startTime === 'string' ? data.startTime : '09:00',
    endTime: typeof data.endTime === 'string' ? data.endTime : '10:00',
    type: types.find((t) => t === data.type) ?? 'study',
    color: typeof data.color === 'string' ? data.color : undefined,
    sample: data.sample === true ? true : undefined
  };
}

export function gradeToDoc(g: CourseGrade): Doc {
  const out: Doc = {
    id: g.id,
    courseCode: g.courseCode,
    courseName: g.courseName,
    credits: Number.isFinite(g.credits) ? g.credits : 0,
    targetLetter: g.targetLetter,
    color: g.color,
    // Firestore rejects `undefined`, so an ungraded assessment simply has no `score` key.
    assessments: g.assessments.map((a) => ({
      id: a.id,
      name: a.name,
      weight: Number.isFinite(a.weight) ? a.weight : 0,
      ...(typeof a.score === 'number' && Number.isFinite(a.score) ? { score: a.score } : {})
    }))
  };
  if (g.sample) out.sample = true;
  return out;
}

export function docToGrade(id: string, data: Doc): CourseGrade {
  const raw = Array.isArray(data.assessments) ? data.assessments : [];
  return {
    id,
    courseCode: typeof data.courseCode === 'string' ? data.courseCode : '',
    courseName: typeof data.courseName === 'string' ? data.courseName : '',
    credits: typeof data.credits === 'number' && Number.isFinite(data.credits) ? data.credits : 0,
    targetLetter: typeof data.targetLetter === 'string' ? data.targetLetter : 'A',
    color: typeof data.color === 'string' ? data.color : '#4F46E5',
    assessments: raw
      .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
      .map((a) => ({
        id: String(a.id ?? ''),
        name: String(a.name ?? ''),
        weight: typeof a.weight === 'number' ? a.weight : 0,
        ...(typeof a.score === 'number' ? { score: a.score } : {})
      })),
    sample: data.sample === true ? true : undefined
  };
}

const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const PHOTO_PREFIX = 'data:image/jpeg;base64,';
export const MAX_PHOTO_CHARS = 60000;

/** Only a small JPEG data URL is allowed through; anything else is treated as "no picture". */
export function validPhoto(photo: string | null | undefined): photo is string {
  return typeof photo === 'string' && photo.startsWith(PHOTO_PREFIX) && photo.length <= MAX_PHOTO_CHARS;
}

/**
 * The student's profile as stored under users/{uid}. Fields that are not set are left out (the sync turns
 * them into deletions); the rules reject unknown keys, so only known ones are emitted.
 */
export function profileToDoc(uid: string, user: UserPreferences, photo: string | null): Doc {
  const out: Doc = {
    uid,
    name: user.name.trim().slice(0, 100) || 'Student',
    university: user.university.trim().slice(0, 150) || 'My university',
    program: user.program.trim().slice(0, 150) || 'My programme',
    semester: user.semester.trim().slice(0, 50) || 'Current semester'
  };
  if (user.semesterStart && DATE_RE.test(user.semesterStart)) out.semesterStart = user.semesterStart;
  if (user.semesterEnd && DATE_RE.test(user.semesterEnd)) out.semesterEnd = user.semesterEnd;
  if (user.timeZone) out.timeZone = user.timeZone.slice(0, 64);
  if (validPhoto(photo)) out.photo = photo;
  return out;
}

/**
 * Timer lengths, auto-start choices and sounds as stored in the user document's `timerPrefs` map.
 * Every key is always present, which is what firestore.rules requires.
 */
export function timerPrefsToDoc(p: TimerPrefs): Doc {
  const clean = sanitizeTimerPrefs(p);
  const t = clean.timerSettings ?? p.timerSettings;
  return {
    focusDuration: t.focusDuration,
    shortBreakDuration: t.shortBreakDuration,
    longBreakDuration: t.longBreakDuration,
    autoStartBreaks: t.autoStartBreaks === true,
    autoStartFocus: t.autoStartFocus === true,
    soundscape: clean.soundscape ?? 'off',
    breakSoundscape: clean.breakSoundscape ?? 'off',
    soundscapeVolume: clean.soundscapeVolume ?? 0.35
  };
}

/** The reverse. Anything missing or invalid is simply left out, so the caller keeps its own value. */
export function docToTimerPrefs(raw: unknown): Partial<TimerPrefs> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Doc;
  return sanitizeTimerPrefs({
    timerSettings: {
      focusDuration: r.focusDuration,
      shortBreakDuration: r.shortBreakDuration,
      longBreakDuration: r.longBreakDuration,
      autoStartBreaks: r.autoStartBreaks,
      autoStartFocus: r.autoStartFocus
    },
    soundscape: r.soundscape,
    breakSoundscape: r.breakSoundscape,
    soundscapeVolume: r.soundscapeVolume
  });
}

/** The reverse: what a stored profile document means for the app. Missing optional fields come back unset. */
export function docToProfile(data: Doc): { user: Partial<UserPreferences>; photo: string | null } {
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const user: Partial<UserPreferences> = {};
  const name = str(data.name);
  const university = str(data.university);
  const program = str(data.program);
  const semester = str(data.semester);
  if (name) user.name = name;
  if (university) user.university = university;
  if (program) user.program = program;
  if (semester) user.semester = semester;
  const start = str(data.semesterStart);
  const end = str(data.semesterEnd);
  const zone = str(data.timeZone);
  user.semesterStart = start && DATE_RE.test(start) ? start : undefined;
  user.semesterEnd = end && DATE_RE.test(end) ? end : undefined;
  user.timeZone = zone || undefined;
  const photo = str(data.photo);
  return { user, photo: validPhoto(photo) ? photo : null };
}

export const MAX_NOTE_TITLE = 200;
export const MAX_NOTE_BODY = 20000;
export const MAX_NOTE_COURSE = 50;

/** A note as stored. The limits match firestore.rules; the app's own inputs stop well short of them. */
export function noteToDoc(n: Note): Doc {
  return {
    id: n.id,
    title: n.title.trim().slice(0, MAX_NOTE_TITLE) || 'Untitled note',
    body: n.body.slice(0, MAX_NOTE_BODY),
    course: n.course.trim().slice(0, MAX_NOTE_COURSE),
    pinned: n.pinned === true,
    createdAt: n.createdAt,
    editedAt: n.editedAt
  };
}

export function docToNote(id: string, data: Doc): Note {
  const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
  const created = str(data.createdAt, new Date(0).toISOString());
  return {
    id,
    title: str(data.title, 'Untitled note') || 'Untitled note',
    body: str(data.body),
    course: str(data.course),
    pinned: data.pinned === true,
    createdAt: created,
    editedAt: str(data.editedAt, created)
  };
}
