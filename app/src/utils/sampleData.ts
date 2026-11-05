import type { Assignment, CourseGrade, StudySession } from '../types';

/**
 * Opt-in demo content. Every record carries `sample: true` so it can be labelled in the UI and
 * excluded from GPA, backups, .ics export and the getting-started checklist.
 * Due dates are relative to `now` so the demo never shows stale dates.
 */
function isoDate(now: Date, offsetDays: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function buildSampleData(now: Date = new Date()): {
  assignments: Assignment[];
  sessions: StudySession[];
  grades: CourseGrade[];
} {
  const created = now.toISOString();
  const st = (id: string, title: string, completed: boolean) => ({ id, title, completed });

  const assignments: Assignment[] = [
    {
      id: 'sample-asg-1',
      title: 'Sample: Algorithms problem set',
      course: 'CS 301',
      dueDate: isoDate(now, 2),
      dueTime: '23:59',
      priority: 'high',
      status: 'in_progress',
      progress: 66,
      notes: 'Example assignment. Delete it or clear all sample data from the Help menu.',
      subtasks: [
        st('sample-st-1', 'Read chapter 6', true),
        st('sample-st-2', 'Solve questions 1 to 4', true),
        st('sample-st-3', 'Write up and submit', false)
      ],
      createdAt: created,
      sample: true
    },
    {
      id: 'sample-asg-2',
      title: 'Sample: Lab report',
      course: 'PHY 210',
      dueDate: isoDate(now, 5),
      dueTime: '17:00',
      priority: 'medium',
      status: 'pending',
      progress: 0,
      createdAt: created,
      sample: true
    },
    {
      id: 'sample-asg-3',
      title: 'Sample: Reading response',
      course: 'ENG 105',
      dueDate: isoDate(now, 9),
      priority: 'low',
      status: 'pending',
      progress: 0,
      createdAt: created,
      sample: true
    }
  ];

  const sessions: StudySession[] = [
    { id: 'sample-s-1', title: 'Sample: Algorithms lecture', course: 'CS 301', dayOfWeek: 1, startTime: '09:00', endTime: '10:30', type: 'lecture', sample: true },
    { id: 'sample-s-2', title: 'Sample: Physics lab', course: 'PHY 210', dayOfWeek: 3, startTime: '14:00', endTime: '16:00', type: 'lab', sample: true },
    { id: 'sample-s-3', title: 'Sample: Study block', course: 'CS 301', dayOfWeek: 4, startTime: '16:00', endTime: '17:30', type: 'study', sample: true }
  ];

  const grades: CourseGrade[] = [
    {
      id: 'sample-cg-1',
      courseCode: 'CS 301',
      courseName: 'Algorithms (sample)',
      credits: 3,
      targetLetter: 'A',
      color: '#4F46E5',
      sample: true,
      assessments: [
        { id: 'sample-a-1', name: 'Midterm', weight: 40, score: 82 },
        { id: 'sample-a-2', name: 'Final exam', weight: 60, score: undefined }
      ]
    }
  ];

  return { assignments, sessions, grades };
}

/** Records that belong to the student, never demo content. */
export function withoutSample<T extends { sample?: boolean }>(items: T[]): T[] {
  return items.filter((i) => !i.sample);
}

/** Ids used by the old always-on demo seed (asg-1..5, s-1..8, cg-1..4). */
export function isLegacySeedId(kind: 'assignment' | 'session' | 'grade', id: string): boolean {
  if (kind === 'assignment') return /^asg-[1-5]$/.test(id);
  if (kind === 'session') return /^s-[1-8]$/.test(id);
  return /^cg-[1-4]$/.test(id);
}
