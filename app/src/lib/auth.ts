import {
  browserPopupRedirectResolver,
  getRedirectResult,
  GoogleAuthProvider,
  linkWithPopup,
  linkWithRedirect,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User
} from 'firebase/auth';
import { clearIndexedDbPersistence, terminate, waitForPendingWrites } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { initFirestoreSync, mergeGuestDataIntoAccount, unsubscribeAllFirestoreSync } from '../services/firestoreSync';
import { deleteAllFiles } from './localFiles';
import { postAuthNotice } from './authNotice';
import { friendlyAuthMessage } from './authActions';
import { markRedirectPending, takeRedirectPending, windowOpenIsReplaced } from '../utils/popupSupport';
import { inAppBrowser } from '../utils/inAppBrowser';
import { withoutSample } from '../utils/sampleData';
import { clearPendingMerge, readPendingMerge, savePendingMerge } from './pendingMerge';

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
  // PDFs attached to notes live only in this browser, so they must not outlive the signed-in student.
  await deleteAllFiles().catch(() => undefined);
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
  useStudyFlowStore.getState().setAuthUser(user.uid, user.isAnonymous, user.email, user.displayName, user.photoURL);
  if (syncedUid !== user.uid) {
    syncedUid = user.uid;
    initFirestoreSync(user.uid);
    if (!user.isAnonymous && !mergeInProgress) void retryPendingMerge(user.uid);
  }
}

/** Finishes moving guest records that could not be copied earlier (see pendingMerge.ts). */
async function retryPendingMerge(uid: string): Promise<void> {
  const pending = readPendingMerge(uid);
  if (!pending) return;
  try {
    await mergeGuestDataIntoAccount(uid, { assignments: pending.assignments, sessions: pending.sessions, grades: pending.grades, notes: pending.notes });
    clearPendingMerge();
  } catch (err) {
    console.warn('Could not finish moving the guest records yet; will retry next time:', err);
  }
}

/**
 * Single place that ties Firebase Auth to the store and to Firestore sync.
 * Whenever the signed-in uid changes (sign-in, switch, link) the previous user's data is cleared
 * before the new user's listeners start, so one student never sees another's records.
 */
export function startAuthSession(): () => void {
  const unsubscribe = onAuthStateChanged(auth, bindUser);
  // If the student has just come back from Google (the same-tab sign-in), finish that first.
  void completeRedirectSignIn();
  ensureAuthenticatedUser().catch((err) => console.error('Firebase guest authentication error:', err));
  return () => {
    unsubscribe();
    unsubscribeAllFirestoreSync();
    syncedUid = null;
  };
}

/**
 * Gets Google's sign-in machinery ready before the student clicks. The first popup otherwise has to
 * download it first, and browsers only allow a popup that opens right after the click.
 * Asking for the redirect result is the supported way to start that setup; it resolves to null here.
 */
export function warmUpGoogleSignIn(): void {
  redirectResultOnce().catch(() => null);
}

/**
 * Firebase hands the result of a same-page sign-in to the FIRST caller of getRedirectResult and gives
 * everyone after that nothing. The idle warm-up above and completeRedirectSignIn both ask, in either
 * order, so they must share one answer.
 */
