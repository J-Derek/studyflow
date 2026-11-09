import { useDialog } from '../lib/useDialog';
import React, { useEffect, useState } from 'react';
import { X, Download, Upload, AlertTriangle, Copy, LogOut, UserRound, CloudOff, Loader2, Check, CircleAlert, Trash2 } from 'lucide-react';
import { GoogleIcon } from './GoogleIcon';
import { Avatar } from './Avatar';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { useAccountView } from '../store/useAccountView';
import { deleteMyAccount, friendlyAuthMessage, signInOrLinkWithGoogle, signOutUser, warmUpGoogleSignIn } from '../lib/authActions';
import { useSyncErrors } from '../lib/syncErrors';
import { MAX_BACKUP_BYTES, validateBackupJson } from '../utils/backupValidator';
import { inAppBrowser } from '../utils/inAppBrowser';
import { buildBackup, downloadBackup } from '../utils/exportBackup';
import { useOnline } from '../lib/useOnline';
import { isPlaceholderDetail } from '../utils/placeholderProfile';
import { getSaveState } from '../utils/saveStatus';
import { accountSyncLine, planSummary } from '../utils/accountSummary';
import { periodWord } from '../utils/periods';
import { NewSemesterDialog } from './NewSemesterDialog';
import { PastSemestersDialog } from './PastSemestersDialog';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Opens the profile editor (name, picture, university). */
  onOpenProfile?: () => void;
}

