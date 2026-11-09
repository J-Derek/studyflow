import React, { useMemo } from 'react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { knownCourseCodes } from '../utils/courses';

/** The id the course fields point at with `list=`. One list for the whole app: the courses and every course code already used. */
export const COURSE_SUGGESTIONS_ID = 'course-suggestions';

export const CourseSuggestions: React.FC = () => {
  const { grades, assignments, sessions, notes } = useStudyFlowStore();
  const codes = useMemo(() => {
    // This sits outside the page area's safety net, so bad data must never throw here (a broken page shows its own error screen instead).
    try {
      return knownCourseCodes(grades, [...assignments.map((a) => a.course), ...sessions.map((s) => s.course), ...notes.map((n) => n.course)]);
    } catch {
      return [];
    }
  }, [grades, assignments, sessions, notes]);
  return (
    <datalist id={COURSE_SUGGESTIONS_ID}>
      {codes.map((c) => (
        <option key={c} value={c} />
      ))}
    </datalist>
  );
};
