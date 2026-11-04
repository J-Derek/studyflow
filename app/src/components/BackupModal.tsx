import React, { useState } from 'react';
import { X, Download, Upload, Cloud, CheckCircle2, AlertTriangle, Database, Copy } from 'lucide-react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { friendlyAuthMessage, signInOrLinkWithGoogle } from '../lib/auth';
import { MAX_BACKUP_BYTES, validateBackupJson } from '../utils/backupValidator';
import { inAppBrowser } from '../utils/inAppBrowser';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose }) => {
  const { assignments, sessions, grades, isAnonymous, userEmail } = useStudyFlowStore();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  const handleExportJSON = () => {
    const backupData = {
      version: 'StudyFlow-v1.2',
      exportedAt: new Date().toISOString(),
      ledger: {
        assignments: assignments.filter((x) => !x.sample),
        sessions: sessions.filter((x) => !x.sample),
        grades: grades.filter((x) => !x.sample)
      }
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `studyflow-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setImportStatus('Validation failed: file is too large to be a StudyFlow backup.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawText = event.target?.result as string;
      const validation = validateBackupJson(rawText);

      if (!validation.success) {
        setImportStatus(`Validation failed: ${validation.error}`);
        return;
      }

      useStudyFlowStore.getState().importLedger(validation.data.ledger);

      setImportStatus('Your data successfully verified and restored!');
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface-light dark:bg-surface-dark border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-5 space-y-5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Academic Data & Data Durability
              </h3>
              <p className="text-[11px] tabular-nums text-zinc-500">System Design: Zero lock-in, client-first portability</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Section 1: Offline Local JSON Portability */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 tabular-nums">
            Local Disaster Recovery (JSON)
          </h4>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Export a standalone, human-readable snapshot of all assignments, milestones, course syllabi, and GPA records.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={handleExportJSON}
              className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium shadow-2xs transition active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export JSON Data</span>
            </button>

            <label className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium cursor-pointer transition active:scale-95">
              <Upload className="h-3.5 w-3.5" />
              <span>Restore from Backup</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </label>
          </div>

          {importStatus && (
            <p className="text-xs tabular-nums text-center text-blue-600 dark:text-blue-400">
              {importStatus}
            </p>
          )}
        </div>

        {/* Section 2: Multi-Device Cloud Sync */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 tabular-nums">
            Multi-Device Cloud Synchronization
          </h4>

          {isAnonymous ? (
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/70 dark:border-zinc-800 space-y-2">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Currently running in local guest session.</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Link your Google account to mirror your study plan across phone, tablet, and laptop with zero data loss.
              </p>
              {inAppBrowser() ? (
                <div className="space-y-2 pt-1">
                  <div className="p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
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
                    className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium shadow-2xs transition active:scale-95"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{copySuccess ? 'Link Copied to Clipboard!' : 'Copy Link for Chrome / Safari'}</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGoogleAuth}
                  disabled={isLinking}
                  className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-2xs transition disabled:opacity-60"
                >
                  <Cloud className="h-3.5 w-3.5" />
                  <span>{isLinking ? 'Linking Google Account...' : 'Link Google Account'}</span>
                </button>
              )}
              {authError && (
                <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">{authError}</p>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <div>
                  <p className="text-xs font-medium text-emerald-900 dark:text-emerald-100">Cloud Sync Active</p>
                  <p className="text-[10px] tabular-nums text-emerald-600 dark:text-emerald-400">{userEmail}</p>
                </div>
              </div>
              <span className="text-[10px] tabular-nums px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                Auto-Save
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
