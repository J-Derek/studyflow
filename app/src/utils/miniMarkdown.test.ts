import { describe, expect, it } from 'vitest';
import { NOTE_FORMAT, parseInline, parseMarkdown, plainText, safeHref } from './miniMarkdown';

describe('safeHref', () => {
  it('allows web, mail and in-app addresses only', () => {
    expect(safeHref('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(safeHref('http://example.com')).toBe('http://example.com');
    expect(safeHref('mailto:me@example.com')).toBe('mailto:me@example.com');
    expect(safeHref('/privacy')).toBe('/privacy');
  });
  it('refuses everything dangerous or odd', () => {
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', '//evil.example', 'vbscript:x', 'file:///etc/passwd', 'x y', '']) {
      expect(safeHref(bad), bad).toBeNull();
    }
  });
});

describe('parseInline', () => {
  it('reads bold, italic and links, and keeps the rest as text', () => {
    expect(parseInline('a **b** *c* [d](/e) f')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'bold', children: [{ kind: 'text', text: 'b' }] },
      { kind: 'text', text: ' ' },
      { kind: 'italic', children: [{ kind: 'text', text: 'c' }] },
      { kind: 'text', text: ' ' },
      { kind: 'link', href: '/e', children: [{ kind: 'text', text: 'd' }] },
      { kind: 'text', text: ' f' }
    ]);
  });
  it('turns a link with an unsafe address into its words', () => {
    expect(parseInline('[click](javascript:alert(1))')).toEqual([{ kind: 'text', text: 'click' }]);
  });
  it('leaves markup as plain text (nothing is ever HTML)', () => {
    expect(parseInline('<script>alert(1)</script> <img src=x onerror=y>')).toEqual([
      { kind: 'text', text: '<script>alert(1)</script> <img src=x onerror=y>' }
    ]);
  });
  it('copes with lone stars and brackets', () => {
    expect(parseInline('2 * 3 and [not a link] and **open')).toEqual([{ kind: 'text', text: '2 * 3 and [not a link] and **open' }]);
  });
});

describe('parseMarkdown', () => {
  it('reads headings, paragraphs and lists', () => {
    const blocks = parseMarkdown('# Title\n\nFirst line\nsecond line\n\n- one\n- two\n  wrapped\n\n1. a\n2. b\n\n### Small');
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'list', 'list', 'heading']);
    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 1 });
    expect(blocks[1]).toMatchObject({ kind: 'paragraph', spans: [{ kind: 'text', text: 'First line second line' }] });
    const bullets = blocks[2] as { ordered: boolean; items: unknown[] };
    expect(bullets.ordered).toBe(false);
    expect(bullets.items).toHaveLength(2);
    expect((blocks[3] as { ordered: boolean }).ordered).toBe(true);
    expect(blocks[4]).toMatchObject({ kind: 'heading', level: 3 });
  });
  it('handles empty text, Windows line endings and a huge input without trouble', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('a\r\n\r\nb')).toHaveLength(2);
    const big = Array.from({ length: 5000 }, (_, i) => `line ${i} **x**`).join('\n\n');
    expect(parseMarkdown(big)).toHaveLength(5000);
  });
});

describe('plainText, for short previews in lists', () => {
  it('drops the formatting marks and keeps the words, one block per line', () => {
    expect(plainText('## Offer\n\nAn **offer** must be *clear*.\n\n- one\n- [two](https://example.com)')).toBe('Offer\nAn offer must be clear.\none\ntwo');
    expect(plainText('')).toBe('');
  });
});

// Notes were plain text: a line break was a line break, and a pasted web address was a link. Formatting must not take that away.
describe('the note format (Markdown that keeps line breaks and bare web addresses)', () => {
  it('keeps a single line break inside a paragraph', () => {
    expect(parseMarkdown('line one\nline two', NOTE_FORMAT)).toEqual([{ kind: 'paragraph', spans: [{ kind: 'text', text: 'line one\nline two' }] }]);
    // assignment writing keeps joining lines, as before
    expect(parseMarkdown('line one\nline two')).toEqual([{ kind: 'paragraph', spans: [{ kind: 'text', text: 'line one line two' }] }]);
  });
  it('makes a bare web address a link, also inside bold, and leaves other text alone', () => {
    expect(parseMarkdown('see https://example.com/a. now', NOTE_FORMAT)).toEqual([
      {
        kind: 'paragraph',
        spans: [
          { kind: 'text', text: 'see ' },
          { kind: 'link', href: 'https://example.com/a', children: [{ kind: 'text', text: 'https://example.com/a' }] },
          { kind: 'text', text: '. now' }
        ]
      }
    ]);
    expect(parseInline('**go to https://x.org**', NOTE_FORMAT)).toEqual([
      { kind: 'bold', children: [{ kind: 'text', text: 'go to ' }, { kind: 'link', href: 'https://x.org', children: [{ kind: 'text', text: 'https://x.org' }] }] }
    ]);
    expect(parseInline('javascript:alert(1) and www.example.com', NOTE_FORMAT)).toEqual([{ kind: 'text', text: 'javascript:alert(1) and www.example.com' }]);
    expect(parseInline('see https://example.com')).toEqual([{ kind: 'text', text: 'see https://example.com' }]);
  });
});
