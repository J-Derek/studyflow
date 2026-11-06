import type { Assessment } from '../types';
import { clampScore } from './academicCalculations';

export const MAX_ASSESSMENTS = 20;
export const MAX_ASSESSMENT_NAME = 60;

/** Weight as a percentage between 0 and 100, to one decimal place. Not-a-number becomes 0. */
export function clampWeight(weight: number): number {
  if (!Number.isFinite(weight)) return 0;
  return Math.round(Math.min(100, Math.max(0, weight)) * 10) / 10;
}

/** Tidies what a student typed: short names, sane weights, scores kept within 0 to 100. */
export function normalizeAssessments(list: Assessment[]): Assessment[] {
  return list.slice(0, MAX_ASSESSMENTS).map((a) => {
    const name = a.name.trim().slice(0, MAX_ASSESSMENT_NAME) || 'Assessment';
    const next: Assessment = { id: a.id, name, weight: clampWeight(a.weight) };
    const score = clampScore(a.score);
    if (score !== undefined) next.score = score;
    return next;
  });
}

/** Total of all weights, to one decimal place. A full course adds up to 100. */
export function totalWeight(list: Assessment[]): number {
  return Math.round(list.reduce((sum, a) => sum + a.weight, 0) * 10) / 10;
}
