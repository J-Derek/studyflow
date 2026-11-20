/** Pure helpers for sharing a note by link (see services/sharedNotes and firestore.rules, match /sharedNotes). */

export const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;
export const MAX_SHARED_BODY = 100000;
export const MAX_SHARED_TITLE = 200;
export const MAX_SHARED_COURSE = 50;
export const MAX_SHARED_BY = 100;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** A random link id: 24 characters from the browser's cryptographic random source (144 bits), safe in a URL. */
export function newShareId(random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const bytes = random(new Uint8Array(new ArrayBuffer(24)));
  let id = '';
  for (const b of bytes) id += ALPHABET[b & 63];
  return id;
}

export const isShareId = (id: string): boolean => SHARE_ID_PATTERN.test(id);

/** "/s/<id>" -> the id, when it is a well-formed one; anything else -> null. */
export function shareIdFromPath(path: string): string | null {
  const m = /^\/s\/([^/]+)\/?$/.exec(path);
  return m && isShareId(m[1]) ? m[1] : null;
}

export const sharePath = (id: string) => `/s/${id}`;

/** Text as it goes out to the public copy: line endings made plain, invisible control characters dropped, and capped. */
export function cleanSharedText(text: string, max: number): string {
  return text
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, '')
    .slice(0, max);
}
