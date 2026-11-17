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
});
