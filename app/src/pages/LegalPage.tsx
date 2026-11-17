import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { MiniMarkdown } from '../components/MiniMarkdown';
import { useStudyFlowStore, type LegalTab } from '../store/studyFlowStore';

/** Each page's text is its own small file, fetched only when that page is opened. */
const LOADERS: Record<LegalTab, () => Promise<{ default: string }>> = {
  privacy: () => import('../legal/privacy.md?raw'),
  terms: () => import('../legal/terms.md?raw'),
  children: () => import('../legal/children.md?raw'),
  storage: () => import('../legal/storage.md?raw'),
  accessibility: () => import('../legal/accessibility.md?raw')
};

/**
 * The rules pages. They carry a visible notice because they are drafts: written in plain words from the app's real behaviour, not yet
 * checked by a lawyer (see docs/COMPLIANCE.md).
 */
export const LegalPage: React.FC<{ doc: LegalTab }> = ({ doc }) => {
  const setActiveTab = useStudyFlowStore((s) => s.setActiveTab);
  const [text, setText] = useState<{ doc: LegalTab; body: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    LOADERS[doc]()
      .then((m) => alive && setText({ doc, body: m.default }))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [doc]);

  return (
    <article data-testid="legal-page" data-doc={doc} className="max-w-2xl mx-auto space-y-4 pb-10">
      <div className="pt-2 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          aria-label="Back to dashboard"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>
      {failed ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">This page could not be loaded. Check your connection and try again.</p>
      ) : text && text.doc === doc ? (
        <MiniMarkdown text={text.body} />
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
      )}
      <p data-testid="legal-draft-notice" className="border-t border-zinc-200/70 dark:border-zinc-800/70 pt-3 text-xs text-zinc-600 dark:text-zinc-400">
        Draft: written in plain words from what the app really does. It has not been checked by a lawyer yet and is not legal advice.
      </p>
    </article>
  );
};
