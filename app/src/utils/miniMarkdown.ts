/**
 * A very small Markdown reader for text we write ourselves (the legal pages) and, later, a student's own drafts.
 * It never produces HTML. It returns plain data (blocks and spans) that React draws as ordinary elements, so there
 * is nothing to sanitise: a "<script>" in the text is just text.
 *
 * Supported: # ## ### headings, paragraphs, "-" or "*" bullet lists, "1." numbered lists, **bold**, *italic*,
 * and [links](address) where the address is https://, http://, mailto: or starts with "/" (an address inside the app).
 */
export type Span =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; children: Span[] }
  | { kind: 'italic'; children: Span[] }
  | { kind: 'link'; href: string; children: Span[] };

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; spans: Span[] }
  | { kind: 'paragraph'; spans: Span[] }
  | { kind: 'list'; ordered: boolean; items: Span[][] };

/** Only these addresses become links. Anything else (javascript:, data:, //host) stays as plain text. */
export function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^https?:\/\/[^\s]+$/i.test(h)) return h;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(h)) return h;
  if (/^\/(?!\/)[A-Za-z0-9\-._~/?#=&%]*$/.test(h)) return h;
  return null;
}

export function parseInline(src: string): Span[] {
  const out: Span[] = [];
  let i = 0;
  let plain = '';
  const flush = () => {
    if (plain) out.push({ kind: 'text', text: plain });
    plain = '';
  };
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^\*\*([^*]+?)\*\*/))) {
      flush();
      out.push({ kind: 'bold', children: parseInline(m[1]) });
      i += m[0].length;
    } else if ((m = rest.match(/^\*([^*\s][^*]*?)\*/))) {
      flush();
      out.push({ kind: 'italic', children: parseInline(m[1]) });
      i += m[0].length;
    } else if ((m = rest.match(/^\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/))) {
      const href = safeHref(m[2]);
      if (href) {
        flush();
        out.push({ kind: 'link', href, children: parseInline(m[1]) });
      } else {
        plain += m[1]; // an unsafe address: keep the words, drop the link
      }
      i += m[0].length;
    } else {
      plain += src[i];
      i += 1;
    }
  }
  flush();
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const endPara = () => {
    if (para.length) blocks.push({ kind: 'paragraph', spans: parseInline(para.join(' ')) });
    para = [];
  };
  const endList = () => {
    if (list) blocks.push({ kind: 'list', ordered: list.ordered, items: list.items.map(parseInline) });
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    let m: RegExpMatchArray | null;
    if (line.trim() === '') {
      endPara();
      endList();
    } else if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      endPara();
      endList();
      blocks.push({ kind: 'heading', level: m[1].length as 1 | 2 | 3, spans: parseInline(m[2]) });
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      endPara();
      if (!list || list.ordered) {
        endList();
        list = { ordered: false, items: [] };
      }
      list.items.push(m[1]);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      endPara();
      if (!list || !list.ordered) {
        endList();
        list = { ordered: true, items: [] };
      }
      list.items.push(m[1]);
    } else if (list && /^\s+\S/.test(raw)) {
      list.items[list.items.length - 1] += ' ' + line.trim(); // a wrapped list line
    } else {
      endList();
      para.push(line.trim());
    }
  }
  endPara();
  endList();
  return blocks;
}
