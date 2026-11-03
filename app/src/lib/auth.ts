import {
  signInAnonymously,
  signInWithPopup,
  linkWithPopup,
  signOut as firebaseSignOut,
  type User
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { unsubscribeAllFirestoreSync } from '../services/firestoreSync';

const authBroadcast = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('studyflow_auth_channel')
  : null;

if (authBroadcast) {
  authBroadcast.onmessage = (event) => {
    if (event.data === 'signout') {
      localStorage.removeItem('studyflow_storage_v1');
      window.location.reload();
    }
  };
}

let authInFlightPromise: Promise<User> | null = null;

/**
 * Ensures an active user session exists without prompting for credentials.
 * If no session is active, provisions a fast anonymous guest session.
 * Protects against multi-tab race conditions via an in-flight promise.
 */
export async function ensureAuthenticatedUser(): Promise<User> {
  await auth.authStateReady();
  if (auth.currentUser) {
    return auth.currentUser;
  }
  
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

/**
 * Checks whether current user is an unlinked anonymous guest.
 */
export function isAnonymousUser(): boolean {
  return !!auth.currentUser?.isAnonymous;
}

/**
 * Upgrades current anonymous guest account to a persistent Google account,
 * or signs into an existing Google account without losing student data.
 */
export async function signInOrLinkWithGoogle(): Promise<User> {
  const currentUser = auth.currentUser;

  if (currentUser && currentUser.isAnonymous) {
    try {
      // Seamlessly upgrade guest to Google account with data preserved
      const result = await linkWithPopup(currentUser, googleProvider);
      return result.user;
    } catch (error: any) {
      if (error?.code === 'auth/credential-already-in-use') {
        // The Google account already has an existing profile; sign in directly
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
      }
      throw error;
    }
  }

  // Direct Google Sign-In
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}


/**
 * Signs out the current user, broadcasts the event to all active tabs,
 * purges in-memory and local session state, and initializes clean guest session.
 */
export async function signOutUser(): Promise<void> {
  if (authBroadcast) {
    authBroadcast.postMessage('signout');
  }
  unsubscribeAllFirestoreSync();
  await firebaseSignOut(auth);
  localStorage.removeItem('studyflow_storage_v1');
  useStudyFlowStore.getState().resetStore();
  await ensureAuthenticatedUser();
}
