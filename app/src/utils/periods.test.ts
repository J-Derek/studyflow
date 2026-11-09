import { describe, expect, it } from 'vitest';
import type { Assignment, CourseGrade, Note, StudySession } from '../types';
import { isPeriodLabel, newPeriodId, periodWord, periodWordCapital, planArchive, type CarryChoice, type Current } from './periods';

const asg = (id: string, status: Assignment['status'] = 'pending'): Assignment => ({ id, title: id, course: 'C', dueDate: '2030-01-01', priority: 'low', status, progress: status === 'completed' ? 100 : 0, createdAt: 'z' });
const note = (id: string): Note => ({ id, title: id, body: '', course: '', pinned: false, createdAt: 'z', editedAt: 'z' });
const ses = (id: string): StudySession => ({ id, title: id, course: 'C', dayOfWeek: 1, startTime: '10:00', endTime: '11:00', type: 'lecture' });
const grade = (id: string): CourseGrade => ({ id, courseCode: 'C', courseName: 'N', credits: 3, targetLetter: 'A', color: '#000', assessments: [{ id: 'm', name: 'Mid', weight: 50, score: 70 }, { id: 'f', name: 'Final', weight: 50 }] });

const current: Current = { assignments: [asg('open1'), asg('open2'), asg('done', 'completed')], sessions: [ses('s1')], grades: [grade('g1')], notes: [note('n1'), note('n2')] };
const choice = (over: Partial<CarryChoice> = {}): CarryChoice => ({ assignmentIds: new Set(), noteIds: new Set(), keepTimetable: false, keepCourses: false, ...over });

describe('labels', () => {
  it('reads semester, term or trimester, and falls back to semester', () => {
    expect(periodWord('term')).toBe('term');
    expect(periodWordCapital('trimester')).toBe('Trimester');
    expect(periodWord(undefined)).toBe('semester');
    expect(periodWord('year' as never)).toBe('semester');
    expect(isPeriodLabel('term')).toBe(true);
    expect(isPeriodLabel('x')).toBe(false);
  });
});

describe('planArchive', () => {
  it('archives everything when nothing is carried, and loses nothing', () => {
    const p = planArchive(current, choice(), 'p1');
    expect(p.keep).toEqual({ assignments: [], sessions: [], grades: [], notes: [] });
    expect(p.archive.assignments.map((a) => a.id).sort()).toEqual(['done', 'open1', 'open2']);
    expect(p.archive.notes).toHaveLength(2);
    expect(p.archive.sessions).toHaveLength(1);
    expect(p.counts).toEqual({ archived: 7, kept: 0 });
  });
  it('keeps only ticked unfinished work and ticked notes; finished work is always archived', () => {
    const p = planArchive(current, choice({ assignmentIds: new Set(['open1', 'done']), noteIds: new Set(['n2']) }), 'p1');
    expect(p.keep.assignments.map((a) => a.id)).toEqual(['open1']);
    expect(p.archive.assignments.map((a) => a.id).sort()).toEqual(['done', 'open2']);
    expect(p.keep.notes.map((n) => n.id)).toEqual(['n2']);
    expect(p.archive.notes.map((n) => n.id)).toEqual(['n1']);
  });
  it('keeps the timetable when asked, in place of archiving it', () => {
    const p = planArchive(current, choice({ keepTimetable: true }), 'p1');
    expect(p.keep.sessions).toHaveLength(1);
    expect(p.archive.sessions).toEqual([]);
  });
  it('keeps courses without their scores, and archives the old scores under a new id', () => {
    const p = planArchive(current, choice({ keepCourses: true }), 'p-2030');
    expect(p.keep.grades[0]!.id).toBe('g1');
    expect(p.keep.grades[0]!.assessments.every((a) => a.score === undefined)).toBe(true);
    expect(p.keep.grades[0]!.assessments.map((a) => a.name)).toEqual(['Mid', 'Final']);
    expect(p.archive.grades[0]!.id).toBe('g1~p-2030');
    expect(p.archive.grades[0]!.assessments[0]!.score).toBe(70);
  });
  it('every item ends up in exactly one place', () => {
    const p = planArchive(current, choice({ assignmentIds: new Set(['open2']), keepTimetable: true, keepCourses: false }), 'p1');
    const ids = (c: Current) => [...c.assignments, ...c.sessions, ...c.grades, ...c.notes].map((x) => x.id);
    const all = [...ids(p.keep), ...ids(p.archive)];
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual([...ids(current)].sort());
  });
});

describe('newPeriodId', () => {
  it('is readable and starts with the date', () => {
    expect(newPeriodId(new Date('2026-11-09T10:00:00Z'), () => 'ab3x')).toBe('p-2026-11-09-ab3x');
  });
});
