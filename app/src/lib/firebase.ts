import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  connectAuthEmulator,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  type Firestore
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCXhlM88LmNpQN75EGa-jUi8dxibXwpjqs',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'studyflow-app-8f038.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'studyflow-app-8f038',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'studyflow-app-8f038.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '592859578017',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:592859578017:web:02744c4db30125c355fae0',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-1R7TKY4TEG'
};

// Initialize Firebase App singleton
export const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with multi-tab offline persistence
export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Initialize Authentication & Providers
// No popup resolver here: it would load Google's api.js on every page view. It is passed when the
// student actually clicks sign-in (see lib/auth.ts).
export const auth: Auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]
});
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Test builds only: run against the local Auth and Firestore emulators.
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
