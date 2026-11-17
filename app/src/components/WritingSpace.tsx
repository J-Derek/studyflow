import React, { useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Assignment } from '../types';
import { useDialog } from '../lib/useDialog';
import { MAX_DRAFT_BODY } from '../services/firestoreMappers';
import { MiniMarkdown } from './MiniMarkdown';
import { FormatButtons } from './FormatToolbar';
import { useFormatting } from '../lib/useFormatting';
import { ExportButtons } from './ExportButtons';
import { useDraftText } from '../lib/useDraftText';

/**
 * The full-screen view of an assignment's notes: a plain text box with a few formatting buttons, a preview, automatic saving (one second
 * after the student stops typing, and again when they close it), and export to Word or PDF. The text is kept like a note: on this device and
 * in the account. Formatting is a small Markdown subset (see utils/miniMarkdown); nothing the student types is ever treated as HTML.
 */
export const WritingSpace: React.FC<{ assignment: Assignment; onClose: () => void }> = ({ assignment, onClose }) => {
  const { text, change, flush, status, wordCount } = useDraftText(assignment.id);
  const [mobileTab, setMobileTab] = useState<'write' | 'preview'>('write');
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  const close = () => {
    flush();
    onClose();
  };
  const dialogRef = useDialog(true, close);

  const format = useFormatting(areaRef, text, change);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-surface-light dark:bg-surface-dark flex flex-col" data-testid="writing-space-wrap">
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="writing-space" className="flex flex-col h-full min-h-0">
          <div className="flex items-center gap-2 px-3 md:px-5 py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">Writing: {assignment.title}</h2>
              <p aria-live="polite" data-testid="draft-status" className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
                {status === 'saving' ? 'Saving…' : 'Saved'} · {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close writing space"
              className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div role="toolbar" aria-label="Formatting and export" className="flex flex-wrap items-center gap-1 px-3 md:px-5 py-1.5 border-b border-zinc-200 dark:border-zinc-800">
            <FormatButtons onFormat={format} />
            <span className="flex-1" />
            <ExportButtons title={assignment.title} text={text} onBeforeExport={flush} />
          </div>

          {/* On a phone the two halves are tabs; from tablet width they sit side by side */}
          <div className="md:hidden flex gap-1 px-3 pt-2" role="group" aria-label="Show">
            {(['write', 'preview'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={mobileTab === t}
                onClick={() => setMobileTab(t)}
                className={`flex-1 min-h-[44px] rounded-md text-sm font-medium capitalize cursor-pointer ${
                  mobileTab === t ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 grid md:grid-cols-2 gap-0 md:divide-x divide-zinc-200 dark:divide-zinc-800">
            <div className={`${mobileTab === 'write' ? 'flex' : 'hidden'} md:flex flex-col min-h-0 p-3 md:p-5`}>
              <label htmlFor={`${titleId}-text`} className="sr-only">Your writing</label>
              <textarea
                id={`${titleId}-text`}
                ref={areaRef}
                value={text}
                onChange={(e) => change(e.target.value)}
                maxLength={MAX_DRAFT_BODY}
                spellCheck
                placeholder="Start writing. Use the buttons above for headings, bold, italic and lists."
                className="flex-1 min-h-[240px] w-full resize-none rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-900 p-3 text-sm leading-relaxed text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className={`${mobileTab === 'preview' ? 'block' : 'hidden'} md:block overflow-y-auto min-h-0 p-3 md:p-5`} data-testid="draft-preview">
              {text.trim() === '' ? <p className="text-sm text-zinc-600 dark:text-zinc-400">The preview shows here as you write.</p> : <MiniMarkdown text={text} />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
