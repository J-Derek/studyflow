import { describe, expect, it } from 'vitest';
import { formatBytes, looksLikePdf } from './localFiles';

const bytes = (s: string) => new TextEncoder().encode(s);

describe('local files', () => {
  it('accepts real PDF headers and refuses everything else', () => {
    expect(looksLikePdf(bytes('%PDF-1.7\n'))).toBe(true);
    expect(looksLikePdf(bytes('<html><script>'))).toBe(false);
    expect(looksLikePdf(bytes('PK\u0003\u0004'))).toBe(false); // a zip or pptx renamed to .pdf
    expect(looksLikePdf(new Uint8Array())).toBe(false);
  });
  it('formats sizes for people', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
