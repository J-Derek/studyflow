import type React from 'react';
import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { applyFormat, type FormatKind } from '../utils/markdownEdit';

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
