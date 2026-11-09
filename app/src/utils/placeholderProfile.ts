/**
 * Profile text that was never typed by the student: the guest default, and the fictional sample profile
 * ("Alex Vance") that very early builds saved into some accounts. Such values must not hide the student's
 * real Google name, and are not shown as if they were the student's own details.
 */
const PLACEHOLDER_NAMES = new Set(['student', 'alex vance', 'guest']);
const PLACEHOLDER_DETAILS = new Set([
  'academic workspace',
  'undergraduate',
  'my university',
  'my programme',
  'polytechnic institute',
  'computer engineering',
  'computer science & mathematics'
]);
/** The sample profile's own values, replaced with neutral wording when an account is cleaned up. */
const LEGACY_SAMPLE_DETAILS = new Set(['polytechnic institute', 'computer engineering', 'computer science & mathematics']);

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

export function isPlaceholderName(name: string | null | undefined): boolean {
  return norm(name) === '' || PLACEHOLDER_NAMES.has(norm(name));
}

export function isPlaceholderDetail(text: string | null | undefined): boolean {
  return norm(text) === '' || PLACEHOLDER_DETAILS.has(norm(text));
}

export function isLegacySampleDetail(text: string | null | undefined): boolean {
  return LEGACY_SAMPLE_DETAILS.has(norm(text));
}

/** The real name from a Google account: the account's own, else the Google provider's (a linked guest has only the latter). */
export function googleProfileOf(user: {
  displayName: string | null;
  photoURL: string | null;
  providerData?: ReadonlyArray<{ providerId: string; displayName: string | null; photoURL: string | null } | null>;
}): { name: string | null; photo: string | null } {
  const google = (user.providerData ?? []).find((p) => p?.providerId === 'google.com') ?? null;
  const name = [user.displayName, google?.displayName].find((n) => n && n.trim()) ?? null;
  const photo = [user.photoURL, google?.photoURL].find((p) => p && p.trim()) ?? null;
  return { name: name ? name.trim().slice(0, 100) : null, photo };
}

/**
 * What a stored profile should become for a signed-in student: a placeholder name gives way to the Google
 * name, and the old sample profile's university and programme give way to neutral wording. Returns null
 * when nothing needs to change.
 */
export function cleanUpProfile(
  user: { name: string; university: string; program: string },
  googleName: string | null
): { name: string; university: string; program: string } | null {
  const next = { name: user.name, university: user.university, program: user.program };
  if (googleName && isPlaceholderName(user.name)) next.name = googleName;
  if (isLegacySampleDetail(user.university)) next.university = 'My university';
  if (isLegacySampleDetail(user.program)) next.program = 'My programme';
  const changed = next.name !== user.name || next.university !== user.university || next.program !== user.program;
  return changed ? next : null;
}
