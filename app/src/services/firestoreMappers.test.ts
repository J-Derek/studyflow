import { describe, expect, it } from 'vitest';
import { assignmentToDoc, docToAssignment, docToProfile, MAX_PHOTO_CHARS, profileToDoc, sessionToDoc, validPhoto } from './firestoreMappers';
import type { Assignment } from '../types';

const base: Assignment = {
  id: 'a1', title: 'T', course: 'C', dueDate: '2030-01-01', priority: 'low', status: 'pending', progress: 0, createdAt: 'z'
};

describe('assignmentToDoc', () => {
  it('never emits undefined (Firestore rejects it) or unknown keys', () => {
    const doc = assignmentToDoc({ ...base, dueTime: undefined, notes: undefined, completedAt: undefined });
    expect(Object.values(doc).some((v) => v === undefined)).toBe(false);
    expect(Object.keys(doc).sort()).toEqual(['course', 'createdAt', 'dueDate', 'id', 'priority', 'progress', 'status', 'title']);
  });
  it('drops an invalid dueTime and replaces NaN progress', () => {
    const doc = assignmentToDoc({ ...base, dueTime: '5pm', progress: NaN });
    expect('dueTime' in doc).toBe(false);
    expect(doc.progress).toBe(0);
  });
  it('stores subtasks as a map keyed by id and round-trips order', () => {
    const subtasks = [
      { id: 's2', title: 'second', completed: false },
      { id: 's1', title: 'first', completed: true }
    ];
    const doc = assignmentToDoc({ ...base, subtasks });
    expect(Array.isArray(doc.subtasks)).toBe(false);
    expect(Object.keys(doc.subtasks as object).sort()).toEqual(['s1', 's2']);
    expect(docToAssignment('a1', doc).subtasks).toEqual(subtasks);
  });
  it('accepts a legacy list of subtasks when reading', () => {
    const a = docToAssignment('a1', { ...assignmentToDoc(base), subtasks: [{ id: 'x', title: 't', completed: true }] });
    expect(a.subtasks).toEqual([{ id: 'x', title: 't', completed: true }]);
  });
  it('keeps the sample flag', () => {
    expect(assignmentToDoc({ ...base, sample: true }).sample).toBe(true);
    expect(docToAssignment('a1', assignmentToDoc({ ...base, sample: true })).sample).toBe(true);
  });
  it('survives hostile remote data without throwing', () => {
    const a = docToAssignment('a1', { title: 5, progress: 'x', subtasks: 'nope', priority: { __proto__: 1 } });
    expect(a.title).toBe('');
    expect(a.progress).toBe(0);
    expect(a.subtasks).toBeUndefined();
  });
});

describe('sessionToDoc', () => {
  it('omits undefined colour', () => {
    const doc = sessionToDoc({ id: 's', title: 't', course: 'c', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', type: 'lecture' });
    expect('color' in doc).toBe(false);
  });
});

import { docToGrade, gradeToDoc } from './firestoreMappers';
import type { CourseGrade } from '../types';

describe('grade mappers', () => {
  const g: CourseGrade = {
    id: 'g1', courseCode: 'CS 301', courseName: 'Algorithms', credits: 3, targetLetter: 'A', color: '#4F46E5',
    assessments: [{ id: 'a', name: 'Midterm', weight: 40, score: 82 }, { id: 'b', name: 'Final', weight: 60, score: undefined }]
  };
  it('omits undefined scores (Firestore rejects undefined) and round-trips', () => {
    const doc = gradeToDoc(g);
    expect(JSON.stringify(doc)).not.toContain('undefined');
    expect((doc.assessments as Array<Record<string, unknown>>)[1]).not.toHaveProperty('score');
    const back = docToGrade('g1', doc);
    expect(back.assessments[0].score).toBe(82);
    expect(back.assessments[1].score).toBeUndefined();
  });
  it('replaces non-finite numbers and survives hostile remote data', () => {
    expect(gradeToDoc({ ...g, credits: NaN }).credits).toBe(0);
    const hostile = docToGrade('x', { courseCode: 5, assessments: 'nope', credits: 'x' });
    expect(hostile.assessments).toEqual([]);
    expect(hostile.credits).toBe(0);
  });
  it('keeps the sample flag', () => {
    expect(gradeToDoc({ ...g, sample: true }).sample).toBe(true);
    expect(docToGrade('g1', gradeToDoc({ ...g, sample: true })).sample).toBe(true);
  });
});

describe('profile documents', () => {
  const user = { name: 'Amina Wanjiru', university: 'University of Nairobi', program: 'BSc Computer Science', semester: 'Semester 1, 2026', semesterStart: '2026-09-07', semesterEnd: '2026-12-18', timeZone: 'Africa/Nairobi' };

  it('round-trips a full profile with a picture', () => {
    const photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    const doc = profileToDoc('u1', user, photo);
    expect(doc.photo).toBe(photo);
    const back = docToProfile(doc);
    expect(back.user).toMatchObject(user);
    expect(back.photo).toBe(photo);
  });

  it('leaves out optional fields that are not set', () => {
    const doc = profileToDoc('u1', { name: 'A', university: 'U', program: 'P', semester: 'S' }, null);
    expect(Object.keys(doc).sort()).toEqual(['name', 'program', 'semester', 'uid', 'university']);
  });

  it('keeps required text within the rules limits and never empty', () => {
    const doc = profileToDoc('u1', { name: '   ', university: 'x'.repeat(500), program: '', semester: '' }, null);
    expect(doc.name).toBe('Student');
    expect((doc.university as string).length).toBe(150);
    expect(doc.program).toBe('My programme');
    expect(doc.semester).toBe('Current semester');
  });

  it('refuses anything that is not a small JPEG data URL', () => {
    expect(validPhoto('data:image/png;base64,AAAA')).toBe(false);
    expect(validPhoto('https://example.com/me.jpg')).toBe(false);
    expect(validPhoto('data:image/jpeg;base64,' + 'A'.repeat(MAX_PHOTO_CHARS))).toBe(false);
    expect(validPhoto(null)).toBe(false);
    expect(profileToDoc('u1', user, 'javascript:alert(1)').photo).toBeUndefined();
  });

  it('ignores malformed dates and unknown values coming back', () => {
    const back = docToProfile({ name: 'A', semesterStart: 'tomorrow', semesterEnd: 20261218, photo: 'nope' });
    expect(back.user.semesterStart).toBeUndefined();
    expect(back.user.semesterEnd).toBeUndefined();
    expect(back.photo).toBeNull();
  });
});
