import { describe, expect, it } from 'vitest';
import type { CourseGrade } from '../types';
import { calculateCumulativeGpa } from './academicCalculations';
import { classOf, gradeLabel, isGradingScale, overallResult, targetLabel, targetOptions } from './gradingScale';

const course = (id: string, credits: number, score: number | null, over: Partial<CourseGrade> = {}): CourseGrade => ({
  id, courseCode: id.toUpperCase(), courseName: 'Course', credits, targetLetter: 'A', color: 'blue',
  assessments: [{ id: `${id}-1`, name: 'Exam', weight: 100, score }], ...over
} as CourseGrade);

describe('classes', () => {
  it('uses the UK bands: First 70, 2:1 60, 2:2 50, Third 40', () => {
    expect([100, 70, 69.9, 60, 59.9, 50, 49.9, 40, 39.9, 0].map((p) => classOf('uk', p))).toEqual([
      'First', 'First', '2:1', '2:1', '2:2', '2:2', 'Third', 'Third', 'Fail', 'Fail'
    ]);
  });
  it('uses the Kenyan bands: First Class 70+, Second Upper 60 to 69, Second Lower 50 to 59, Pass 40 to 49', () => {
    expect([85, 70, 65, 60, 55, 50, 45, 40, 39].map((p) => classOf('ke', p))).toEqual([
      'First Class Honours', 'First Class Honours', 'Second Class Honours (Upper)', 'Second Class Honours (Upper)',
      'Second Class Honours (Lower)', 'Second Class Honours (Lower)', 'Pass', 'Pass', 'Fail'
    ]);
  });
  it('classifies on the number the student sees (one decimal)', () => {
    expect(classOf('uk', 69.96)).toBe('First');
    expect(gradeLabel('uk', 69.96)).toBe('First');
  });
  it('has no classes for the US or percentage scales', () => {
    expect(classOf('us4', 90)).toBeNull();
    expect(classOf('pct', 90)).toBeNull();
  });
});

describe('gradeLabel', () => {
  it('shows a letter, a percentage or a class', () => {
    expect(gradeLabel('us4', 91)).toBe('A');
    expect(gradeLabel('us4', 64)).toBe('B');
    expect(gradeLabel('us4', 30)).toBe('E');
    expect(gradeLabel('pct', 67.46)).toBe('67%');
    expect(gradeLabel('uk', 62)).toBe('2:1');
    expect(gradeLabel('ke', 52)).toBe('Second Class Honours (Lower)');
  });
});

describe('overallResult', () => {
  const grades = [course('a', 4, 80), course('b', 2, 50), course('c', 3, null), course('s', 9, 10, { sample: true })];
  // Three graded items, so a class can be shown.
  const enough = [...grades, course('d', 1, 70, { assessments: [{ id: 'd-1', name: 'A', weight: 50, score: 70 }, { id: 'd-2', name: 'B', weight: 50, score: 70 }] })];
  it('is the GPA out of 4.0 on the default (Kenyan) bands, with a projected class once enough is graded', () => {
    const r = overallResult(enough, 'us4');
    expect(r.value).toBe(calculateCumulativeGpa(enough).gpaString);
    expect(r.unit).toBe('out of 4.00');
    expect(r.hasData).toBe(true);
    expect(r.standing).toMatch(/^Projected: (First Class|Upper Second|Lower Second|Pass|Fail)$/);
    expect(r.standingNote).toMatch(/not your official standing/);
    expect(r.totalCredits).toBe(7);
  });
  it('says there is not enough graded work when fewer than three items are graded, and still shows the figure', () => {
    const r = overallResult(grades, 'us4');
    expect(r.hasData).toBe(true);
    expect(r.value).toBe(calculateCumulativeGpa(grades).gpaString);
    expect(r.standing).toBe('Not enough graded work yet');
    expect(overallResult(grades, 'ke').standing).toBe('Not enough graded work yet');
    expect(overallResult(enough, 'ke').standing).toMatch(/^Projected: /);
  });
  it('is the credit-weighted average percentage on the other scales, ignoring ungraded and sample courses', () => {
    // (80 x 4 + 50 x 2) / 6 = 70
    const uk = overallResult(grades, 'uk');
    expect(uk.value).toBe('70.0%');
    expect(uk.unit).toBe('weighted average');
    expect(uk.totalCredits).toBe(6);
    const three = [course('a', 4, 80, { assessments: [{ id: 'a1', name: 'x', weight: 50, score: 80 }, { id: 'a2', name: 'y', weight: 50, score: 80 }] }), course('b', 2, 50)];
    expect(overallResult(three, 'uk').standing).toBe('Projected: First');
    expect(overallResult(three, 'ke').standing).toBe('Projected: First Class Honours');
    const pct = overallResult(grades, 'pct');
    expect(pct.value).toBe('70.0%');
    expect(pct.standing).toBeNull();
  });
  it('withholds the GPA figure (a dash on screen) while the standing says there is not enough graded work', () => {
    expect(overallResult(grades, 'us4').withheld).toBe(true);
    expect(overallResult(enough, 'us4').withheld).toBe(false);
    expect(overallResult(grades, 'uk').withheld).toBe(true);
    expect(overallResult(enough, 'uk').withheld).toBe(false);
    expect(overallResult(grades, 'pct').withheld).toBe(false);
    expect(overallResult([course('c', 3, null)], 'us4').withheld).toBe(false);
  });
  it('has nothing to show before anything is graded', () => {
    for (const s of ['us4', 'pct', 'uk', 'ke'] as const) {
      const r = overallResult([course('c', 3, null)], s);
      expect(r.hasData).toBe(false);
      expect(r.standing).toBeNull();
    }
  });
});

describe('targets', () => {
  it('offers letters on the US scale and class floors on the others, all at most 3 characters', () => {
    expect(targetOptions('us4').map((o) => o.label)).toEqual(['A (4.0)', 'B (3.0)', 'C (2.0)', 'D (1.0)']);
    expect(targetOptions('uk').map((o) => o.value)).toEqual(['70', '60', '50', '40']);
    expect(targetOptions('ke').map((o) => o.label)).toEqual(['First Class Honours', 'Second Class Honours (Upper)', 'Second Class Honours (Lower)', 'Pass']);
    for (const s of ['us4', 'pct', 'uk', 'ke'] as const) for (const o of targetOptions(s)) expect(o.value.length).toBeLessThanOrEqual(3);
  });
  it('reads a target made on another scale, so switching scales never breaks a course', () => {
    expect(targetLabel('us4', 'A')).toBe('A');
    expect(targetLabel('us4', '70')).toBe('A');
    expect(targetLabel('us4', 'B+')).toBe('B');
    expect(targetLabel('us4', 'A-')).toBe('A');
    expect(targetLabel('uk', '60')).toBe('2:1');
    expect(targetLabel('uk', 'A')).toBe('First');
    expect(targetLabel('ke', 'B')).toBe('Second Class Honours (Upper)');
    expect(targetLabel('pct', '60')).toBe('60%');
    expect(targetLabel('pct', 'A')).toBe('70%');
    expect(targetLabel('uk', 'junk')).toBe('First');
  });
  it('knows its scales', () => {
    expect(isGradingScale('ke')).toBe(true);
    expect(isGradingScale('gpa5')).toBe(false);
    expect(isGradingScale(undefined)).toBe(false);
  });
});
