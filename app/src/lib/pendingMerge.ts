import type { Assignment, CourseGrade, Note, StudySession } from '../types';

/**
 * When a guest signs in to a Google account that already exists, the guest's records are copied into
 * that account. If the copy cannot finish (no connection, a rejected write), the records wait here, on
 * this device, until it does. They are tied to one account so they can never land in someone else's.
 */
const KEY = 'studyflow_pending_merge_v1';

export interface PendingMerge {
  /** The Google account that should receive these records. */
  uid: string;
  assignments: Assignment[];
  sessions: StudySession[];
  grades: CourseGrade[];
  notes?: Note[];
}

export function savePendingMerge(pending: PendingMerge): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    /* storage full or unavailable: nothing more we can do */
  }
}

/** The waiting records for this account, or null. Records waiting for a different account are dropped. */
export function readPendingMerge(uid: string): PendingMerge | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as PendingMerge;
    if (!pending || pending.uid !== uid) {
      localStorage.removeItem(KEY);
      return null;
    }
    return {
      uid,
      assignments: Array.isArray(pending.assignments) ? pending.assignments : [],
      sessions: Array.isArray(pending.sessions) ? pending.sessions : [],
      grades: Array.isArray(pending.grades) ? pending.grades : [],
      notes: Array.isArray(pending.notes) ? pending.notes : []
    };
  } catch {
    return null;
  }
}

export function clearPendingMerge(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
