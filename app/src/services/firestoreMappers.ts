import type { Assignment, StudySession, Subtask } from '../types';

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
