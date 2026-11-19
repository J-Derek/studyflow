import { describe, it, expect } from 'vitest';
import {
  percentageToGpa,
  percentageToLetter,
  letterToTargetPercentage,
  GRADE_BANDS,
  countGradedItems,
  calculateCoursePercentage,
  calculateCumulativeGpa,
  getAcademicStanding,
  solveRequiredFinalScore,
  whatIfProjection
} from './academicCalculations';
import type { CourseGrade } from '../types';

describe('academicCalculations', () => {
  describe('percentageToGpa', () => {
    it('maps percentage scores to the Kenyan bands on a 4.0 scale', () => {
      expect(percentageToGpa(100)).toBe(4.0);
      expect(percentageToGpa(70)).toBe(4.0);
      expect(percentageToGpa(69.9)).toBe(3.0);
      expect(percentageToGpa(60)).toBe(3.0);
      expect(percentageToGpa(59.9)).toBe(2.0);
      expect(percentageToGpa(50)).toBe(2.0);
      expect(percentageToGpa(49.9)).toBe(1.0);
      expect(percentageToGpa(40)).toBe(1.0);
      expect(percentageToGpa(39.9)).toBe(0.0);
      expect(percentageToGpa(0)).toBe(0.0);
      expect(percentageToGpa(-5)).toBe(0.0);
    });

    it('is driven by the one GRADE_BANDS table, best band first', () => {
      expect(GRADE_BANDS.map((b) => b.letter)).toEqual(['A', 'B', 'C', 'D', 'E']);
      expect(GRADE_BANDS.map((b) => b.min)).toEqual([70, 60, 50, 40, 0]);
      expect(GRADE_BANDS.map((b) => b.standing)).toEqual(['First Class', 'Upper Second', 'Lower Second', 'Pass', 'Fail']);
    });

    it('preserves strict monotonicity: higher percentage never yields lower GPA', () => {
      let previousGpa = 0.0;
      for (let pct = 0; pct <= 100; pct += 0.5) {
        const gpa = percentageToGpa(pct);
        expect(gpa).toBeGreaterThanOrEqual(previousGpa);
        previousGpa = gpa;
      }
    });
  });

  describe('percentageToLetter & letterToTargetPercentage', () => {
    it('converts percentages to letters A to E', () => {
      expect(percentageToLetter(95)).toBe('A');
      expect(percentageToLetter(70)).toBe('A');
      expect(percentageToLetter(65)).toBe('B');
      expect(percentageToLetter(55)).toBe('C');
      expect(percentageToLetter(45)).toBe('D');
      expect(percentageToLetter(39)).toBe('E');
    });

    it('maps targets to the bottom of their band, and older US letters to the nearest band', () => {
      expect(letterToTargetPercentage('A')).toBe(70);
      expect(letterToTargetPercentage('B')).toBe(60);
      expect(letterToTargetPercentage('C')).toBe(50);
      expect(letterToTargetPercentage('D')).toBe(40);
      expect(letterToTargetPercentage('A-')).toBe(70);
      expect(letterToTargetPercentage('B+')).toBe(60);
      expect(letterToTargetPercentage('C-')).toBe(50);
      expect(letterToTargetPercentage('UNKNOWN')).toBe(70);
    });
  });

  describe('calculateCoursePercentage', () => {
    it('computes weighted score for fully graded course', () => {
      const course: CourseGrade = {
        id: 'c-1',
        courseCode: 'CS 101',
        courseName: 'Intro to CS',
        credits: 3,
        targetLetter: 'A',
        color: '#3B82F6',
        assessments: [
          { id: 'a-1', name: 'Homework', weight: 40, score: 90 },
          { id: 'a-2', name: 'Exam', weight: 60, score: 80 }
        ]
      };

      const result = calculateCoursePercentage(course);
      // (90 * 0.40) + (80 * 0.60) = 36 + 48 = 84
      expect(result.currentPct).toBe(84);
      expect(result.gradedWeight).toBe(100);
      expect(result.totalWeight).toBe(100);
      expect(result.earnedWeightScore).toBe(84);
    });

    it('computes percentage based only on graded assessments when upcoming exist', () => {
      const course: CourseGrade = {
        id: 'c-2',
        courseCode: 'CS 201',
        courseName: 'Data Structures',
        credits: 4,
        targetLetter: 'A',
        color: '#10B981',
        assessments: [
          { id: 'a-1', name: 'Lab 1', weight: 20, score: 95 },
          { id: 'a-2', name: 'Lab 2', weight: 30, score: 85 },
          { id: 'a-3', name: 'Final Exam', weight: 50, score: undefined }
        ]
      };

      const result = calculateCoursePercentage(course);
      // Graded weight = 50. Earned = (95 * 20)/100 + (85 * 30)/100 = 19 + 25.5 = 44.5.
      // Current Pct = (44.5 / 50) * 100 = 89%.
      expect(result.currentPct).toBe(89);
      expect(result.gradedWeight).toBe(50);
      expect(result.totalWeight).toBe(100);
      expect(result.earnedWeightScore).toBe(44.5);
    });

    it('safely handles course with zero graded assessments without NaN', () => {
      const course: CourseGrade = {
        id: 'c-3',
        courseCode: 'CS 301',
        courseName: 'Algorithms',
        credits: 3,
        targetLetter: 'A',
        color: '#8B5CF6',
        assessments: [
          { id: 'a-1', name: 'Midterm', weight: 40, score: undefined },
          { id: 'a-2', name: 'Final', weight: 60, score: undefined }
        ]
      };

      const result = calculateCoursePercentage(course);
      expect(result.currentPct).toBe(0);
      expect(result.gradedWeight).toBe(0);
      expect(result.earnedWeightScore).toBe(0);
    });
  });

  describe('calculateCumulativeGpa', () => {
    it('properly weights courses by credit hours', () => {
      const grades: CourseGrade[] = [
        {
          id: 'c-1',
          courseCode: 'CS 4400',
          courseName: 'Distributed Systems',
          credits: 4, // 4 credits with 95% (4.0 GPA) -> 16 quality points
          targetLetter: 'A',
          color: '#3B82F6',
          assessments: [{ id: 'a-1', name: 'Exam', weight: 100, score: 95 }]
        },
        {
          id: 'c-2',
          courseCode: 'HIST 101',
          courseName: 'History Seminar',
          credits: 1, // 1 credit with 65% (3.0 GPA) -> 3 quality points
          targetLetter: 'B',
          color: '#10B981',
          assessments: [{ id: 'a-2', name: 'Essay', weight: 100, score: 65 }]
        }
      ];

      const result = calculateCumulativeGpa(grades);
      // Total quality points = 16 + 3 = 19. Total credits = 5.
      // Expected GPA = 19 / 5 = 3.80.
      expect(result.totalCredits).toBe(5);
      expect(result.totalQualityPoints).toBe(19);
      expect(result.gpa).toBe(3.8);
      expect(result.gpaString).toBe('3.80');
    });

    it('reports no data (not 4.00) for an empty grades array, without NaN', () => {
      const result = calculateCumulativeGpa([]);
      expect(result.hasData).toBe(false);
      expect(result.gpa).toBe(0);
      expect(result.totalCredits).toBe(0);
      expect(Number.isNaN(result.gpa)).toBe(false);
    });

    it('excludes sample courses and courses with nothing graded', () => {
      const mk = (over: Partial<CourseGrade>): CourseGrade => ({
        id: 'x', courseCode: 'X', courseName: 'X', credits: 3, targetLetter: 'A', color: '#000',
        assessments: [{ id: 'a', name: 'T', weight: 100, score: 95 }], ...over
      });
      expect(calculateCumulativeGpa([mk({ sample: true })]).hasData).toBe(false);
      expect(calculateCumulativeGpa([mk({ assessments: [{ id: 'a', name: 'T', weight: 100 }] })]).hasData).toBe(false);
      expect(calculateCumulativeGpa([mk({}), mk({ id: 'y', sample: true, assessments: [{ id: 'a', name: 'T', weight: 100, score: 10 }] })]).gpa).toBe(4);
    });

    it('is exact with integer arithmetic (no float drift)', () => {
      const mk = (id: string, credits: number, score: number): CourseGrade => ({
        id, courseCode: id, courseName: id, credits, targetLetter: 'A', color: '#000',
        assessments: [{ id: 'a', name: 'T', weight: 100, score }]
      });
      // 4.0x3 + 3.0x4 + 1.0x2 = 26 quality points / 9 credits = 2.8888, rounds to 2.89
      const r = calculateCumulativeGpa([mk('a', 3, 75), mk('b', 4, 65), mk('c', 2, 45)]);
      expect(r.gpa).toBe(2.89);
      expect(r.totalQualityPoints).toBe(26);
      // half credits stay exact: 4.0 x 1.5 + 3.0 x 1.5 = 10.5 / 3 = 3.5
      expect(calculateCumulativeGpa([mk('a', 1.5, 95), mk('b', 1.5, 65)]).gpa).toBe(3.5);
    });

    it('property: GPA stays within 0..4 and is stable under course order', () => {
      let seed = 42;
      const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      for (let i = 0; i < 200; i++) {
        const n = 1 + Math.floor(rnd() * 6);
        const courses: CourseGrade[] = Array.from({ length: n }, (_, k) => ({
          id: `c${k}`, courseCode: `c${k}`, courseName: 'c', credits: 1 + Math.floor(rnd() * 5), targetLetter: 'A', color: '#000',
          assessments: [{ id: 'a', name: 'T', weight: 100, score: Math.floor(rnd() * 101) }]
        }));
        const g = calculateCumulativeGpa(courses).gpa;
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(4);
        expect(calculateCumulativeGpa([...courses].reverse()).gpa).toBe(g);
      }
    });

    it('ignores 0-credit courses in GPA weighting', () => {
      const grades: CourseGrade[] = [
        {
          id: 'c-1',
          courseCode: 'MATH 310',
          courseName: 'Linear Algebra',
          credits: 3,
          targetLetter: 'A',
          color: '#3B82F6',
          assessments: [{ id: 'a-1', name: 'Exam', weight: 100, score: 95 }]
        },
        {
          id: 'c-2',
          courseCode: 'PE 101',
          courseName: 'Physical Education',
          credits: 0,
          targetLetter: 'A',
          color: '#10B981',
          assessments: [{ id: 'a-2', name: 'Fitness', weight: 100, score: 70 }]
        }
      ];

      const result = calculateCumulativeGpa(grades);
      expect(result.totalCredits).toBe(3);
      expect(result.gpa).toBe(4.0);
    });
  });

  describe('countGradedItems', () => {
    it('counts scored assessments in real courses only', () => {
      const mk = (over: Partial<CourseGrade>): CourseGrade => ({
        id: 'x', courseCode: 'X', courseName: 'X', credits: 3, targetLetter: 'A', color: '#000',
        assessments: [{ id: 'a', name: 'T', weight: 50, score: 70 }, { id: 'b', name: 'U', weight: 50 }], ...over
      });
      expect(countGradedItems([mk({}), mk({ id: 'y' })])).toBe(2);
      expect(countGradedItems([mk({ sample: true }), mk({ credits: 0 })])).toBe(0);
    });
  });

  describe('getAcademicStanding', () => {
    it('labels standings as projected and never renders rank or percentile text', () => {
      for (const gpa of [3.9, 3.6, 2.6, 1.6, 0.6, 0.2]) {
        const r = getAcademicStanding(gpa);
        expect(r.standing.startsWith('Projected: ')).toBe(true);
        expect(`${r.standing} ${r.tier}`).not.toMatch(/top\s*\d|percentile|rank|honou?rs/i);
      }
      expect(getAcademicStanding(4).standing).toBe('Projected: First Class');
      expect(getAcademicStanding(3.5).standing).toBe('Projected: First Class');
      expect(getAcademicStanding(3.0).standing).toBe('Projected: Upper Second');
      expect(getAcademicStanding(2.0).standing).toBe('Projected: Lower Second');
      expect(getAcademicStanding(1.0).standing).toBe('Projected: Pass');
      expect(getAcademicStanding(0.4).standing).toBe('Projected: Fail');
    });
  });

  describe('solveRequiredFinalScore', () => {
    it('identifies target as already secured when earned points meet total requirement', () => {
      // Current earned = 85 points out of 100. Target = 80%. Upcoming = 20%.
      // Required = (80 * 100) / 100 = 80 points needed total. 85 >= 80.
      const result = solveRequiredFinalScore(85, 80, 20, 80);
      expect(result.isAlreadySecured).toBe(true);
      expect(result.isAchievable).toBe(true);
      expect(result.requiredScore).toBe(0);
    });

    it('calculates achievable target score on upcoming assessment', () => {
      // Graded = 60%, earned = 50 points. Upcoming = 40%. Target = 85%.
      // Total required = (85 * 100) / 100 = 85 points.
      // Needed from upcoming = 85 - 50 = 35 points out of 40% weight.
      // (35 / 40) * 100 = 87.5% -> ceil = 88%.
      const result = solveRequiredFinalScore(50, 60, 40, 85);
      expect(result.isAlreadySecured).toBe(false);
      expect(result.isAchievable).toBe(true);
      expect(result.requiredScore).toBe(88);
    });

    it('identifies mathematically unreachable targets', () => {
      // Graded = 60%, earned = 30 points. Upcoming = 40%. Target = 95%.
      // Total required = 95 points.
      // Needed from upcoming = 95 - 30 = 65 points out of 40% weight.
      // (65 / 40) * 100 = 162.5% -> unreachable.
      const result = solveRequiredFinalScore(30, 60, 40, 95);
      expect(result.isAlreadySecured).toBe(false);
      expect(result.isAchievable).toBe(false);
      expect(result.requiredScore).toBe(163);
    });

    it('handles zero upcoming weight gracefully without division by zero', () => {
      const result = solveRequiredFinalScore(85, 100, 0, 90);
      expect(result.isAchievable).toBe(true);
      expect(result.isAlreadySecured).toBe(true);
      expect(result.requiredScore).toBe(0);
    });
  });
});

