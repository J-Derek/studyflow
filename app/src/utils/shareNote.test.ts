import { describe, expect, it } from 'vitest';
import { cleanSharedText, isShareId, newShareId, shareIdFromPath, sharePath } from './shareNote';

describe('share links', () => {
  it('makes random, URL-safe ids of 24 characters that the rules accept', () => {
    const a = newShareId();
    const b = newShareId();
    expect(a).toHaveLength(24);
    expect(isShareId(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(newShareId((x) => x.fill(255))).toBe('_'.repeat(24));
  });

  it('reads the id from /s/<id> and nothing else', () => {
    const id = 'Abc123_-Abc123_-Abc123';
    expect(shareIdFromPath(sharePath(id))).toBe(id);
    expect(shareIdFromPath(`/s/${id}/`)).toBe(id);
    expect(shareIdFromPath('/s/short')).toBeNull();
    expect(shareIdFromPath('/s/has.dot.has.dot.has.dot.x')).toBeNull();
    expect(shareIdFromPath('/notes')).toBeNull();
  });

  it('cleans what goes public: plain line endings, no control or direction-override characters, capped', () => {
    expect(cleanSharedText('a\r\nb\rc\u0000d\u202Ee\tf', 100)).toBe('a\nb\ncde\tf');
    expect(cleanSharedText('x'.repeat(10), 4)).toBe('xxxx');
  });
});
