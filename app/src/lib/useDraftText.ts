import { useCallback, useEffect, useRef, useState } from 'react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { MAX_DRAFT_BODY } from '../services/firestoreMappers';

const AUTOSAVE_MS = 1000;

/**
 * An assignment's notes (its draft) being edited: saved one second after the student stops typing, when the editor goes away and when the
 * page is left. Used by the notes on the assignment's page and by the full-screen writing space.
 */
export function useDraftText(assignmentId: string) {
  const saveDraft = useStudyFlowStore((s) => s.saveDraft);
  const [stored] = useState(() => useStudyFlowStore.getState().drafts.find((d) => d.id === assignmentId)?.body ?? '');
  const [text, setText] = useState(stored);
  const [status, setStatus] = useState<'saved' | 'saving'>('saved');
  const textRef = useRef(stored);
  const savedRef = useRef(stored);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    if (textRef.current !== savedRef.current) {
      savedRef.current = textRef.current;
      saveDraft(assignmentId, textRef.current);
    }
    setStatus('saved');
  }, [assignmentId, saveDraft]);

  const change = useCallback(
    (next: string) => {
      const clipped = next.slice(0, MAX_DRAFT_BODY);
      setText(clipped);
      textRef.current = clipped;
      setStatus('saving');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, AUTOSAVE_MS);
    },
    [flush]
  );

  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      flush();
    };
  }, [flush]);

  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  return { text, change, flush, status, wordCount };
}