describe('whatIfProjection', () => {
  const course = (assessments: { id: string; name: string; weight: number; score?: number }[]): CourseGrade => ({
    id: 'c', courseCode: 'X 1', courseName: 'X', credits: 3, targetLetter: 'A', color: '#000', assessments
  });

  it('says how much of the course the number is based on, not just the number', () => {
    const p = whatIfProjection(course([{ id: 'a', name: 'Midterm', weight: 30, score: 100 }, { id: 'b', name: 'Coursework', weight: 30, score: 60 }, { id: 'c', name: 'Final', weight: 40 }]), 85);
    expect(p.upcoming?.name).toBe('Final');
    expect(p.basedOnWeight).toBe(100);
    expect(p.pct).toBeCloseTo(0.3 * 100 + 0.3 * 60 + 0.4 * 85, 5);
  });

  it('with only one score entered, the result covers just the graded part plus the next assessment', () => {
    const p = whatIfProjection(course([{ id: 'a', name: 'Midterm', weight: 30 }, { id: 'b', name: 'Coursework', weight: 30 }, { id: 'c', name: 'Final', weight: 40 }]), 85);
    expect(p.upcoming?.name).toBe('Midterm');
    expect(p.basedOnWeight).toBe(30);
    expect(p.pct).toBe(85);
    expect(p.restUngradedWeight).toBe(70);
  });

  it('allows a failing score and a course with nothing left to grade', () => {
    expect(whatIfProjection(course([{ id: 'a', name: 'Exam', weight: 100 }]), 0).pct).toBe(0);
    const done = whatIfProjection(course([{ id: 'a', name: 'Exam', weight: 100, score: 70 }]), 85);
    expect(done.upcoming).toBeUndefined();
    expect(done.pct).toBe(70);
    expect(done.restUngradedWeight).toBe(0);
  });
});
