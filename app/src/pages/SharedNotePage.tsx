import React, { useEffect, useState } from 'react';
import { Check, Loader2, Plus } from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { fetchSharedNote, type SharedNote } from '../services/sharedNotes';
import { shareIdFromPath } from '../utils/shareNote';
import { NOTE_FORMAT } from '../utils/miniMarkdown';
import { MiniMarkdown } from '../components/MiniMarkdown';

/** Keeps a shared note out of search engines while it is open (vercel.json also sends X-Robots-Tag for /s/*). */
function useNoIndex(): void {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

const formatDay = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * A note someone shared by link (/s/<id>): read-only, no sign-in needed. The text goes through the same small Markdown reader as notes
 * (no HTML is ever rendered). A signed-in student can keep a copy in their own notes.
 */
export const SharedNotePage: React.FC = () => {
  useNoIndex();
  const shareId = shareIdFromPath(window.location.pathname);
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'gone' } | { kind: 'error' } | { kind: 'ready'; note: SharedNote }>(() =>
    shareId ? { kind: 'loading' } : { kind: 'gone' }
  );
  const userId = useStudyFlowStore((s) => s.userId);
  const isAnonymous = useStudyFlowStore((s) => s.isAnonymous);
  const addNote = useStudyFlowStore((s) => s.addNote);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!shareId) return;
    let live = true;
    fetchSharedNote(shareId)
      .then((note) => live && setState(note ? { kind: 'ready', note } : { kind: 'gone' }))
      .catch(() => live && setState({ kind: 'error' }));
    return () => {
      live = false;
    };
  }, [shareId]);

  useEffect(() => {
    if (state.kind === 'ready') document.title = `${state.note.title.slice(0, 60)} · StudyFlow`;
  }, [state]);

  if (state.kind === 'loading') {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Opening the shared note…
      </p>
    );
  }
  if (state.kind === 'gone' || state.kind === 'error') {
    return (
      <div className="max-w-xl space-y-2 animate-fade-in">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {state.kind === 'gone' ? 'This link no longer works' : 'Could not open this note'}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {state.kind === 'gone'
            ? 'The person who shared it may have stopped sharing or deleted the note.'
            : 'Check your connection and reload the page.'}
        </p>
      </div>
    );
  }

  const { note } = state;
  const signedIn = !!userId && !isAnonymous;
  const meta = [note.course, note.sharedBy ? `Shared by ${note.sharedBy}` : 'Shared', note.sharedAt ? formatDay(note.sharedAt) : ''].filter(Boolean).join(' · ');

  return (
    <article className="max-w-3xl space-y-4 animate-fade-in pb-16">
      <header className="space-y-1">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{meta}</p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 [overflow-wrap:anywhere]">{note.title}</h1>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">A read-only copy. Changes the owner makes later appear only when they update it.</p>
      </header>

      {signedIn ? (
        <button
          type="button"
          disabled={saved}
          onClick={() => {
            addNote({ title: note.title, body: note.body.slice(0, 20000), course: note.course });
            setSaved(true);
          }}
          className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-70 cursor-pointer"
        >
          {saved ? <Check className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          {saved ? 'Saved to your notes' : 'Save a copy to my notes'}
        </button>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Sign in to save a copy to your own notes.</p>
      )}

      <div data-testid="shared-note-body" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-surface-light dark:bg-surface-dark p-4 md:p-6">
        {note.body.trim() === '' ? <p className="text-sm text-zinc-600 dark:text-zinc-400">This note is empty.</p> : <MiniMarkdown text={note.body} format={NOTE_FORMAT} />}
      </div>
    </article>
  );
};
