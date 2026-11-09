/// <reference types="node" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};

const cspValue = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy-Report-Only')?.value ?? '';
const hash = (text: string) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

describe('Content-Security-Policy header (vercel.json)', () => {
  it('is there, and does not allow arbitrary scripts', () => {
    expect(cspValue).not.toBe('');
    const scriptSrc = cspValue.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src ')) ?? '';
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(scriptSrc).not.toMatch(/ \*( |$)/);
    expect(cspValue).toContain("object-src 'self' blob:");
    expect(cspValue).toContain("base-uri 'self'");
  });

  it('lists the hash of the inline theme script in index.html, in both line-ending forms', () => {
    // The pre-paint theme script is the only inline script. Editing it without updating the header would block it
    // (the page would flash the wrong theme), so this fails until the hashes are refreshed. A Windows checkout
    // deploys it with CRLF line endings, a Linux one with LF, so both forms are listed.
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)];
    expect(inline).toHaveLength(1);
    const lf = inline[0][1].replace(/\r\n/g, '\n');
    expect(cspValue).toContain(hash(lf));
    expect(cspValue).toContain(hash(lf.replace(/\n/g, '\r\n')));
  });

  it('does not touch the sign-in helper pages, which Firebase serves', () => {
    const entry = vercel.headers.find((h) => h.headers.some((x) => x.key === 'Content-Security-Policy-Report-Only'));
    expect(entry?.source).toBe('/((?!__/).*)');
  });
});
