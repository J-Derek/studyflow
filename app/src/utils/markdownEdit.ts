/**
 * Formatting buttons for the writing space. Each one returns the new text and where the selection should be, so the editor can
 * apply it to a plain textarea (and so it can be tested without a browser). Only the small Markdown subset the reader understands
 * (utils/miniMarkdown) is produced.
 */
export type FormatKind = 'bold' | 'italic' | 'heading' | 'bullet' | 'numbered';

export interface EditResult {
  text: string;
  start: number;
  end: number;
}

/** How many `*` sit right before `at` (going left) or right after it (going right). */
const starsBefore = (text: string, at: number) => {
  let n = 0;
  while (at - n - 1 >= 0 && text[at - n - 1] === '*') n++;
  return n;
};
const starsAfter = (text: string, at: number) => {
  let n = 0;
  while (text[at + n] === '*') n++;
  return n;
};

/**
 * Whether a run of `n` stars carries this button's mark: bold is two of them (a run of 2, or 3 with italic), italic is one (a run of 1,
 * or 3 with bold). So the italic button never mistakes one of the stars of a bold word for its own.
 */
const carries = (n: number, mark: string) => (mark === '**' ? n >= 2 : n % 2 === 1);

const wrap = (text: string, start: number, end: number, mark: string, placeholder: string): EditResult => {
  const chosen = text.slice(start, end);
  const len = mark.length;

  // Pressing it again on text that is already wrapped (marks selected too) takes the marks off.
  if (chosen.length >= len * 2 + 1 && carries(starsAfter(chosen, 0), mark) && carries(starsBefore(chosen, chosen.length), mark)) {
    const inner = chosen.slice(len, chosen.length - len);
    return { text: text.slice(0, start) + inner + text.slice(end), start, end: start + inner.length };
  }

  // The marks sit just outside the selection (that is how the button leaves it), or around an empty cursor: take them off.
  if (carries(starsBefore(text, start), mark) && carries(starsAfter(text, end), mark)) {
    const from = start - len;
    // A placeholder nobody typed over goes with its marks, so pressing twice leaves the text as it was.
    if (chosen === placeholder || chosen === '') {
      return { text: text.slice(0, from) + text.slice(end + len), start: from, end: from };
    }
    return { text: text.slice(0, from) + chosen + text.slice(end + len), start: from, end: from + chosen.length };
  }

  // At the end of bold (or italic) words just typed, the cursor sits before the closing marks: pressing again steps out of them, so the
  // next words are plain, as in a word processor.
  const lineBefore = text.slice(text.lastIndexOf('\n', start - 1) + 1, start);
  const open = mark === '**' ? /\*\*(?=[^*\s])[^*]*$/ : /(?:^|[^*])\*(?=[^*\s])[^*]*$/;
  if (chosen === '' && carries(starsAfter(text, start), mark) && open.test(lineBefore)) {
    return { text, start: start + len, end: start + len };
  }

  const inner = chosen || placeholder;
  const out = text.slice(0, start) + mark + inner + mark + text.slice(end);
  return { text: out, start: start + len, end: start + len + inner.length };
};

/** The lines (from the start of the first to the end of the last) that the selection touches. */
const lineRange = (text: string, start: number, end: number) => {
  const from = text.lastIndexOf('\n', Math.max(0, start) - 1) + 1;
  const nl = text.indexOf('\n', end);
  return { from, to: nl === -1 ? text.length : nl };
};

export function applyFormat(text: string, start: number, end: number, kind: FormatKind): EditResult {
  if (kind === 'bold') return wrap(text, start, end, '**', 'bold text');
  if (kind === 'italic') return wrap(text, start, end, '*', 'italic text');

  const { from, to } = lineRange(text, start, end);
  const lines = text.slice(from, to).split('\n');
  let changed: string[];
  if (kind === 'heading') {
    // One press makes a heading; pressing on a heading removes it.
    changed = lines.map((l) => (/^#{1,3}\s/.test(l) ? l.replace(/^#{1,3}\s/, '') : `## ${l}`));
  } else if (kind === 'bullet') {
    const all = lines.every((l) => /^\s*[-*]\s/.test(l));
    changed = lines.map((l) => (all ? l.replace(/^(\s*)[-*]\s/, '$1') : `- ${l.replace(/^\s*(?:[-*]|\d+[.)])\s+/, '')}`));
  } else {
    const all = lines.every((l) => /^\s*\d+[.)]\s/.test(l));
    changed = lines.map((l, i) => (all ? l.replace(/^(\s*)\d+[.)]\s/, '$1') : `${i + 1}. ${l.replace(/^\s*(?:[-*]|\d+[.)])\s+/, '')}`));
  }
  const replaced = changed.join('\n');
  return { text: text.slice(0, from) + replaced + text.slice(to), start: from, end: from + replaced.length };
}
