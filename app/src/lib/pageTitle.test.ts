import { describe, expect, it } from 'vitest';
import { DEFAULT_TITLE, pageTitle } from './pageTitle';

describe('pageTitle', () => {
  it('gives each page its own short title', () => {
    expect(pageTitle('assignments')).toBe('Assignments · StudyFlow');
    expect(pageTitle('calendar')).toBe('Timetable · StudyFlow');
    expect(pageTitle('timer')).toBe('Focus timer · StudyFlow');
    expect(pageTitle('courses')).toBe('Courses · StudyFlow');
    expect(pageTitle('notes')).toBe('Notes · StudyFlow');
    expect(pageTitle('privacy')).toBe('Privacy · StudyFlow');
    expect(pageTitle('notfound')).toBe('Page not found · StudyFlow');
  });
  it('keeps the full title on Today', () => {
    expect(pageTitle('dashboard')).toBe(DEFAULT_TITLE);
  });
  it('uses the assignment title on an assignment page, shortened if long', () => {
    expect(pageTitle('assignments', 'Lab report')).toBe('Lab report · StudyFlow');
    expect(pageTitle('assignments', 'x'.repeat(200))).toBe(`${'x'.repeat(60)} · StudyFlow`);
  });
});
