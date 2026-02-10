/**
 * Firebase Configuration
 *
 * This module initializes Firebase with configuration from environment variables.
 * It supports both real Firebase authentication and mock mode for testing.
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let googleProvider: GoogleAuthProvider;

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

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
  console.error("Error initializing Firebase:", error);
  throw error;
}

export { auth, db, googleProvider };
export const firebaseApp = app;