let redirectResultPromise: ReturnType<typeof getRedirectResult> | null = null;
function redirectResultOnce(): ReturnType<typeof getRedirectResult> {
  if (!redirectResultPromise) redirectResultPromise = getRedirectResult(auth, browserPopupRedirectResolver);
  return redirectResultPromise;
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
export async function signInOrLinkWithGoogle(): Promise<User | null> {
  if (inAppBrowser()) {
    throw new AuthGuidanceError('auth/in-app-browser-blocked', 'Google sign-in is blocked inside embedded browsers.');
  }

  // An ad blocker that replaced window.open can never show the Google window, whatever the browser's
  // pop-up setting says. Go to Google in this tab instead, and come back signed in.
  if (windowOpenIsReplaced()) return signInOnThisPage();

  try {
    return await signInWithPopupWindow();
  } catch (error: unknown) {
    // The browser refused the window: do the same-tab sign-in rather than leave the student stuck.
    if ((error as { code?: string })?.code === 'auth/popup-blocked') return signInOnThisPage();
    throw error;
  }
}

/** Signs in through a Google pop-up window (the fast path). */
async function signInWithPopupWindow(): Promise<User> {
  const currentUser = auth.currentUser;

  if (currentUser && currentUser.isAnonymous) {
    try {
      const result = await linkWithPopup(currentUser, googleProvider, browserPopupRedirectResolver);
      bindUser(result.user);
      return result.user;
    } catch (error: unknown) {
      if ((error as { code?: string })?.code !== 'auth/credential-already-in-use') throw error;
      return mergeGuestIntoExistingAccount(error);
    }
  }
  const result = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
  bindUser(result.user);
  return result.user;
}

/**
 * Signs in by sending this whole page to Google and back, so no pop-up is needed. The result is picked
 * up by completeRedirectSignIn() when the page loads again. Resolves to null: the page is leaving.
 */
async function signInOnThisPage(): Promise<null> {
  // Auth starts without the pop-up/redirect machinery (to keep pages light), but a same-page sign-in
  // needs its storage ready before the page leaves. This is Firebase's own set-up step, run on demand.
  const internal = auth as unknown as { getOrInitRedirectPersistenceManager?: (resolver?: unknown) => Promise<unknown> };
  await internal.getOrInitRedirectPersistenceManager?.(browserPopupRedirectResolver);
  markRedirectPending();
  const currentUser = auth.currentUser;
  if (currentUser && currentUser.isAnonymous) {
    await linkWithRedirect(currentUser, googleProvider, browserPopupRedirectResolver);
  } else {
    await signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
  }
  return null;
}

/**
 * The Google account already exists: move the guest's own records into it before the switch completes
 * (records that already exist in the account are never overwritten). Used by both sign-in routes.
 */
async function mergeGuestIntoExistingAccount(error: unknown): Promise<User> {
  const credential = GoogleAuthProvider.credentialFromError(error as never);
  if (!credential) throw error;

  // Capture the guest's records before the account switch clears the store.
  const state = useStudyFlowStore.getState();
  const guestData = {
    assignments: withoutSample(state.assignments),
    sessions: withoutSample(state.sessions),
    grades: withoutSample(state.grades),
    notes: state.notes
  };
  mergeInProgress = true;
  let result: Awaited<ReturnType<typeof signInWithCredential>>;
  try {
    result = await signInWithCredential(auth, credential);
  } catch (err) {
    mergeInProgress = false; // nothing has changed yet: the guest copy is still on screen
    throw err;
  }
  // The account has switched and the on-screen guest copy is about to clear, so keep the records safe first.
  savePendingMerge({ uid: result.user.uid, ...guestData });
  try {
    bindUser(result.user);
    await mergeGuestDataIntoAccount(result.user.uid, guestData);
  } catch {
    mergeInProgress = false;
    // Do not wipe or reload. The records wait on this device and are retried the next time the app opens.
    throw new AuthGuidanceError('auth/merge-failed', 'Could not move the guest records yet.');
  }
  mergeInProgress = false;
  clearPendingMerge();
  // The guest's records are now in the account; remove the guest copy from this device.
  void wipeAndReload();
  return result.user;
}

/**
 * Runs when the page loads: if the student has just come back from Google (the same-tab sign-in),
 * finish signing them in. Quiet when they have not.
 */
export async function completeRedirectSignIn(): Promise<void> {
  try {
    const result = await redirectResultOnce();
    if (result) {
      takeRedirectPending();
      bindUser(result.user);
      return;
    }
    if (takeRedirectPending()) {
      postAuthNotice(
        'Google sign-in did not finish in this browser. If you use an ad blocker or strict privacy settings, pause it for this site and try again, or open StudyFlow in another browser.'
      );
    }
  } catch (error: unknown) {
    takeRedirectPending();
    try {
      if ((error as { code?: string })?.code === 'auth/credential-already-in-use') {
        await mergeGuestIntoExistingAccount(error);
        return;
      }
      throw error;
    } catch (err) {
      const message = friendlyAuthMessage(err);
      if (message) postAuthNotice(message);
    }
  }
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
