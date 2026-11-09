import React, { useEffect } from 'react';
import { Compass } from 'lucide-react';
import { useStudyFlowStore, type NavigationTab } from '../store/studyFlowStore';

const LINKS: { tab: NavigationTab; label: string }[] = [
  { tab: 'dashboard', label: 'Today' },
  { tab: 'assignments', label: 'Assignments' },
  { tab: 'calendar', label: 'Timetable' },
  { tab: 'timer', label: 'Focus timer' },
  { tab: 'courses', label: 'Courses' },
  { tab: 'notes', label: 'Notes' }
];

/** Shown for an address the app does not have (a mistyped link, an old bookmark). Nothing is lost. */
export const NotFoundPage: React.FC = () => {
  const setActiveTab = useStudyFlowStore((s) => s.setActiveTab);

  // Keep search engines from indexing wrong addresses (the host answers every address with the app).
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  return (
    <div data-testid="not-found" className="max-w-md mx-auto text-center py-12 space-y-5">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
        <Compass className="h-7 w-7" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold text-zinc-900 dark:text-zinc-50">We can’t find that page</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The address may be mistyped or out of date. Your plan is safe; nothing was changed.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setActiveTab('dashboard')}
        className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-white cursor-pointer"
      >
        Go to Today
      </button>
      <nav aria-label="Pages" className="flex flex-wrap justify-center gap-x-1 gap-y-1">
        {LINKS.filter((l) => l.tab !== 'dashboard').map((l) => (
          <button
            key={l.tab}
            type="button"
            onClick={() => setActiveTab(l.tab)}
            className="min-h-[44px] px-3 text-sm text-blue-700 dark:text-blue-300 underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-100 cursor-pointer"
          >
            {l.label}
          </button>
        ))}
      </nav>
    </div>
  );
};
