import type { CourseGrade } from '../types';

// Standard 4.0 GPA scale mapping
export function percentageToGpa(pct: number): number {
  if (pct >= 93) return 4.0;
  if (pct >= 90) return 3.7;
  if (pct >= 87) return 3.3;
  if (pct >= 83) return 3.0;
  if (pct >= 80) return 2.7;
  if (pct >= 77) return 2.3;
  if (pct >= 73) return 2.0;
  if (pct >= 70) return 1.7;
  if (pct >= 60) return 1.0;
  return 0.0;
}

export function percentageToLetter(pct: number): string {
  if (pct >= 93) return 'A';
  if (pct >= 90) return 'A-';
  if (pct >= 87) return 'B+';
  if (pct >= 83) return 'B';
  if (pct >= 80) return 'B-';
  if (pct >= 77) return 'C+';
  if (pct >= 73) return 'C';
  if (pct >= 70) return 'C-';
  if (pct >= 60) return 'D';
  return 'F';
}

export function letterToTargetPercentage(letter: string): number {
  switch (letter) {
    case 'A': return 93;
    case 'A-': return 90;
    case 'B+': return 87;
    case 'B': return 83;
    case 'B-': return 80;
    case 'C+': return 77;
    case 'C': return 73;
    case 'C-': return 70;
    case 'D': return 60;
    default: return 93;
  }
}

export function calculateCoursePercentage(course: CourseGrade): {
  currentPct: number;
  gradedWeight: number;
  totalWeight: number;
  earnedWeightScore: number;
} {
  let earnedWeightScore = 0;
  let gradedWeight = 0;
  let totalWeight = 0;

  course.assessments.forEach((a) => {
    totalWeight += a.weight;
    if (a.score !== undefined && a.score !== null) {
      earnedWeightScore += (a.score * a.weight) / 100;
      gradedWeight += a.weight;
    }
  });

  const currentPct = gradedWeight > 0 ? (earnedWeightScore / gradedWeight) * 100 : 100;
  return { currentPct, gradedWeight, totalWeight, earnedWeightScore };
}

export function calculateCumulativeGpa(grades: CourseGrade[]): {
  gpa: number;
  gpaString: string;
  totalCredits: number;
  totalQualityPoints: number;
} {
  let totalQualityPoints = 0;
  let totalCredits = 0;

  grades.forEach((c) => {
    if (c.credits > 0) {
      const { currentPct } = calculateCoursePercentage(c);
      const courseGpa = percentageToGpa(currentPct);
      totalQualityPoints += courseGpa * c.credits;
      totalCredits += c.credits;
    }
  });

  const gpa = totalCredits > 0 ? totalQualityPoints / totalCredits : 4.0;
  return {
    gpa: Number(gpa.toFixed(2)),
    gpaString: gpa.toFixed(2),
    totalCredits,
    totalQualityPoints: Number(totalQualityPoints.toFixed(2))
  };
}

export function getAcademicStanding(gpa: number): {
  standing: string;
  tier: string;
} {
  if (gpa >= 3.8) return { standing: "Dean's List", tier: 'Highest Honors Track' };
  if (gpa >= 3.5) return { standing: 'Honor Roll', tier: "Dean's Honors Threshold" };
  if (gpa >= 3.0) return { standing: 'Good Standing', tier: 'Satisfactory Standing' };
  return { standing: 'Academic Review', tier: 'Academic Warning' };
}

export function solveRequiredFinalScore(
  currentEarnedWeight: number,
  currentGradedWeight: number,
  upcomingWeight: number,
  targetPercentage: number
): { requiredScore: number; isAchievable: boolean; isAlreadySecured: boolean } {
  const totalWeight = currentGradedWeight + upcomingWeight;
  if (totalWeight <= 0 || upcomingWeight <= 0) {
    return { requiredScore: 0, isAchievable: true, isAlreadySecured: true };
  }

  const requiredTotalEarned = (targetPercentage * totalWeight) / 100;
  const neededFromUpcoming = requiredTotalEarned - currentEarnedWeight;
  const requiredScore = Math.ceil((neededFromUpcoming / upcomingWeight) * 100);

  const isAlreadySecured = requiredScore <= 0;
  const isAchievable = requiredScore <= 100;

  return {
    requiredScore: Math.max(0, requiredScore),
    isAchievable,
    isAlreadySecured
  };
}
