import { describe, expect, it } from 'vitest';
import { getPathFromTab, getTabFromPath } from './studyFlowStore';

describe('getTabFromPath', () => {
  it('knows the six pages, with or without a trailing slash or capitals', () => {
    expect(getTabFromPath('/')).toBe('dashboard');
    expect(getTabFromPath('')).toBe('dashboard');
    expect(getTabFromPath('/assignments')).toBe('assignments');
    expect(getTabFromPath('/Calendar/')).toBe('calendar');
    expect(getTabFromPath('/timer')).toBe('timer');
    expect(getTabFromPath('/courses')).toBe('courses');
    expect(getTabFromPath('/Grades/')).toBe('courses'); // the old address still works
    expect(getTabFromPath('/notes')).toBe('notes');
  });

  it('says "notfound" for any other address instead of quietly showing Today', () => {
    expect(getTabFromPath('/nope')).toBe('notfound');
    expect(getTabFromPath('/assignments/123')).toBe('notfound');
    expect(getTabFromPath('/__/auth/handler')).toBe('notfound');
  });

  it('round-trips the six pages', () => {
    for (const tab of ['dashboard', 'assignments', 'calendar', 'timer', 'courses', 'notes'] as const) {
      expect(getTabFromPath(getPathFromTab(tab))).toBe(tab);
    }
  });
});
