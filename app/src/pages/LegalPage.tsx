import React, { useEffect, useState } from 'react';
import { MiniMarkdown } from '../components/MiniMarkdown';
import type { LegalTab } from '../store/studyFlowStore';

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
      <p
        data-testid="legal-draft-notice"
        className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
      >
        <strong>Draft.</strong> This page was written in plain words from what the app really does. It has not been checked by a lawyer yet and is not legal advice.
      </p>
      {failed ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">This page could not be loaded. Check your connection and try again.</p>
      ) : text && text.doc === doc ? (
        <MiniMarkdown text={text.body} />
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
      )}
    </article>
  );
};
