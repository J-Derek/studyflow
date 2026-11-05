import {
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User
} from 'firebase/auth';
import { clearIndexedDbPersistence, terminate, waitForPendingWrites } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { initFirestoreSync, mergeGuestDataIntoAccount, unsubscribeAllFirestoreSync } from '../services/firestoreSync';
import { inAppBrowser } from '../utils/inAppBrowser';
import { withoutSample } from '../utils/sampleData';

export const STORAGE_KEY = 'studyflow_storage_v1';

const authBroadcast =
  typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel('studyflow_auth_channel') : null;

if (authBroadcast) {
  authBroadcast.onmessage = (event) => {
    if (event.data === 'signout') {
      // Another tab signed out: stop listening, release the offline cache, drop local data, reload.
      void wipeLocalUserData({ clearFirestoreCache: false }).finally(() => window.location.reload());
    }
  };
}

/**
 * Removes everything this browser holds for the previous user: listeners, in-memory store,
 * localStorage, sessionStorage, Cache Storage and (optionally) the Firestore IndexedDB cache.
 */
export async function wipeLocalUserData(opts: { clearFirestoreCache: boolean }): Promise<void> {
  unsubscribeAllFirestoreSync();
  useStudyFlowStore.getState().resetStore();
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.clear();
  } catch {
    /* storage unavailable */
  }
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* Cache Storage unavailable */
  }
  try {
    await terminate(db);
    if (opts.clearFirestoreCache) {
      // Other tabs may still hold the cache for a moment after they receive the sign-out message.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await clearIndexedDbPersistence(db);
          break;
        } catch (e) {
          if (attempt === 4) throw e;
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    }
  } catch (err) {
    console.warn('Could not clear the offline cache:', err);
  }
}

let authInFlightPromise: Promise<User> | null = null;

/** Ensures a session exists; provisions an anonymous guest if none. Safe across tabs. */
export async function ensureAuthenticatedUser(): Promise<User> {
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;

  if (!authInFlightPromise) {
    authInFlightPromise = (async () => {
      try {
        const credential = await signInAnonymously(auth);
        return credential.user;
      } finally {
        authInFlightPromise = null;
      }
    })();
  }
  return authInFlightPromise;
}

export function isAnonymousUser(): boolean {
  return !!auth.currentUser?.isAnonymous;
}

/**
 * Single place that ties Firebase Auth to the store and to Firestore sync.
 * Whenever the signed-in uid changes (sign-in, switch, link) the previous user's data is cleared
 * before the new user's listeners start, so one student never sees another's records.
 */
let syncedUid: string | null = null;
let mergeInProgress = false;
let wiping = false;

/** Flushes in-flight writes, deletes every local trace of the previous user, then reloads clean. */
async function wipeAndReload(): Promise<void> {
  wiping = true; // the page is about to reload; ignore any further auth events
  await waitForPendingWrites(db).catch(() => undefined);
  await wipeLocalUserData({ clearFirestoreCache: true });
  window.location.reload();
}

/**
 * Points the store and the Firestore listeners at `user`. Idempotent. Called from the auth listener
 * and directly after link/sign-in, because linking an anonymous user does not fire onAuthStateChanged.
 */
function bindUser(user: User | null): void {
  if (wiping) return;
  if (!user) {
    syncedUid = null;
    unsubscribeAllFirestoreSync();
    return;
  }
  const store = useStudyFlowStore.getState();
  const owner = store.dataOwnerUid;
  if (owner && owner !== user.uid) {
    // Data on this device belongs to someone else. Never show it, never upload it.
    unsubscribeAllFirestoreSync();
    store.resetStore();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    syncedUid = null;
    // The Firestore offline cache still holds the previous user's documents. Drop it.
    if (!mergeInProgress) {
      void wipeAndReload();
      return;
    }
  }
  useStudyFlowStore.getState().setAuthUser(user.uid, user.isAnonymous, user.email, user.displayName);
  if (syncedUid !== user.uid) {
    syncedUid = user.uid;
    initFirestoreSync(user.uid);
  }
}

/**
 * Single place that ties Firebase Auth to the store and to Firestore sync.
 * Whenever the signed-in uid changes (sign-in, switch, link) the previous user's data is cleared
 * before the new user's listeners start, so one student never sees another's records.
 */
export function startAuthSession(): () => void {
  const unsubscribe = onAuthStateChanged(auth, bindUser);
  ensureAuthenticatedUser().catch((err) => console.error('Firebase guest authentication error:', err));
  return () => {
    unsubscribe();
    unsubscribeAllFirestoreSync();
    syncedUid = null;
  };
}

export class AuthGuidanceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export { friendlyAuthMessage } from './authActions';

/**
 * Upgrades a guest to a Google account, or signs in to an existing one.
 * If the Google account already exists, the guest's own records are merged into it before the
 * switch completes (records that already exist in the account are never overwritten).
 */
export async function signInOrLinkWithGoogle(): Promise<User> {
  if (inAppBrowser()) {
    throw new AuthGuidanceError('auth/in-app-browser-blocked', 'Google sign-in is blocked inside embedded browsers.');
  }

  const currentUser = auth.currentUser;

  if (currentUser && currentUser.isAnonymous) {
    try {
      const result = await linkWithPopup(currentUser, googleProvider, browserPopupRedirectResolver);
      bindUser(result.user);
      return result.user;
    } catch (error: unknown) {
      if ((error as { code?: string })?.code !== 'auth/credential-already-in-use') throw error;
      const credential = GoogleAuthProvider.credentialFromError(error as never);
      if (!credential) throw error;

      // Capture the guest's records before the account switch clears the store.
      const state = useStudyFlowStore.getState();
      const guestData = {
        assignments: withoutSample(state.assignments),
        sessions: withoutSample(state.sessions),
        grades: withoutSample(state.grades)
      };
      mergeInProgress = true;
      try {
        const result = await signInWithCredential(auth, credential);
        bindUser(result.user);
        await mergeGuestDataIntoAccount(result.user.uid, guestData);
        return result.user;
      } finally {
        mergeInProgress = false;
        // The guest's cached records are now in the account; remove the guest copy from this device.
        void wipeAndReload();
      }
    }
  }
  const result = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
  bindUser(result.user);
  return result.user;
}

/**
 * Signs out, broadcasts to other tabs, wipes everything stored for this user on the device,
 * then reloads into a clean guest session.
 */
export async function signOutUser(): Promise<void> {
  authBroadcast?.postMessage('signout');
  await firebaseSignOut(auth);
  await wipeLocalUserData({ clearFirestoreCache: true });
  window.location.reload();
}
