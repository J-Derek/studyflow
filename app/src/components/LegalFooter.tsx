import React from 'react';
import { getPathFromTab, useStudyFlowStore, type LegalTab } from '../store/studyFlowStore';

export const LEGAL_LINKS: { tab: LegalTab; label: string }[] = [
  { tab: 'privacy', label: 'Privacy' },
  { tab: 'terms', label: 'Terms' },
  { tab: 'children', label: 'Children and parents' },
  { tab: 'storage', label: 'Storage on your device' },
  { tab: 'accessibility', label: 'Accessibility' }
];

/**
 * The links to the rules pages. They live in Help, the account menu and Your account (not at the bottom of every screen, which
 * Derek found distracting). `onNavigate` closes whatever menu or dialog they sit in.
 */
export const LegalLinks: React.FC<{ onNavigate?: () => void; className?: string }> = ({ onNavigate, className = '' }) => {
  const setActiveTab = useStudyFlowStore((s) => s.setActiveTab);
  return (
    <nav aria-label="About StudyFlow" className={`flex flex-wrap gap-x-1 gap-y-0 ${className}`}>
      {LEGAL_LINKS.map((l) => (
        <a
          key={l.tab}
          href={getPathFromTab(l.tab)}
          onClick={(e) => {
            e.preventDefault();
            onNavigate?.();
            setActiveTab(l.tab);
            window.scrollTo({ top: 0 });
          }}
          className="inline-flex items-center min-h-[44px] px-2 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-2"
        >
          {l.label}
        </a>
      ))}
    </nav>
  );
};
