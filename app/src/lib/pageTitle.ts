import type { AppTab } from '../store/studyFlowStore';

/** The title the page ships with (index.html); Today keeps it. */
export const DEFAULT_TITLE = 'StudyFlow — Today, Timetable & GPA Simulator';

const NAMES: Record<string, string> = {
  assignments: 'Assignments',
  calendar: 'Timetable',
  timer: 'Focus timer',
  courses: 'Courses',
  notes: 'Notes',
  privacy: 'Privacy',
  terms: 'Terms',
  children: 'Children and privacy',
  storage: 'Data and storage',
  accessibility: 'Accessibility',
  notfound: 'Page not found'
};

/** The browser tab / history title for a page: "Assignments · StudyFlow". An assignment's own page uses its title. */
export function pageTitle(tab: AppTab, assignmentTitle?: string | null): string {
  if (tab === 'dashboard') return DEFAULT_TITLE;
  if (tab === 'assignments' && assignmentTitle) return `${assignmentTitle.trim().slice(0, 60)} · StudyFlow`;
  const name = NAMES[tab];
  return name ? `${name} · StudyFlow` : DEFAULT_TITLE;
}
