/**
 * The "Download my data" file. One place builds it, so the Your account dialog and the error screen
 * (where the page itself may be broken) produce exactly the same file.
 */
interface Ledger {
  assignments: { sample?: boolean }[];
  sessions: { sample?: boolean }[];
  grades: { sample?: boolean }[];
  notes: unknown[];
  drafts?: unknown[];
}

export const BACKUP_VERSION = 'StudyFlow-v1.2';

/** The student's own records (sample rows are not theirs) in the backup format `validateBackupJson` reads back. */
export function buildBackup(state: Ledger, now: Date = new Date()) {
  return {
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    ledger: {
      assignments: state.assignments.filter((x) => !x.sample),
      sessions: state.sessions.filter((x) => !x.sample),
      grades: state.grades.filter((x) => !x.sample),
      notes: state.notes,
      ...(state.drafts ? { drafts: state.drafts } : {})
    }
  };
}

/** Starts the download of `data` as studyflow-data-YYYY-MM-DD.json. */
export function downloadBackup(data: unknown, now: Date = new Date()): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `studyflow-data-${now.toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * For the error screen: build the backup from the saved copy on this device, without touching the store (which may be
 * the thing that is broken). Returns null when there is nothing readable to save.
 */
export function backupFromSavedCopy(raw: string | null, now: Date = new Date()) {
  if (!raw) return null;
  try {
    const state = (JSON.parse(raw) as { state?: Partial<Record<keyof Ledger, unknown>> }).state;
    if (!state || typeof state !== 'object') return null;
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
    return buildBackup(
      { assignments: list(state.assignments), sessions: list(state.sessions), grades: list(state.grades), notes: list(state.notes), drafts: list(state.drafts) },
      now
    );
  } catch {
    return null;
  }
}
