export interface TextPart {
  type: 'text' | 'link';
  value: string;
  /** Only set for links; always an http or https address. */
  href?: string;
}

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/gi;
// Punctuation that usually ends a sentence rather than the address.
const TRAILING = /[.,;:!?)\]}]+$/;

/**
 * Splits plain text into text and link parts so web addresses can be shown as links.
 * Only http and https addresses become links; nothing is ever treated as markup.
 */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    let url = match[0];
    const trailing = url.match(TRAILING)?.[0] ?? '';
    if (trailing) url = url.slice(0, url.length - trailing.length);
    if (start > last) parts.push({ type: 'text', value: text.slice(last, start) });
    parts.push({ type: 'link', value: url, href: url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}