const TONE = {
  ok: { box: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300', Icon: Check },
  busy: { box: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300', Icon: Loader2 },
  warn: { box: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-300', Icon: CloudOff },
  error: { box: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300', Icon: CircleAlert }
} as const;

const sectionTitle = 'text-xs font-semibold text-zinc-600 dark:text-zinc-400';
const secondaryButton =
  'flex items-center justify-center gap-2 min-h-[44px] px-3.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-100 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-60';

/**
 * "Your account": who is signed in, whether their work is saved, what their plan holds, and their data
 * (download a copy, restore one). Guests see how to sign in instead of the account card.
 * PR5 adds a "Delete my account" section at the bottom of the signed-in view.
 */
export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose, onOpenProfile }) => {
  const { assignments, sessions, grades, notes, drafts, archived, periods, customPhotoUrl, user, isSyncing, userId } = useStudyFlowStore();
  const account = useAccountView();
  const isAnonymous = !account.signedIn;
  const errors = useSyncErrors();
  const isOnline = useOnline();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [importStatus, setImportStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showNewPeriod, setShowNewPeriod] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // While the semester dialogs are open (they have their own), this one lets go of the keyboard.
  const dialogRef = useDialog(isOpen && !showNewPeriod && !showPast, onClose);

  // Get Google's sign-in ready while the student reads the dialog, so the pop-up opens instantly on click.
  useEffect(() => {
    if (isOpen && isAnonymous) void warmUpGoogleSignIn();
  }, [isOpen, isAnonymous]);

  if (!isOpen) return null;

  const own = {
    assignments: assignments.filter((x) => !x.sample),
    sessions: sessions.filter((x) => !x.sample),
    grades: grades.filter((x) => !x.sample),
    notes
  };

  const handleExportJSON = () => downloadBackup(
      buildBackup({
        assignments: [...assignments, ...archived.assignments],
        sessions: [...sessions, ...archived.sessions],
        grades: [...grades, ...archived.grades],
        notes: [...notes, ...archived.notes],
        drafts,
        periods
      })
    );

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // the same file can be chosen again after a failure
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setImportStatus({ ok: false, text: 'That file is too large to be a StudyFlow backup.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawText = event.target?.result as string;
      const validation = validateBackupJson(rawText);

      if (!validation.success) {
        setImportStatus({ ok: false, text: `Could not restore: ${validation.error}` });
        return;
      }

      useStudyFlowStore.getState().importLedger(validation.data.ledger);

      setImportStatus({ ok: true, text: 'Restored. Your plan now includes everything in that file.' });
      setTimeout(() => {
        setImportStatus(null);
        onClose();
      }, 1500);
    };
    reader.readAsText(file);
  };

  const handleGoogleAuth = async () => {
    try {
      setIsLinking(true);
      setAuthError(null);
      await signInOrLinkWithGoogle();
      onClose();
    } catch (err) {
      setAuthError(friendlyAuthMessage(err));
    } finally {
      setIsLinking(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await signOutUser();
    } catch (err) {
      console.error('Sign out error:', err);
      setSigningOut(false);
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteMyAccount(); // reloads the page when it is done
    } catch (err) {
      const message = friendlyAuthMessage(err);
      // null means they closed Google's window: they changed their mind, nothing was deleted.
      if (message !== null) setDeleteError(message === 'Could not sign in with Google. Please try again.' ? 'Your account could not be deleted. Nothing more was removed than before; please try again.' : message);
      setDeleting(false);
    }
  };

  const name = user.name || 'Student';
  // Only what the student actually typed; default wording is left out.
  const details = [user.program, user.university].filter((t) => !isPlaceholderDetail(t)).join(', ');
  const sync = accountSyncLine(
    getSaveState({ isOnline, isSyncing, errorCount: errors.length, hasAccount: userId !== null, isSignedIn: !isAnonymous }),
    errors.length
  );
  const tone = TONE[sync.tone];
  const summary = planSummary({
    assignments: own.assignments.length,
    sessions: own.sessions.length,
    grades: own.grades.length,
    notes: own.notes.length
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface-light dark:bg-surface-dark border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-5 space-y-5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="backup-modal-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {isAnonymous ? 'Sign in and back up' : 'Your account'}
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {isAnonymous ? 'Keep your plan on every device' : 'Your plan follows you to every device you sign in on'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex items-center justify-center min-h-[44px] min-w-[44px] -mt-2 -mr-2 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isAnonymous ? (
          <section aria-labelledby="account-signin-title" className="space-y-3">
            <h3 id="account-signin-title" className={sectionTitle}>
              Sign in to keep your plan on every device
            </h3>
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/70 dark:border-zinc-800 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>You are using StudyFlow as a guest.</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Sign in with Google to see your deadlines on your phone and laptop, and to keep them if you clear this browser.
              </p>
              {inAppBrowser() ? (
                <div className="space-y-2 pt-1">
                  <div className="p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
                    Google sign-in is blocked inside embedded browsers (WhatsApp, Instagram). Please open StudyFlow in Chrome or Safari to link your Google account.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText(window.location.origin);
                        setCopySuccess(true);
                        setTimeout(() => setCopySuccess(false), 2500);
                      }
                    }}
                    className={`w-full ${secondaryButton}`}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{copySuccess ? 'Link copied' : 'Copy the link for Chrome or Safari'}</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isLinking}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2.5 py-2 px-3 rounded-md border border-zinc-300 dark:border-zinc-600 bg-surface-light dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 text-sm font-medium shadow-2xs transition disabled:opacity-60 cursor-pointer"
                >
                  <GoogleIcon className="h-[18px] w-[18px]" />
                  <span>{isLinking ? 'Opening Google…' : 'Continue with Google'}</span>
                </button>
              )}
              {authError && (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400">{authError}</p>
              )}
            </div>
          </section>
        ) : (
          <section aria-label="Signed-in account" className="space-y-3">
            {/* Who is signed in */}
            <div className="flex items-center gap-3">
              <Avatar name={name} photoUrl={customPhotoUrl || account.photoUrl} isGuest={false} className="h-14 w-14 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{name}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">{account.email || 'Signed in'}</p>
                {details && <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">{details}</p>}
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <GoogleIcon className="h-3 w-3 shrink-0" />
                  Signed in with Google
                </p>
              </div>
            </div>

            {/* Is my work safe? */}
            <div aria-live="polite" data-testid="account-sync" data-tone={sync.tone} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${tone.box}`}>
              <tone.Icon className={`h-3.5 w-3.5 shrink-0 ${sync.tone === 'busy' ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
              <span>{sync.label}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {onOpenProfile && (
                <button type="button" onClick={onOpenProfile} className={secondaryButton}>
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                  Edit profile
                </button>
              )}
              <button type="button" onClick={handleSignOut} disabled={signingOut} className={`${secondaryButton} ${onOpenProfile ? '' : 'col-span-2'}`}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </section>
        )}

        {/* What the plan holds, and a copy of it */}
        <section aria-labelledby="account-data-title" className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
          <div>
            <h3 id="account-data-title" className={sectionTitle}>
              Your data
            </h3>
            <p data-testid="plan-summary" className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Your plan has {summary.slice(0, -1).join(', ')} and {summary[summary.length - 1]}.
              {isAnonymous ? ' It is kept in this browser only.' : ''}
            </p>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Download everything as one file you can keep, or restore from one. Restoring adds what is in the file to your plan.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleExportJSON}
              className="flex items-center justify-center gap-2 min-h-[44px] px-3.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-sm font-medium shadow-2xs transition active:scale-95 cursor-pointer"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Download my data</span>
            </button>

            <label className={`${secondaryButton} focus-within:ring-2 focus-within:ring-blue-500 active:scale-95`}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span>Restore from a file</span>
              <input type="file" accept=".json,application/json" onChange={handleImportJSON} className="sr-only" />
            </label>
          </div>

          <div aria-live="polite">
            {importStatus && (
              <p className={`text-xs text-center ${importStatus.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {importStatus.text}
              </p>
            )}
          </div>
        </section>

        {/* A fresh start without losing anything */}
        <section aria-labelledby="account-period-title" className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
          <h3 id="account-period-title" className={sectionTitle}>
            {`Semesters and terms`}
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            When a {periodWord(user.periodLabel)} ends, start the next one. Nothing is deleted: the old one is kept to read in Past {periodWord(user.periodLabel)}s.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button type="button" onClick={() => setShowNewPeriod(true)} className={secondaryButton}>
              Start a new {periodWord(user.periodLabel)}
            </button>
            <button type="button" onClick={() => setShowPast(true)} className={secondaryButton}>
              Past {periodWord(user.periodLabel)}s{periods.length > 0 ? ` (${periods.length})` : ''}
            </button>
          </div>
        </section>
        {showNewPeriod && (
          <NewSemesterDialog
            onClose={() => setShowNewPeriod(false)}
            onOpenPast={() => {
              setShowNewPeriod(false);
              setShowPast(true);
            }}
          />
        )}
        {showPast && <PastSemestersDialog onClose={() => setShowPast(false)} />}

        {/* The one thing that cannot be undone */}
        {!isAnonymous && (
          <section aria-labelledby="account-delete-title" className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
            <h3 id="account-delete-title" className={sectionTitle}>
              Delete my account
            </h3>
            {!confirmingDelete ? (
              <>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Remove your plan, your profile and your sign-in account from StudyFlow, and clear this device.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="flex items-center justify-center gap-2 min-h-[44px] px-3.5 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete my account…
                </button>
              </>
            ) : (
              <div data-testid="delete-confirm" className="space-y-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/30 p-3">
                <p className="text-sm text-red-900 dark:text-red-200">
                  <strong>This cannot be undone.</strong> Your assignments, timetable, grades, notes, timer history and profile will be deleted for good, and so will your sign-in account.
                  Download your data first if you want a copy.
                </p>
                <p className="text-xs text-red-900 dark:text-red-200">To make sure it is you, Google will ask you to sign in again.</p>
                <div className="flex flex-col-reverse sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingDelete(false);
                      setDeleteError(null);
                    }}
                    disabled={deleting}
                    className={`${secondaryButton} sm:flex-1`}
                  >
                    Keep my account
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="sm:flex-1 flex items-center justify-center gap-2 min-h-[44px] px-3.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-medium disabled:opacity-60 cursor-pointer"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                    {deleting ? 'Deleting…' : 'Sign in again and delete'}
                  </button>
                </div>
                <div aria-live="polite">{deleteError && <p role="alert" className="text-xs text-red-800 dark:text-red-300">{deleteError}</p>}</div>
              </div>
            )}
          </section>
        )}

        <p className="text-xs text-zinc-600 dark:text-zinc-400 text-center">
          <a
            href="/privacy"
            className="underline underline-offset-2"
            onClick={(e) => {
              e.preventDefault();
              onClose();
              useStudyFlowStore.getState().setActiveTab('privacy');
            }}
          >
            Privacy
          </a>
          {' · '}
          <a
            href="/terms"
            className="underline underline-offset-2"
            onClick={(e) => {
              e.preventDefault();
              onClose();
              useStudyFlowStore.getState().setActiveTab('terms');
            }}
          >
            Terms
          </a>
        </p>
      </div>
    </div>
  );
};
