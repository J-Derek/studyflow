import { describe, expect, it } from 'vitest';
import { splitLinks } from './linkify';

describe('splitLinks', () => {
  it('returns plain text untouched', () => {
    expect(splitLinks('Read chapter 4')).toEqual([{ type: 'text', value: 'Read chapter 4' }]);
  });

  it('finds web addresses in the middle of a sentence', () => {
    const parts = splitLinks('Slides: https://drive.google.com/file/d/abc123 for week 2');
    expect(parts).toEqual([
      { type: 'text', value: 'Slides: ' },
      { type: 'link', value: 'https://drive.google.com/file/d/abc123', href: 'https://drive.google.com/file/d/abc123' },
      { type: 'text', value: ' for week 2' }
    ]);
  });

  it('leaves sentence punctuation outside the link', () => {
    const parts = splitLinks('See https://example.com/notes.pdf.');
    expect(parts[1]).toMatchObject({ type: 'link', href: 'https://example.com/notes.pdf' });
    expect(parts[2]).toEqual({ type: 'text', value: '.' });
  });

  it('handles several links', () => {
    expect(splitLinks('a http://x.co b https://y.co c').filter((p) => p.type === 'link')).toHaveLength(2);
  });

  it('never makes links from other schemes', () => {
    const text = 'javascript:alert(1) and data:text/html,<b>x</b> and ftp://x.co';
    expect(splitLinks(text).every((p) => p.type === 'text')).toBe(true);
  });

  it('does not treat markup as links or as anything else', () => {
    const parts = splitLinks('<img src=x onerror=alert(1)> https://ok.co');
    expect(parts[0]).toEqual({ type: 'text', value: '<img src=x onerror=alert(1)> ' });
    expect(parts[1]).toMatchObject({ type: 'link', href: 'https://ok.co' });
  });
});
