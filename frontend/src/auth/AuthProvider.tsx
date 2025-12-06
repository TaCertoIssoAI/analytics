/**
 * Authentication Context and Provider
 *
 * This module provides authentication state management using React Context.
 * It supports both real Firebase authentication and mock mode for testing.
 */

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import {
  signInWithEmailAndPassword as firebaseSignInWithEmail,
  createUserWithEmailAndPassword as firebaseCreateUserWithEmail,
  signInWithPopup as firebaseSignInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider, isUsingMockAuth } from './firebaseConfig';
import {
  mockSignInWithEmailAndPassword,
  mockSignInWithPopup,
  mockSignOut,
  mockGetIdToken,
  mockOnAuthStateChanged,
  getMockCurrentUser,
  MockUser,
} from './mockFirebase';
import { createUserProfile } from './userService';

// User type that works for both real and mock auth
export type AuthUser = FirebaseUser | MockUser | null;

export interface AuthContextType {
  currentUser: AuthUser;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
  isAuthenticated: boolean;
  isMockMode: boolean;
}

// Create the context with undefined as initial value
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider Component
 * Wraps the application and provides authentication state and methods
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (isUsingMockAuth) {
      // Use mock authentication
      unsubscribe = mockOnAuthStateChanged((user) => {
        setCurrentUser(user);
        setLoading(false);
      });
    } else if (auth) {
      // Use real Firebase authentication
      unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        setLoading(false);
      });
    } else {
      // Fallback: no auth available
      setLoading(false);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  /**
   * Sign in with email and password
   */
  const signInWithEmail = async (email: string, password: string): Promise<void> => {
    try {
      if (isUsingMockAuth) {
        await mockSignInWithEmailAndPassword(email, password);
      } else if (auth) {
        await firebaseSignInWithEmail(auth, email, password);
      } else {
        throw new Error('No authentication service available');
      }
    } catch (error) {
      console.error('❌ Sign in failed:', error);
      throw error;
    }
  };

  /**
   * Sign up with email and password
   */
  const signUpWithEmail = async (email: string, password: string): Promise<void> => {
    try {
      if (isUsingMockAuth) {
        // For mock, sign up is same as sign in (creates user if not exists in our simple mock logic)
        await mockSignInWithEmailAndPassword(email, password);
      } else if (auth) {
        const userCredential = await firebaseCreateUserWithEmail(auth, email, password);
        await createUserProfile(userCredential.user);
      } else {
        throw new Error('No authentication service available');
      }
    } catch (error) {
      console.error('❌ Sign up failed:', error);
      throw error;
    }
  };

  /**
   * Sign in with Google
   */
  const signInWithGoogle = async (): Promise<void> => {
    try {
      if (isUsingMockAuth) {
        await mockSignInWithPopup();
      } else if (auth && googleProvider) {
        await firebaseSignInWithPopup(auth, googleProvider);
      } else {
        throw new Error('No authentication service available');
      }
    } catch (error) {
      console.error('❌ Google sign in failed:', error);
      throw error;
    }
  };

  /**
   * Sign out the current user
   */
  const logout = async (): Promise<void> => {
    try {
      if (isUsingMockAuth) {
        await mockSignOut();
      } else if (auth) {
        await firebaseSignOut(auth);
      } else {
        throw new Error('No authentication service available');
      }
    } catch (error) {
      console.error('❌ Logout failed:', error);
      throw error;
    }
  };

  /**
   * Get the current user's ID token
   * Returns null if not authenticated
   */
  const getToken = async (): Promise<string | null> => {
    try {
      if (!currentUser) {
        return null;
      }

      if (isUsingMockAuth) {
        return await mockGetIdToken(currentUser as MockUser);
      } else if (currentUser && 'getIdToken' in currentUser) {
        return await (currentUser as FirebaseUser).getIdToken();
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to get token:', error);
      return null;
    }
  };

  const value: AuthContextType = {
    currentUser,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    logout,
    getToken,
    isAuthenticated: !!currentUser,
    isMockMode: isUsingMockAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
