import type { Assessment, CourseGrade } from '../types';

/** A score is a percentage: not-a-number becomes empty, anything else is held between 0 and 100. */
export function clampScore(score: number | undefined): number | undefined {
  if (score === undefined || !Number.isFinite(score)) return undefined;
  return Math.min(100, Math.max(0, score));
}

/**
 * THE grade scale. Every letter, grade point, class name and cut-off in the app comes from this one table, so changing it here changes it everywhere.
 * This is the common Kenyan university scale on a 4.0 GPA. Universities differ (some use 5.0, or other cut-offs), so it is a default, not a rule.
 * Best first; `min` is the lowest percentage of the band.
 */
export interface GradeBand {
  min: number;
  letter: string;
  gpa: number;
  /** The degree class this band stands for. */
  standing: string;
}

export const GRADE_BANDS: readonly GradeBand[] = [
  { min: 70, letter: 'A', gpa: 4.0, standing: 'First Class' },
  { min: 60, letter: 'B', gpa: 3.0, standing: 'Upper Second' },
  { min: 50, letter: 'C', gpa: 2.0, standing: 'Lower Second' },
  { min: 40, letter: 'D', gpa: 1.0, standing: 'Pass' },
  { min: 0, letter: 'E', gpa: 0.0, standing: 'Fail' }
];

/** With fewer graded items than this, a class would be a guess, so the app says there is not enough yet. */
export const MIN_GRADED_ITEMS = 3;

export const NOT_ENOUGH_GRADED = 'Not enough graded work yet';

/** Bands are judged on the one-decimal figure the student sees (69.96 shows as 70.0%, so it is an A), the same rule the class scales use. */
export const roundToShown = (pct: number): number => Math.round(pct * 10) / 10;

const bandFor = (pct: number): GradeBand => {
  const shown = roundToShown(pct);
  return GRADE_BANDS.find((b) => shown >= b.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1];
};

export function percentageToGpa(pct: number): number {
  return bandFor(pct).gpa;
}

export function percentageToLetter(pct: number): string {
  return bandFor(pct).letter;
}

/**
 * The percentage a stored target stands for. Targets saved before the Kenyan scale are US letters, so those map to the nearest band
 * (A and A- to A, B+/B/B- to B, C+/C/C- to C, D to D).
 */
export function letterToTargetPercentage(letter: string): number {
  const base = letter.trim().charAt(0).toUpperCase();
  const band = GRADE_BANDS.find((b) => b.letter === base && b.letter !== 'E');
  return band ? band.min : GRADE_BANDS[0].min;
}

/** How many assessments carry a score, across the student's own courses (sample courses and ungraded ones are not counted). */
export function countGradedItems(grades: CourseGrade[]): number {
  let n = 0;
  for (const c of grades) {
    if (c.sample || !(c.credits > 0) || !Number.isFinite(c.credits)) continue;
    for (const a of c.assessments) if (clampScore(a.score ?? undefined) !== undefined) n += 1;
  }
  return n;
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
    const score = clampScore(a.score ?? undefined);
    if (score !== undefined) {
      earnedWeightScore += (score * a.weight) / 100;
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
  // A projection, not official standing. A GPA belongs to the band whose grade points it is closest to (3.5, 2.5, 1.5 and 0.5 are the halfway points).
  for (let i = 0; i < GRADE_BANDS.length - 1; i++) {
    const cut = (GRADE_BANDS[i].gpa + GRADE_BANDS[i + 1].gpa) / 2;
    if (gpa >= cut) return { standing: `Projected: ${GRADE_BANDS[i].standing}`, tier: `GPA ${cut.toFixed(1)} and above (default scale)` };
  }
  const last = GRADE_BANDS[GRADE_BANDS.length - 1];
  return { standing: `Projected: ${last.standing}`, tier: 'Check your university policy' };
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

export interface WhatIf {
  /** The next assessment without a score (the one the student is trying a score on), if there is one. */
  upcoming: Assessment | undefined;
  /** The percentage over what is graded plus the next assessment. */
  pct: number;
  /** How much of the course (in percent of the total weight) that percentage is based on. */
  basedOnWeight: number;
  /** The weight still without a score after the next assessment, which the number does not include. */
  restUngradedWeight: number;
}

/** Try `score` (0 to 100) on the next assessment that has no score yet. Everything else comes from the scores already entered. */
export function whatIfProjection(course: CourseGrade, score: number): WhatIf {
  let earned = 0;
  let gradedWeight = 0;
  let upcoming: Assessment | undefined;
  let totalWeight = 0;
  for (const a of course.assessments) {
    totalWeight += a.weight;
    const s = clampScore(a.score ?? undefined);
    if (s !== undefined) {
      earned += (s * a.weight) / 100;
      gradedWeight += a.weight;
    } else if (!upcoming) {
      upcoming = a;
    }
  }
  const upWeight = upcoming ? upcoming.weight : 0;
  const basedOnWeight = gradedWeight + upWeight;
  const pct = basedOnWeight > 0 ? ((earned + ((clampScore(score) ?? 0) * upWeight) / 100) / basedOnWeight) * 100 : 0;
  return { upcoming, pct, basedOnWeight, restUngradedWeight: Math.max(0, totalWeight - basedOnWeight) };
}
