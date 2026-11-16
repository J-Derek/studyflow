import type { Assignment, Subtask } from '../types';
import { addDays } from './calendarMonth';

/**
 * Weekly repeating deadlines. Only the newest item of a series carries `repeat`. When it is completed (or its due date has passed) the next
 * one is created and the old one stops repeating, so a series is always exactly one live "repeat" item and nothing piles up.
 *
 * The next item's id depends only on the series and the new due date, so two devices that both notice the same item write the same document
 * (no duplicate), and an id never grows however long the series runs.
 */
export interface RepeatResult {
  /** The new items to create. */
  spawned: Assignment[];
  /** Items that changed: the old ones, now without `repeat`. */
  updated: Assignment[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The next due date: a week later, and never in the past (a series that was left alone for a month lands on the first date from today). */
function nextDueDate(due: string, today: string): string {
  let next = addDays(due, 7);
  while (next < today) next = addDays(next, 7);
  return next;
}

export function rollRepeats(assignments: Assignment[], today: string): RepeatResult {
  const ids = new Set(assignments.map((a) => a.id));
  const spawned: Assignment[] = [];
  const updated: Assignment[] = [];
  for (const a of assignments) {
    if (!a.repeat || a.sample || a.archivedPeriod || !DATE_RE.test(a.dueDate)) continue;
    const finished = a.status === 'completed';
    if (!finished && a.dueDate >= today) continue;

    const stopped: Assignment = { ...a };
    delete stopped.repeat;
    updated.push(stopped);

    const due = nextDueDate(a.dueDate, today);
    if (a.repeat.until && due > a.repeat.until) continue;
    const root = a.repeatOf ?? a.id;
    const id = `${root}~${due}`;
    if (ids.has(id)) continue;
    const subtasks: Subtask[] | undefined = a.subtasks?.length
      ? a.subtasks.map((s, i) => ({ id: `${id}-${i}`, title: s.title, completed: false }))
      : undefined;
    spawned.push({
      id,
      title: a.title,
      course: a.course,
      dueDate: due,
      ...(a.dueTime ? { dueTime: a.dueTime } : {}),
      priority: a.priority,
      status: 'pending',
      ...(a.kind ? { kind: a.kind } : {}),
      progress: 0,
      ...(a.notes ? { notes: a.notes } : {}),
      ...(subtasks ? { subtasks } : {}),
      repeat: { ...a.repeat },
      repeatOf: root,
      createdAt: new Date().toISOString()
    });
  }
  return { spawned, updated };
}
