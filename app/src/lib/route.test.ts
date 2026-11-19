import { describe, expect, it } from 'vitest';
import { assignmentIdFromPath, assignmentPath } from './route';

describe('assignmentIdFromPath', () => {
  it('reads the id from an assignment page address', () => {
    expect(assignmentIdFromPath('/assignments/abc123')).toBe('abc123');
    expect(assignmentIdFromPath('/assignments/abc123/')).toBe('abc123');
    expect(assignmentIdFromPath(assignmentPath('a b'))).toBe('a b');
  });
  it('is null for the list and other pages', () => {
    expect(assignmentIdFromPath('/assignments')).toBeNull();
    expect(assignmentIdFromPath('/assignments/')).toBeNull();
    expect(assignmentIdFromPath('/notes/abc')).toBeNull();
    expect(assignmentIdFromPath('/assignments/a/b')).toBeNull();
  });
  it('does not throw on a broken % escape: the id matches nothing, so the page says the assignment is not there', () => {
    expect(() => assignmentIdFromPath('/assignments/%E0%A4%A')).not.toThrow();
    expect(assignmentIdFromPath('/assignments/%E0%A4%A')).toBe('%E0%A4%A');
    expect(assignmentIdFromPath('/assignments/100%')).toBe('100%');
  });
});
