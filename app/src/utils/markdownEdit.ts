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

const wrap = (text: string, start: number, end: number, mark: string, placeholder: string): EditResult => {
  const chosen = text.slice(start, end);
  // Pressing it again on text that is already wrapped takes the marks off.
  if (chosen.startsWith(mark) && chosen.endsWith(mark) && chosen.length >= mark.length * 2 + 1) {
    const inner = chosen.slice(mark.length, chosen.length - mark.length);
    return { text: text.slice(0, start) + inner + text.slice(end), start, end: start + inner.length };
  }
  const inner = chosen || placeholder;
  const out = text.slice(0, start) + mark + inner + mark + text.slice(end);
  return { text: out, start: start + mark.length, end: start + mark.length + inner.length };
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
