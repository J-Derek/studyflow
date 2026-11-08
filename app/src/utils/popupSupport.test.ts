import { describe, expect, it } from 'vitest';
import { markRedirectPending, REDIRECT_PENDING_KEY, takeRedirectPending, windowOpenIsReplaced } from './popupSupport';

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data
  };
};

describe('pop-up support', () => {
  it('sees a window.open that a blocker replaced', () => {
    expect(windowOpenIsReplaced({ open: function newOpenWrapper() { return null; } })).toBe(true);
    expect(windowOpenIsReplaced({ open: () => null })).toBe(true);
  });
  it('accepts a native window.open', () => {
    expect(windowOpenIsReplaced({ open: Math.max })).toBe(false); // prints as [native code]
    expect(windowOpenIsReplaced({ open: new Proxy(Math.max, {}) })).toBe(false); // a transparent wrapper still prints native
  });
  it('does not throw when it cannot tell', () => {
    expect(windowOpenIsReplaced({ open: undefined })).toBe(false); // cannot tell: try the pop-up, fall back if it fails
    expect(windowOpenIsReplaced(null as never)).toBe(false);
  });
});

describe('redirect sign-in mark', () => {
  it('is taken once, shortly after being set', () => {
    const s = memory();
    markRedirectPending(s);
    expect(takeRedirectPending(s)).toBe(true);
    expect(takeRedirectPending(s)).toBe(false);
  });
  it('ignores an old mark', () => {
    const s = memory();
    s.setItem(REDIRECT_PENDING_KEY, String(Date.now() - 60 * 60 * 1000));
    expect(takeRedirectPending(s)).toBe(false);
  });
  it('never throws when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
    expect(() => markRedirectPending(blocked)).not.toThrow();
    expect(takeRedirectPending(blocked)).toBe(false);
    expect(takeRedirectPending(null)).toBe(false);
  });
});
