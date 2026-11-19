import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAccountView } from '../store/useAccountView';
import { hasAccountLoaded, subscribeAccountLoaded } from './signInProgress';

/** Longest we wait for the cloud before treating what is on the device as everything (offline, or a slow connection). */
const READY_CAP_MS = 8000;

/** A guest has everything on the device; a signed-in account is ready once the cloud has answered, or we have waited long enough. */
export function accountDataReady(signedIn: boolean, loaded: boolean, timedOut: boolean): boolean {
  return !signedIn || loaded || timedOut;
}

/**
 * False while a signed-in account's records are still on their way from the cloud after a page load, so a page that looks one up by id
 * can say "loading" instead of "not found". A guest has everything on the device, so it is ready at once.
 */
export function useAccountDataReady(): boolean {
  const signedIn = useAccountView().signedIn;
  const loaded = useSyncExternalStore(subscribeAccountLoaded, hasAccountLoaded, () => false);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!signedIn || loaded) return;
    const t = window.setTimeout(() => setTimedOut(true), READY_CAP_MS);
    return () => window.clearTimeout(t);
  }, [signedIn, loaded]);
  return accountDataReady(signedIn, loaded, timedOut);
}
