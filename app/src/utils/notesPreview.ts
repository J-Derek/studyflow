/** A short plain-text look at an assignment's notes for its card: the formatting marks dropped, at most 200 characters. */
export function notesPreview(body: string): string {
  return body
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '')
    .replace(/\*\*|__|\*|_/g, '')
    .trim()
    .slice(0, 200);
}
