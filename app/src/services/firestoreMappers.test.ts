import { describe, expect, it } from 'vitest';
import { assignmentToDoc, docToAssignment, draftToDoc, docToDraft, MAX_DRAFT_BODY, docToNote, docToProfile, docToTimerPrefs, timerPrefsToDoc, MAX_NOTE_BODY, MAX_PHOTO_CHARS, noteToDoc, profileToDoc, sessionToDoc, validPhoto } from './firestoreMappers';
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
  it('stores the kind only when it is not an ordinary assignment, and reads it back', () => {
    expect('kind' in assignmentToDoc(base)).toBe(false);
    expect('kind' in assignmentToDoc({ ...base, kind: 'assignment' })).toBe(false);
    for (const kind of ['exam', 'test', 'reading', 'project'] as const) {
      const doc = assignmentToDoc({ ...base, kind });
      expect(doc.kind).toBe(kind);
      expect(docToAssignment('a1', doc).kind).toBe(kind);
    }
    expect(docToAssignment('a1', assignmentToDoc(base)).kind).toBeUndefined();
  });
  it('treats an unknown or odd kind from the cloud as no kind', () => {
    expect(docToAssignment('a1', { ...assignmentToDoc(base), kind: 'homework' }).kind).toBeUndefined();
    expect(docToAssignment('a1', { ...assignmentToDoc(base), kind: 5 }).kind).toBeUndefined();
    expect(docToAssignment('a1', { ...assignmentToDoc(base), kind: { exam: true } }).kind).toBeUndefined();
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
  it('holds scores and weights from the cloud to their limits (a record written outside the app cannot show 8837%)', () => {
    const back = docToGrade('g1', {
      assessments: [
        { id: 'a', name: 'Midterm', weight: 40, score: 8585 },
        { id: 'b', name: 'Quiz', weight: 999, score: -20 },
        { id: 'c', name: 'Final', weight: -5, score: 'high' },
        { id: 'd', name: 'Project', weight: 'x', score: Number.NaN }
      ]
    });
    expect(back.assessments.map((a) => a.score)).toEqual([100, 0, undefined, undefined]);
    expect(back.assessments.map((a) => a.weight)).toEqual([40, 100, 0, 0]);
    expect(back.assessments[2]).not.toHaveProperty('score');
  });
  it('keeps the sample flag', () => {
    expect(gradeToDoc({ ...g, sample: true }).sample).toBe(true);
    expect(docToGrade('g1', gradeToDoc({ ...g, sample: true })).sample).toBe(true);
  });
});

describe('draft documents', () => {
  it('round-trips and always stores the format', () => {
    const d = { id: 'a1', body: 'Some **text**', editedAt: '2030-01-01T00:00:00.000Z' };
    expect(draftToDoc(d)).toEqual({ id: 'a1', body: 'Some **text**', format: 'markdown', editedAt: d.editedAt });
    expect(docToDraft('a1', draftToDoc(d))).toEqual(d);
  });
  it('holds the body to the limit the rules use, and survives hostile data', () => {
    expect(draftToDoc({ id: 'a', body: 'x'.repeat(MAX_DRAFT_BODY + 50), editedAt: 'z' }).body).toHaveLength(MAX_DRAFT_BODY);
    expect(docToDraft('a', { body: 5, editedAt: {} })).toMatchObject({ id: 'a', body: '' });
  });
});

describe('timer preferences documents', () => {
  const prefs = {
    timerSettings: { focusDuration: 3000, shortBreakDuration: 600, longBreakDuration: 1200, autoStartBreaks: true, autoStartFocus: false },
    soundscape: 'rain' as const,
    breakSoundscape: 'chimes' as const,
    soundscapeVolume: 0.5
  };
  it('round-trips and always emits every key the rules require', () => {
    const doc = timerPrefsToDoc(prefs);
    expect(Object.keys(doc).sort()).toEqual(['autoStartBreaks', 'autoStartFocus', 'breakSoundscape', 'focusDuration', 'longBreakDuration', 'shortBreakDuration', 'soundscape', 'soundscapeVolume']);
    expect(docToTimerPrefs(doc)).toEqual(prefs);
  });
  it('ignores damaged stored values instead of breaking', () => {
    expect(docToTimerPrefs(undefined)).toEqual({});
    expect(docToTimerPrefs({ focusDuration: 'x', soundscape: 'thunder' })).toEqual({});
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

describe('note documents', () => {
  const note = { id: 'n1', title: 'Week 3: contracts', body: 'Offer, acceptance, consideration.', course: 'LAW 101', pinned: true, createdAt: '2026-11-01T08:00:00.000Z', editedAt: '2026-11-02T09:30:00.000Z' };

  it('round-trips a note', () => {
    expect(docToNote('n1', noteToDoc(note))).toEqual(note);
  });

  it('emits only the keys the rules allow', () => {
    expect(Object.keys(noteToDoc(note)).sort()).toEqual(['body', 'course', 'createdAt', 'editedAt', 'id', 'pinned', 'title']);
  });

  it('never stores an empty title, and stays within the rules limits', () => {
    const doc = noteToDoc({ ...note, title: '   ', body: 'x'.repeat(MAX_NOTE_BODY + 500), course: 'c'.repeat(80) });
    expect(doc.title).toBe('Untitled note');
    expect((doc.body as string).length).toBe(MAX_NOTE_BODY);
    expect((doc.course as string).length).toBe(50);
  });

  it('copes with missing or wrong-typed stored fields', () => {
    const back = docToNote('n2', { title: 5, body: null, pinned: 'yes' });
    expect(back.title).toBe('Untitled note');
    expect(back.body).toBe('');
    expect(back.pinned).toBe(false);
  });
});
