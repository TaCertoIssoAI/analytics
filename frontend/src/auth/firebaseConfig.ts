/**
 * Firebase Configuration
 *
 * This module initializes Firebase with configuration from environment variables.
 * It supports both real Firebase authentication and mock mode for testing.
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { isMockMode } from './mockFirebase';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if we're in mock mode
const useMockAuth = isMockMode();

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;

// Initialize Firebase only if not in mock mode
if (!useMockAuth) {
  // Validate that all required config values are present
  const missingConfig = Object.entries(firebaseConfig)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingConfig.length > 0) {
  } else {
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app, 'tacertoissoai');
      googleProvider = new GoogleAuthProvider();

      // Optional: Configure Google provider
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });

    } catch (error) {
    }
  }
}

// Export the initialized instances
// These will be null in mock mode, which is handled by the auth service layer
export { auth, db, googleProvider };
export const firebaseApp = app;

// Export a flag to check if we're using mock mode
export const isUsingMockAuth = useMockAuth || !auth;
