import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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
export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
