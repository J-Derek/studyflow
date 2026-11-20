import { describe, expect, it } from 'vitest';
import { ASSIGNMENT_KINDS, CLASS_TYPE_META, CONCEPT_HUE, DONE_DOT, HUE_CLASSES, KIND_META, type Concept } from './kinds';

describe('the colour system', () => {
  const classTypes = Object.keys(CLASS_TYPE_META) as (keyof typeof CLASS_TYPE_META)[];

  it('gives every class type and every deadline kind exactly one hue', () => {
    for (const t of classTypes) expect(CONCEPT_HUE[t as Concept], `class ${t}`).toBeDefined();
    for (const k of ASSIGNMENT_KINDS) expect(CONCEPT_HUE[k as Concept], `kind ${k}`).toBeDefined();
    expect(CONCEPT_HUE.done).toBeDefined();
  });

  it('never uses one hue for two different meanings (the only shared concept is exam, a class block and a deadline alike)', () => {
    const concepts = Object.keys(CONCEPT_HUE) as Concept[];
    const hues = concepts.map((c) => CONCEPT_HUE[c]);
    expect(new Set(hues).size).toBe(concepts.length);
    // "exam" is one concept with one hue, whether it is a block or a deadline
    expect(CLASS_TYPE_META.exam.swatch).toBe(KIND_META.exam.dot);
    expect(CLASS_TYPE_META.exam.edge).toBe(HUE_CLASSES[CONCEPT_HUE.exam].edge);
  });

  it('draws every key, block and badge from the same table', () => {
    for (const t of classTypes) {
      expect(CLASS_TYPE_META[t].swatch).toBe(HUE_CLASSES[CONCEPT_HUE[t]].dot);
      expect(CLASS_TYPE_META[t].edge).toBe(HUE_CLASSES[CONCEPT_HUE[t]].edge);
    }
    for (const k of ASSIGNMENT_KINDS) {
      expect(KIND_META[k].dot).toBe(HUE_CLASSES[CONCEPT_HUE[k]].dot);
      expect(KIND_META[k].badge).toBe(HUE_CLASSES[CONCEPT_HUE[k]].badge);
    }
  });

  it('keeps a finished deadline grey, and no kind or class uses grey or green-for-done', () => {
    expect(DONE_DOT).toBe(HUE_CLASSES.zinc.dot);
    for (const k of ASSIGNMENT_KINDS) expect(KIND_META[k].dot).not.toBe(DONE_DOT);
    // green (emerald) belongs to Lab alone
    const emeraldUsers = (Object.keys(CONCEPT_HUE) as Concept[]).filter((c) => CONCEPT_HUE[c] === 'emerald');
    expect(emeraldUsers).toEqual(['lab']);
  });

  it('has distinct dot classes for every concept', () => {
    const dots = (Object.keys(CONCEPT_HUE) as Concept[]).map((c) => HUE_CLASSES[CONCEPT_HUE[c]].dot);
    expect(new Set(dots).size).toBe(dots.length);
  });
});
