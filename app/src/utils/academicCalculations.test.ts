import { describe, it, expect } from 'vitest';
import {
  percentageToGpa,
  percentageToLetter,
  letterToTargetPercentage,
  calculateCoursePercentage,
  calculateCumulativeGpa,
  getAcademicStanding,
  solveRequiredFinalScore
} from './academicCalculations';
import type { CourseGrade } from '../types';

describe('academicCalculations', () => {
  describe('percentageToGpa', () => {
    it('maps percentage scores to standard 4.0 scale accurately', () => {
      expect(percentageToGpa(100)).toBe(4.0);
      expect(percentageToGpa(93)).toBe(4.0);
      expect(percentageToGpa(92.99)).toBe(3.7);
      expect(percentageToGpa(90)).toBe(3.7);
      expect(percentageToGpa(87)).toBe(3.3);
      expect(percentageToGpa(83)).toBe(3.0);
      expect(percentageToGpa(80)).toBe(2.7);
      expect(percentageToGpa(77)).toBe(2.3);
      expect(percentageToGpa(73)).toBe(2.0);
      expect(percentageToGpa(70)).toBe(1.7);
      expect(percentageToGpa(60)).toBe(1.0);
      expect(percentageToGpa(59.9)).toBe(0.0);
      expect(percentageToGpa(0)).toBe(0.0);
      expect(percentageToGpa(-5)).toBe(0.0);
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
    it('converts percentages to canonical letter grades', () => {
      expect(percentageToLetter(95)).toBe('A');
      expect(percentageToLetter(91)).toBe('A-');
      expect(percentageToLetter(88)).toBe('B+');
      expect(percentageToLetter(84)).toBe('B');
      expect(percentageToLetter(81)).toBe('B-');
      expect(percentageToLetter(78)).toBe('C+');
      expect(percentageToLetter(74)).toBe('C');
      expect(percentageToLetter(71)).toBe('C-');
      expect(percentageToLetter(62)).toBe('D');
      expect(percentageToLetter(55)).toBe('F');
    });

    it('maps letter grades to valid target percentages', () => {
      expect(letterToTargetPercentage('A')).toBe(93);
      expect(letterToTargetPercentage('A-')).toBe(90);
      expect(letterToTargetPercentage('B+')).toBe(87);
      expect(letterToTargetPercentage('B')).toBe(83);
      expect(letterToTargetPercentage('B-')).toBe(80);
      expect(letterToTargetPercentage('C+')).toBe(77);
      expect(letterToTargetPercentage('C')).toBe(73);
      expect(letterToTargetPercentage('C-')).toBe(70);
      expect(letterToTargetPercentage('D')).toBe(60);
      expect(letterToTargetPercentage('UNKNOWN')).toBe(93);
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
      expect(result.currentPct).toBe(100);
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
          credits: 1, // 1 credit with 85% (3.0 GPA) -> 3 quality points
          targetLetter: 'B',
          color: '#10B981',
          assessments: [{ id: 'a-2', name: 'Essay', weight: 100, score: 85 }]
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

    it('returns default 4.00 and zero credits for empty grades array without NaN', () => {
      const result = calculateCumulativeGpa([]);
      expect(result.gpa).toBe(4.0);
      expect(result.gpaString).toBe('4.00');
      expect(result.totalCredits).toBe(0);
      expect(Number.isNaN(result.gpa)).toBe(false);
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

  describe('getAcademicStanding', () => {
    it('returns standard university honors tiers without hallucinated percentiles', () => {
      const deansList = getAcademicStanding(3.9);
      expect(deansList.standing).toBe("Dean's List");
      expect(deansList.tier).toBe('Highest Honors Track');
      expect(deansList.tier).not.toContain('Top 5%');

      const honorRoll = getAcademicStanding(3.6);
      expect(honorRoll.standing).toBe('Honor Roll');
      expect(honorRoll.tier).toBe("Dean's Honors Threshold");
      expect(honorRoll.tier).not.toContain('Top 15%');

      const goodStanding = getAcademicStanding(3.2);
      expect(goodStanding.standing).toBe('Good Standing');
      expect(goodStanding.tier).toBe('Satisfactory Standing');

      const warning = getAcademicStanding(2.4);
      expect(warning.standing).toBe('Academic Review');
      expect(warning.tier).toBe('Academic Warning');
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
