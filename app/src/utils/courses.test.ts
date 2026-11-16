import { describe, expect, it } from 'vitest';
import type { Assignment, CourseGrade, Note, StudySession } from '../types';
import { belongsToCourse, courseKey, courseSummary, knownCourseCodes, unlistedCourses } from './courses';

const course = (over: Partial<CourseGrade> = {}): CourseGrade => ({
  id: 'g1', courseCode: 'CS 301', courseName: 'Algorithms', credits: 3, targetLetter: 'A', color: '#4F46E5',
  assessments: [{ id: 'm', name: 'Midterm', weight: 40, score: 80 }, { id: 'f', name: 'Final', weight: 60 }], ...over
});
const asg = (over: Partial<Assignment>): Assignment => ({ id: 'a', title: 'T', course: 'CS 301', dueDate: '2026-11-20', priority: 'medium', status: 'pending', progress: 0, createdAt: 'z', ...over });
const ses = (over: Partial<StudySession>): StudySession => ({ id: 's', title: 'Class', course: 'CS 301', dayOfWeek: 1, startTime: '10:00', endTime: '11:00', type: 'lecture', ...over });
const note = (over: Partial<Note>): Note => ({ id: 'n', title: 'N', body: '', course: 'CS 301', pinned: false, createdAt: 'z', editedAt: 'z', ...over });

describe('matching an item to a course', () => {
  it('compares the code before the dash, ignoring capitals and extra spaces', () => {
    expect(courseKey('  CS   301 — Algorithms ')).toBe('cs 301');
    expect(belongsToCourse('cs 301', course())).toBe(true);
    expect(belongsToCourse('CS 301 — Algorithms', course())).toBe(true);
    expect(belongsToCourse('CS 302', course())).toBe(false);
    expect(belongsToCourse('', course())).toBe(false);
    expect(belongsToCourse('CS 301', course({ courseCode: '' }))).toBe(false);
  });
});

describe('courseSummary', () => {
  it('collects pending and done work, classes in week order, notes and the grade so far', () => {
    const s = courseSummary(course(), {
      assignments: [
        asg({ id: 'late', dueDate: '2026-12-01' }),
        asg({ id: 'soon', dueDate: '2026-11-10', kind: 'exam' }),
        asg({ id: 'done', status: 'completed', progress: 100 }),
        asg({ id: 'other', course: 'LAW 101' })
      ],
      sessions: [ses({ id: 'wed', dayOfWeek: 3 }), ses({ id: 'mon-late', dayOfWeek: 1, startTime: '14:00' }), ses({ id: 'mon-early', dayOfWeek: 1, startTime: '08:00' }), ses({ id: 'x', course: 'LAW 101' })],
      notes: [note({ id: 'n1' }), note({ id: 'n2', course: 'LAW 101' })]
    });
    expect(s.pending.map((a) => a.id)).toEqual(['soon', 'late']);
    expect(s.nextDeadline?.id).toBe('soon');
    expect(s.done.map((a) => a.id)).toEqual(['done']);
    expect(s.classes.map((c) => c.id)).toEqual(['mon-early', 'mon-late', 'wed']);
    expect(s.notes.map((n) => n.id)).toEqual(['n1']);
    expect(s.gradePct).toBe(80);
  });
  it('has no grade yet when nothing is scored, and copes with an empty course', () => {
    const s = courseSummary(course({ assessments: [{ id: 'f', name: 'Final', weight: 100 }] }), { assignments: [], sessions: [], notes: [] });
    expect(s.gradePct).toBeNull();
    expect(s.nextDeadline).toBeNull();
    expect(s.pending).toEqual([]);
  });
});

describe('knownCourseCodes', () => {
  it('lists each code once, courses first, without the long name', () => {
    expect(knownCourseCodes([course()], ['cs 301', 'LAW 101 — Contracts', 'law 101', '', 'ACS 443'])).toEqual(['CS 301', 'LAW 101', 'ACS 443']);
  });
});

describe('matching by the course name as well as the code', () => {
  it('counts work typed as "Physics" for the course PHY 101 Physics', () => {
    const c = course({ courseCode: 'PHY 101', courseName: 'Physics' });
    expect(belongsToCourse('Physics', c)).toBe(true);
    expect(belongsToCourse('physics ', c)).toBe(true);
    expect(belongsToCourse('PHY 101', c)).toBe(true);
    expect(belongsToCourse('PHY 101 — Physics', c)).toBe(true);
    expect(belongsToCourse('Chemistry', c)).toBe(false);
    expect(belongsToCourse('Physics', course({ courseCode: 'PHY 101', courseName: '' }))).toBe(false);
  });
  it('shows up in the course summary', () => {
    const c = course({ courseCode: 'PHY 101', courseName: 'Physics' });
    const s = courseSummary(c, { assignments: [asg({ course: 'Physics' })], sessions: [ses({ course: 'Physics' })], notes: [note({ course: 'physics' })] });
    expect([s.pending.length, s.classes.length, s.notes.length]).toEqual([1, 1, 1]);
  });
});

describe('unlistedCourses', () => {
  it('names the courses used on items that have no Courses entry, once each, leaving out General and blanks', () => {
    const c = course({ courseCode: 'PHY 101', courseName: 'Physics' });
    const items = ['Physics', 'Chemistry', 'chemistry', 'General', '', 'BIO 200 — Cells', 'PHY 101'];
    expect(unlistedCourses([c], items)).toEqual(['Chemistry', 'BIO 200']);
    expect(unlistedCourses([], [])).toEqual([]);
  });
});
