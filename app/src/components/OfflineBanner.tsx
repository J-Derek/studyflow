import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnline } from '../lib/useOnline';

/**
 * A thin bar under the header while the device has no connection. Work keeps going and is kept on this device;
 * it is sent to the account when the connection returns. (The "Saved" badge says the same in two words.)
 * A polite live region without role="status": older tests expect exactly one status element on the page.
 */
export const OfflineBanner: React.FC = () => {
  const online = useOnline();
  return (
    <div aria-live="polite">
      {!online && (
        <p
          data-testid="offline-banner"
          className="flex items-center justify-center gap-2 px-4 py-2 text-xs text-center bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-900"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>You are offline. You can keep working: changes stay on this device and are sent to your account when you are back online.</span>
        </p>
      )}
    </div>
  );
};
