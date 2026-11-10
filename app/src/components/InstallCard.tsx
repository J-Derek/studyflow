import React, { useState } from 'react';
import { Download, Share } from 'lucide-react';
import { isIosDevice, useInstallPrompt } from '../lib/installPrompt';

/**
 * "Install StudyFlow": put it on the home screen or desktop, and it opens like an app, even with no connection. Chrome, Edge and Android
 * offer a button; iPhones and iPads need Share, then Add to Home Screen, so we say so. Nothing is shown once it is installed.
 */
export const InstallCard: React.FC = () => {
  const { canInstall, installed, install } = useInstallPrompt();
  const [answer, setAnswer] = useState<string | null>(null);
  if (installed) return null;
  return (
    <div data-testid="install-card" className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-750 bg-zinc-50/60 dark:bg-zinc-850/30">
      <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Install StudyFlow</h3>
      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
        Add it to your home screen or desktop. It opens like an app, and it opens even with no connection.
      </p>
      {canInstall ? (
        <button
          type="button"
          onClick={async () => setAnswer((await install()) === 'accepted' ? 'Installed. Look for StudyFlow on your device.' : null)}
          className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-white/90 transition shadow-2xs cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Install the app</span>
        </button>
      ) : isIosDevice() ? (
        <p className="mt-2 text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
          <Share className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> On iPhone or iPad: tap Share, then Add to Home Screen.
        </p>
      ) : (
        <p className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">In your browser menu, choose Install app (or Add to Home screen).</p>
      )}
      {answer && <p role="status" className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{answer}</p>}
    </div>
  );
};
