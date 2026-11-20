import React, { useEffect, useId, useState } from 'react';
import { Copy, Link2, Loader2, RefreshCw, Share2, X } from 'lucide-react';
import type { Note } from '../types';
import { useDialog } from '../lib/useDialog';
import { confirmAction } from '../lib/confirm';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { fetchSharedNote, shareNote, stopSharing, updateSharedNote } from '../services/sharedNotes';
import { isPlaceholderName } from '../utils/placeholderProfile';
import { sharePath } from '../utils/shareNote';

const button =
  'inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60 cursor-pointer';
const primary =
  'inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium disabled:opacity-60 cursor-pointer';

const OFFLINE = 'Could not reach StudyFlow. Check your connection and try again.';

/** A phone (touch first, with the system share sheet) shares the link; a computer copies it. */
const usesShareSheet = () =>
  typeof navigator.share === 'function' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

/**
 * Share a note by link: a read-only copy anyone with the link can open, without signing in. The copy changes only when the
 * student updates it, and the link stops working when they stop sharing (or delete the note).
 */
export const ShareNoteDialog: React.FC<{ note: Note; onClose: () => void }> = ({ note, onClose }) => {
  const userId = useStudyFlowStore((s) => s.userId);
  const profileName = useStudyFlowStore((s) => s.user.name);
  const setNoteShareId = useStudyFlowStore((s) => s.setNoteShareId);
  const titleId = useId();
  const dialogRef = useDialog(true, onClose);
  const [busy, setBusy] = useState<null | 'create' | 'update' | 'stop'>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const name = isPlaceholderName(profileName) ? '' : profileName.trim();
  const [showName, setShowName] = useState(false);

  const shareId = note.shareId ?? null;
  const url = shareId ? `${window.location.origin}${sharePath(shareId)}` : '';

  // For a note already shared: whether the copy shows the name, and whether the link still works (it may have been stopped elsewhere).
  useEffect(() => {
    if (!shareId) return;
    let live = true;
    fetchSharedNote(shareId)
      .then((copy) => {
        if (!live) return;
        if (copy) setShowName(!!copy.sharedBy);
        else setNoteShareId(note.id, null);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [shareId, note.id, setNoteShareId]);

  const sharedBy = showName && name ? name : null;

  const run = async (kind: 'create' | 'update' | 'stop', work: () => Promise<string>) => {
    setError('');
    setStatus('');
    setBusy(kind);
    try {
      setStatus(await work());
    } catch {
      setError(OFFLINE);
    } finally {
      setBusy(null);
    }
  };

  const create = () =>
    run('create', async () => {
      if (!userId) throw new Error('no session');
      const id = await shareNote(userId, note, sharedBy);
      setNoteShareId(note.id, id);
      return 'Link ready. Anyone with it can read this note.';
    });

  const update = () =>
    run('update', async () => {
      if (!shareId) return '';
      await updateSharedNote(shareId, note, sharedBy);
      return 'Shared copy updated.';
    });

  const stop = async () => {
    if (!shareId || !userId) return;
    const ok = await confirmAction({
      title: 'Stop sharing this note?',
      body: 'The link stops working for everyone. Your note stays as it is.',
      confirmLabel: 'Stop sharing'
    });
    if (!ok) return;
    await run('stop', async () => {
      try {
        await stopSharing(userId, shareId);
      } catch (err) {
        // Already gone (stopped on another device): nothing left to remove.
        if ((await fetchSharedNote(shareId).catch(() => 'unknown')) !== null) throw err;
      }
      setNoteShareId(note.id, null);
      return 'Sharing stopped. The link no longer works.';
    });
  };

  const sendLink = async () => {
    setError('');
    if (usesShareSheet()) {
      try {
        await navigator.share({ title: note.title, url });
      } catch {
        /* closed the share sheet */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied.');
    } catch {
      setError('Could not copy. Select the link above and copy it.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl bg-surface-light dark:bg-surface-dark border border-zinc-200 dark:border-zinc-800 shadow-xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold text-zinc-900 dark:text-zinc-100 [overflow-wrap:anywhere]">
            Share “{note.title}”
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-2 -mr-2 flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Anyone with the link can read a copy of this note, without signing in. Changes you make later are not shared until you update the copy.
        </p>

        {name && (
          <label className="flex items-center gap-2 min-h-[44px] text-sm text-zinc-800 dark:text-zinc-200 cursor-pointer">
            <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="h-4 w-4 rounded" />
            Show my name ({name}) on the shared copy
          </label>
        )}

        {!shareId ? (
          <button type="button" onClick={create} disabled={busy !== null || !userId} className={primary}>
            {busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
            {busy === 'create' ? 'Creating link…' : 'Create link'}
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor={`${titleId}-url`} className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Link
              </label>
              <input
                id={`${titleId}-url`}
                readOnly
                value={url}
                onFocus={(e) => e.target.select()}
                data-testid="share-url"
                className="w-full min-h-[44px] px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={sendLink} className={primary}>
                {usesShareSheet() ? <Share2 className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {usesShareSheet() ? 'Share link' : 'Copy link'}
              </button>
              <button type="button" onClick={update} disabled={busy !== null} className={button}>
                {busy === 'update' ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                Update shared copy
              </button>
              <button type="button" onClick={stop} disabled={busy !== null} className={`${button} text-rose-700 dark:text-rose-300`}>
                Stop sharing
              </button>
            </div>
          </div>
        )}

        {!userId && <p className="text-sm text-zinc-700 dark:text-zinc-300">Sharing needs a connection to StudyFlow. Try again in a moment.</p>}
        <p role="status" aria-live="polite" data-testid="share-status" className="text-sm text-zinc-700 dark:text-zinc-300 empty:hidden">
          {status}
        </p>
        {error && (
          <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};
