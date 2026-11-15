import React, { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { Bold, Heading2, Italic, List, ListOrdered } from 'lucide-react';
import { applyFormat, type FormatKind } from '../utils/markdownEdit';

const TOOLS: { kind: FormatKind; label: string; Icon: typeof Bold }[] = [
  { kind: 'heading', label: 'Heading', Icon: Heading2 },
  { kind: 'bold', label: 'Bold', Icon: Bold },
  { kind: 'italic', label: 'Italic', Icon: Italic },
  { kind: 'bullet', label: 'Bulleted list', Icon: List },
  { kind: 'numbered', label: 'Numbered list', Icon: ListOrdered }
];

/**
 * Applies a formatting button to a text box. The new text is drawn at once (flushSync), so the selection can be put back in the same
 * tap: a phone ignores focus and selection changes made later, which left the student with the cursor elsewhere and, after deleting
 * the placeholder by hand, a stray "****".
 */
export function useFormatting(areaRef: React.RefObject<HTMLTextAreaElement | null>, text: string, change: (next: string) => void) {
  return useCallback(
    (kind: FormatKind) => {
      const el = areaRef.current;
      if (!el) return;
      const out = applyFormat(text, el.selectionStart, el.selectionEnd, kind);
      flushSync(() => change(out.text));
      el.focus();
      el.setSelectionRange(out.start, out.end);
    },
    [areaRef, text, change]
  );
}

/** The heading, bold, italic and list buttons. Used by the writing space for assignments and by the note editor. */
export const FormatButtons: React.FC<{ onFormat: (kind: FormatKind) => void }> = ({ onFormat }) => (
  <>
    {TOOLS.map(({ kind, label, Icon }) => (
      <button
        key={kind}
        type="button"
        // Keeps the cursor (and a phone's keyboard) in the text box: a press must not move focus to the button.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onFormat(kind)}
        aria-label={label}
        title={label}
        className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
    ))}
  </>
);
