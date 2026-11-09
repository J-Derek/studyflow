import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bold, FileDown, Heading2, Italic, List, ListOrdered, Loader2, Printer, X } from 'lucide-react';
import type { Assignment } from '../types';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { useDialog } from '../lib/useDialog';
import { applyFormat, type FormatKind } from '../utils/markdownEdit';
import { MAX_DRAFT_BODY } from '../services/firestoreMappers';
import { MiniMarkdown } from './MiniMarkdown';

const AUTOSAVE_MS = 1000;

const TOOLS: { kind: FormatKind; label: string; Icon: typeof Bold }[] = [
  { kind: 'heading', label: 'Heading', Icon: Heading2 },
  { kind: 'bold', label: 'Bold', Icon: Bold },
  { kind: 'italic', label: 'Italic', Icon: Italic },
  { kind: 'bullet', label: 'Bulleted list', Icon: List },
  { kind: 'numbered', label: 'Numbered list', Icon: ListOrdered }
];

/**
 * The writing space for one assignment: a plain text box with a few formatting buttons, a preview, automatic saving (one second after the
 * student stops typing, and again when they close it), and export to Word or PDF. The text is kept like a note: on this device and in the
 * account. Formatting is a small Markdown subset (see utils/miniMarkdown); nothing the student types is ever treated as HTML.
 */
export const WritingSpace: React.FC<{ assignment: Assignment; onClose: () => void }> = ({ assignment, onClose }) => {
  const { drafts, saveDraft } = useStudyFlowStore();
  const stored = drafts.find((d) => d.id === assignment.id)?.body ?? '';
  const [text, setText] = useState(stored);
  const [status, setStatus] = useState<'saved' | 'saving'>('saved');
  const [mobileTab, setMobileTab] = useState<'write' | 'preview'>('write');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef(text);
  const savedRef = useRef(stored);
  const timer = useRef<number | undefined>(undefined);
  const titleId = useId();

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    if (textRef.current !== savedRef.current) {
      savedRef.current = textRef.current;
      saveDraft(assignment.id, textRef.current);
    }
    setStatus('saved');
  }, [assignment.id, saveDraft]);

  const change = (next: string) => {
    const clipped = next.slice(0, MAX_DRAFT_BODY);
    setText(clipped);
    textRef.current = clipped;
    setStatus('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, AUTOSAVE_MS);
  };

  // Closing (or the page leaving) saves what is typed so far.
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      flush();
    };
  }, [flush]);

  const close = () => {
    flush();
    onClose();
  };
  const dialogRef = useDialog(true, close);

  const format = (kind: FormatKind) => {
    const el = areaRef.current;
    if (!el) return;
    const out = applyFormat(text, el.selectionStart, el.selectionEnd, kind);
    change(out.text);
    // put the cursor back after React has drawn the new text
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(out.start, out.end);
    });
  };

  const exportWord = async () => {
    setExportError(null);
    setExporting(true);
    try {
      flush();
      const m = await import('../lib/exportDocx');
      await m.downloadDocx(assignment.title, text);
    } catch {
      setExportError('Could not make the Word file. Try again, or use PDF.');
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = () => {
    flush();
    // The page prints its own copy of the text (#print-root, see index.css); the browser's print dialog has "Save as PDF".
    window.print();
  };

  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

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
            {TOOLS.map(({ kind, label, Icon }) => (
              <button
                key={kind}
                type="button"
                onClick={() => format(kind)}
                aria-label={label}
                title={label}
                className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            ))}
            <span className="flex-1" />
            <button
              type="button"
              onClick={exportWord}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-md border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60 cursor-pointer"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <FileDown className="h-4 w-4" aria-hidden="true" />}
              Word
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-md border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              PDF
            </button>
          </div>
          <div aria-live="polite">{exportError && <p role="alert" className="px-5 py-1 text-xs text-red-700 dark:text-red-300">{exportError}</p>}</div>

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

      {/* The copy the browser prints for "PDF": hidden on screen, the only thing shown when printing */}
      {createPortal(
        <div id="print-root" data-testid="print-root">
          <h1 style={{ fontSize: '22pt', marginBottom: '12pt' }}>{assignment.title}</h1>
          <MiniMarkdown text={text} />
        </div>,
        document.body
      )}
    </>
  );
};
