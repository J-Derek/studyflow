/**
 * The age step before the first sign-in on a device.
 *
 * What is asked: an age band, never a date of birth. Under 13: no account (the student can keep using StudyFlow as a guest on
 * their own device). 13 to 17: they tick that a parent or guardian knows and agrees. 18 and over: nothing more.
 * It is a self-declaration, not a check (see docs/COMPLIANCE.md); it is there to treat honest young users carefully.
 */
export type AgeChoice = 'under13' | '13-17' | '18+';

/** What is kept: the band and the tick, and when. Stored on the device, then in the account (`ageConfirmed`). */
export interface AgeRecord {
  band: '13-17' | '18+';
  guardian: boolean;
  at: string;
}

export const AGE_STORAGE_KEY = 'studyflow_age_confirmed';

/** Whether this answer allows an account, and the record to keep when it does. */
export function decideAge(choice: AgeChoice | null, guardianTick: boolean, now: Date = new Date()): { ok: boolean; record: AgeRecord | null } {
  if (choice === '18+') return { ok: true, record: { band: '18+', guardian: false, at: now.toISOString() } };
  if (choice === '13-17' && guardianTick) return { ok: true, record: { band: '13-17', guardian: true, at: now.toISOString() } };
  return { ok: false, record: null };
}

/** Keeps only a well-formed record (a saved copy could be damaged or edited). A 13 to 17 record without the tick is not valid. */
export function cleanAgeRecord(value: unknown): AgeRecord | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.band !== '13-17' && v.band !== '18+') return null;
  if (typeof v.guardian !== 'boolean') return null;
  if (v.band === '13-17' && v.guardian !== true) return null;
  if (typeof v.at !== 'string' || v.at.length < 10 || v.at.length > 40) return null;
  return { band: v.band, guardian: v.guardian, at: v.at };
}

export function readDeviceAge(): AgeRecord | null {
  try {
    const raw = localStorage.getItem(AGE_STORAGE_KEY);
    return raw ? cleanAgeRecord(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveDeviceAge(record: AgeRecord): void {
  try {
    localStorage.setItem(AGE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* storage unavailable: the answer then only lasts until the page closes */
  }
}

export function clearDeviceAge(): void {
  try {
    localStorage.removeItem(AGE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
