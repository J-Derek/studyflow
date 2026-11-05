import type { CourseGrade } from '../types';

// Standard 4.0 GPA scale mapping
/** A score is a percentage: not-a-number becomes empty, anything else is held between 0 and 100. */
export function clampScore(score: number | undefined): number | undefined {
  if (score === undefined || !Number.isFinite(score)) return undefined;
  return Math.min(100, Math.max(0, score));
}

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

  const currentPct = gradedWeight > 0 ? (earnedWeightScore / gradedWeight) * 100 : 0;
  return { currentPct, gradedWeight, totalWeight, earnedWeightScore };
}

/**
 * Cumulative GPA over the student's own courses. Sample courses are excluded.
 * Uses integer arithmetic: grade points are held in hundredths and quality points in
 * hundredths of a point, so 3 x 3.7 never becomes 11.100000000000001.
 */
export function calculateCumulativeGpa(grades: CourseGrade[]): {
  gpa: number;
  gpaString: string;
  totalCredits: number;
  totalQualityPoints: number;
  hasData: boolean;
} {
  let qualityHundredths = 0;
  let totalCredits = 0;
  // Credits are tracked in tenths so half-credit courses stay exact.
  let creditTenths = 0;

  grades.forEach((c) => {
    if (c.sample) return;
    if (c.credits > 0 && Number.isFinite(c.credits)) {
      const { currentPct, gradedWeight } = calculateCoursePercentage(c);
      if (gradedWeight <= 0) return; // nothing graded yet: not part of the GPA
      const gradeHundredths = Math.round(percentageToGpa(currentPct) * 100);
      const cTenths = Math.round(c.credits * 10);
      qualityHundredths += gradeHundredths * cTenths; // hundredths x tenths = thousandths of a point
      creditTenths += cTenths;
      totalCredits += c.credits;
    }
  });

  if (creditTenths === 0) {
    return { gpa: 0, gpaString: '0.00', totalCredits: 0, totalQualityPoints: 0, hasData: false };
  }
  // GPA = quality / credits, rounded half-up to 2 decimals using integers only.
  const gpaHundredths = Math.floor((qualityHundredths * 2 + creditTenths) / (creditTenths * 2));
  const gpa = gpaHundredths / 100;
  return {
    gpa,
    gpaString: gpa.toFixed(2),
    totalCredits,
    totalQualityPoints: Math.round(qualityHundredths / 10) / 100,
    hasData: true
  };
}

export function getAcademicStanding(gpa: number): {
  standing: string;
  tier: string;
} {
  // Projected, not official: these cut-offs are a common default. Universities differ.
  if (gpa >= 3.8) return { standing: 'Projected: highest honors range', tier: 'Above 3.8 (default scale)' };
  if (gpa >= 3.5) return { standing: 'Projected: honors range', tier: 'Above 3.5 (default scale)' };
  if (gpa >= 3.0) return { standing: 'Projected: good standing', tier: 'Above 3.0 (default scale)' };
  return { standing: 'Projected: below 3.0', tier: 'Check your university policy' };
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
