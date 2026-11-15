import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FileDown, Loader2, Printer } from 'lucide-react';
import type { ParseOptions } from '../utils/miniMarkdown';
import { MiniMarkdown } from './MiniMarkdown';

const button =
  'inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-md border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60 cursor-pointer';

interface ExportButtonsProps {
  title: string;
  text: string;
  /** How the text is read (notes keep line breaks and bare web addresses). */
  format?: ParseOptions;
  /** Called first, so what is typed is saved before it is exported. */
  onBeforeExport?: () => void;
}

/**
 * Export to Word (.docx) and to PDF (the browser's print dialog has "Save as PDF"), for assignment writing and for notes alike.
 * The page prints its own copy of the text (#print-root, see index.css): hidden on screen, the only thing shown when printing.
 */
export const ExportButtons: React.FC<ExportButtonsProps> = ({ title, text, format, onBeforeExport }) => {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportWord = async () => {
    setError(null);
    setExporting(true);
    try {
      onBeforeExport?.();
      const m = await import('../lib/exportDocx');
      await m.downloadDocx(title, text, format);
    } catch {
      setError('Could not make the Word file. Try again, or use PDF.');
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = () => {
    onBeforeExport?.();
    window.print();
  };

  return (
    <>
      <button type="button" onClick={exportWord} disabled={exporting} className={button}>
        {exporting ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <FileDown className="h-4 w-4" aria-hidden="true" />}
        Word
      </button>
      <button type="button" onClick={exportPdf} className={button}>
        <Printer className="h-4 w-4" aria-hidden="true" />
        PDF
      </button>
      {/* An alert is read out when it appears; it only takes a line of its own when there is something to say */}
      {error && (
        <span role="alert" className="basis-full py-1 text-xs text-red-700 dark:text-red-300">
          {error}
        </span>
      )}
      {createPortal(
        <div id="print-root" data-testid="print-root">
          <h1 style={{ fontSize: '22pt', marginBottom: '12pt' }}>{title}</h1>
          <MiniMarkdown text={text} format={format} />
        </div>,
        document.body
      )}
    </>
  );
};
