import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AUTH_NOTICE_EVENT, takePendingAuthNotice } from '../lib/authNotice';

/** Shows a message from the sign-in code, such as "Google sign-in did not finish". Dismissible. */
export const AuthNotice: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const show = () => setMessage(takePendingAuthNotice());
    show();
    window.addEventListener(AUTH_NOTICE_EVENT, show);
    return () => window.removeEventListener(AUTH_NOTICE_EVENT, show);
  }, []);

  if (!message) return null;
  return (
    <div
      role="alert"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] flex items-start gap-3 w-[min(34rem,calc(100vw-2rem))] rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-800 dark:text-red-200 shadow-lg"
    >
      <p className="flex-1">{message}</p>
      <button
        type="button"
        onClick={() => setMessage(null)}
        aria-label="Dismiss message"
        className="min-h-[44px] min-w-[44px] -my-2 -mr-2 flex items-center justify-center rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 cursor-pointer"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};
