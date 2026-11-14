import type { CourseGrade, GradingScale } from '../types';
import { calculateCoursePercentage, calculateCumulativeGpa, getAcademicStanding, letterToTargetPercentage, percentageToLetter } from './academicCalculations';

/**
 * The grading scale a student's university uses. It decides how a course percentage is shown (letter, percentage or class) and what the
 * overall figure is (GPA out of 4, or the credit-weighted average). The stored scores are always percentages; only the wording changes.
 *
 *  us4: letters and a GPA out of 4.0 (the default, and what the app always did)
 *  pct: percentages only, with the weighted average
 *  uk:  First 70+, 2:1 60 to 69, 2:2 50 to 59, Third 40 to 49
 *  ke:  Kenyan degree classes: First Class Honours 70+, Second Upper 60 to 69, Second Lower 50 to 59, Pass 40 to 49
 */
export type { GradingScale };

export const GRADING_SCALES: GradingScale[] = ['us4', 'pct', 'uk', 'ke'];

export function isGradingScale(value: unknown): value is GradingScale {
  return typeof value === 'string' && (GRADING_SCALES as string[]).includes(value);
}

export const SCALE_LABEL: Record<GradingScale, string> = {
  us4: 'Letters and GPA out of 4.0',
  pct: 'Percentages only',
  uk: 'UK degree classes (First, 2:1, 2:2, Third)',
  ke: 'Kenyan degree classes (First Class, Second Upper, Second Lower, Pass)'
};

/** Lowest percentage of each class, best first. Below the last one is a fail. */
const BANDS: Record<'uk' | 'ke', { min: number; label: string }[]> = {
  uk: [{ min: 70, label: 'First' }, { min: 60, label: '2:1' }, { min: 50, label: '2:2' }, { min: 40, label: 'Third' }],
  ke: [
    { min: 70, label: 'First Class Honours' },
    { min: 60, label: 'Second Class Honours (Upper)' },
    { min: 50, label: 'Second Class Honours (Lower)' },
    { min: 40, label: 'Pass' }
  ]
};

const oneDecimal = (n: number) => Math.round(n * 10) / 10;

/** The degree class for a percentage, or null on the scales that have none. Judged on the one-decimal figure the student sees. */
export function classOf(scale: GradingScale, pct: number): string | null {
  if (scale !== 'uk' && scale !== 'ke') return null;
  const shown = oneDecimal(pct);
  return BANDS[scale].find((b) => shown >= b.min)?.label ?? 'Fail';
}

/** How a course percentage is written on this scale. */
export function gradeLabel(scale: GradingScale, pct: number): string {
  if (scale === 'us4') return percentageToLetter(pct);
  if (scale === 'pct') return `${Math.round(pct)}%`;
  return classOf(scale, pct) ?? '';
}

/** What a student can aim for when adding a course. The value is at most 3 characters (the cloud's limit for `targetLetter`). */
export function targetOptions(scale: GradingScale): { value: string; label: string }[] {
  if (scale === 'us4') return [{ value: 'A', label: 'A (4.0)' }, { value: 'A-', label: 'A- (3.7)' }, { value: 'B+', label: 'B+ (3.3)' }, { value: 'B', label: 'B (3.0)' }];
  if (scale === 'pct') return [{ value: '70', label: '70%' }, { value: '60', label: '60%' }, { value: '50', label: '50%' }, { value: '40', label: '40%' }];
  return BANDS[scale].map((b) => ({ value: String(b.min), label: b.label }));
}

/** The percentage a stored target stands for. A target is a US letter (older courses, the US scale) or a whole percentage ("70"). */
function targetPercentage(target: string): number {
  return /^\d{1,3}$/.test(target) ? Number(target) : letterToTargetPercentage(target);
}

/** A course's target in the words of the chosen scale, whichever scale it was set on. */
export function targetLabel(scale: GradingScale, target: string): string {
  if (scale === 'us4' && !/^\d{1,3}$/.test(target)) return target;
  return gradeLabel(scale, targetPercentage(target));
}

export interface OverallResult {
  hasData: boolean;
  /** "3.45" or "68.4%". */
  value: string;
  /** What the value is: "out of 4.00" or "weighted average". */
  unit: string;
  /** "Projected: First Class Honours", or null when there is nothing to say. */
  standing: string | null;
  /** A line under the standing. */
  standingNote: string;
  totalCredits: number;
}

/** The figure for the whole record: GPA on the US scale, the credit-weighted average percentage on the others. Sample courses and ungraded ones are left out. */
export function overallResult(grades: CourseGrade[], scale: GradingScale): OverallResult {
  if (scale === 'us4') {
    const g = calculateCumulativeGpa(grades);
    return {
      hasData: g.hasData,
      value: g.gpaString,
      unit: 'out of 4.00',
      standing: g.hasData ? getAcademicStanding(g.gpa).standing : null,
      standingNote: 'Cut-offs are a common default (3.8, 3.5, 3.0). Your university may differ.',
      totalCredits: g.totalCredits
    };
  }
  let weighted = 0;
  let creditTenths = 0;
  let totalCredits = 0;
  for (const c of grades) {
    if (c.sample || !(c.credits > 0) || !Number.isFinite(c.credits)) continue;
    const { currentPct, gradedWeight } = calculateCoursePercentage(c);
    if (gradedWeight <= 0) continue;
    const tenths = Math.round(c.credits * 10);
    weighted += currentPct * tenths;
    creditTenths += tenths;
    totalCredits += c.credits;
  }
  if (creditTenths === 0) {
    return { hasData: false, value: '', unit: 'weighted average', standing: null, standingNote: '', totalCredits: 0 };
  }
  const avg = oneDecimal(weighted / creditTenths);
  const cls = classOf(scale, avg);
  return {
    hasData: true,
    value: `${avg.toFixed(1)}%`,
    unit: 'weighted average',
    standing: cls ? `Projected: ${cls}` : null,
    standingNote: cls ? 'Class boundaries are 70, 60, 50 and 40 percent. Your university may differ.' : 'Percentages only: no grade classes are shown.',
    totalCredits
  };
}
