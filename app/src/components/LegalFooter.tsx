import React from 'react';
import { getPathFromTab, useStudyFlowStore, type LegalTab } from '../store/studyFlowStore';

export const LEGAL_LINKS: { tab: LegalTab; label: string }[] = [
  { tab: 'privacy', label: 'Privacy' },
  { tab: 'terms', label: 'Terms' },
  { tab: 'children', label: 'Children and parents' },
  { tab: 'storage', label: 'Storage on your device' },
  { tab: 'accessibility', label: 'Accessibility' }
];

/** Small links to the rules pages, at the bottom of every screen. Sits above the phone's bottom bar. */
export const LegalFooter: React.FC = () => {
  const setActiveTab = useStudyFlowStore((s) => s.setActiveTab);
  return (
    <footer className="max-w-7xl w-full mx-auto px-4 md:px-8 pb-24 md:pb-8 pt-2">
      <nav aria-label="About StudyFlow" className="flex flex-wrap justify-center gap-x-1 gap-y-0 border-t border-zinc-200/70 dark:border-zinc-800/70 pt-2">
        {LEGAL_LINKS.map((l) => (
          <a
            key={l.tab}
            href={getPathFromTab(l.tab)}
            onClick={(e) => {
              e.preventDefault();
              setActiveTab(l.tab);
              window.scrollTo({ top: 0 });
            }}
            className="inline-flex items-center min-h-[44px] px-2 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-2"
          >
            {l.label}
          </a>
        ))}
      </nav>
    </footer>
  );
};
