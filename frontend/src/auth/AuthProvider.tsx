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
  updateProfile,
  updatePassword,
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
import SplashScreen from '@/components/SplashScreen';
import { SplashProvider, useSplash } from '@/context/SplashContext';

// User type that works for both real and mock auth
export type AuthUser = FirebaseUser | MockUser | null;

export interface AuthContextType {
  currentUser: AuthUser;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  updateUserProfile: (name: string) => Promise<void>;
  updateUserPassword: (password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
  isAuthenticated: boolean;
  isMockMode: boolean;
  isAdmin: boolean;
}

// Create the context with undefined as initial value
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContent: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { addTask, removeTask } = useSplash();

  useEffect(() => {
    addTask('auth-init');
    let unsubscribe: (() => void) | undefined;

    const finishLoading = () => {
      setLoading(false);
      removeTask('auth-init');
    };

    if (isUsingMockAuth) {
      // Use mock authentication
      unsubscribe = mockOnAuthStateChanged((user) => {
        setCurrentUser(user);
        finishLoading();
      });
    } else if (auth) {
      // Use real Firebase authentication
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        setCurrentUser(user);
        
        if (user) {
          try {
            const tokenResult = await user.getIdTokenResult();
            setIsAdmin(!!tokenResult.claims.admin);
          } catch (error) {
            console.error("Error fetching ID token result:", error);
            setIsAdmin(false);
          }
        } else {
          setIsAdmin(false);
        }

        finishLoading();
      });
    } else {
      // Fallback: no auth available
      finishLoading();
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [addTask, removeTask]);

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
  const signUpWithEmail = async (email: string, password: string, name: string): Promise<void> => {
    try {
      if (isUsingMockAuth) {
        // For mock, sign up is same as sign in (creates user if not exists in our simple mock logic)
        await mockSignInWithEmailAndPassword(email, password);
      } else if (auth) {
        const userCredential = await firebaseCreateUserWithEmail(auth, email, password);
        
        // Update profile with name
        await updateProfile(userCredential.user, {
          displayName: name
        });

        // Force reload user to get updated profile
        await userCredential.user.reload();
        const updatedUser = auth.currentUser;

        if (updatedUser) {
          await createUserProfile(updatedUser);
        }
      } else {
        throw new Error('No authentication service available');
      }
    } catch (error) {
      throw error;
    }
  };

  /**
   * Update user profile (name)
   */
  const updateUserProfile = async (name: string): Promise<void> => {
    try {
      if (auth && auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: name
        });
        
        // Force reload and sync with backend
        await auth.currentUser.reload();
        const updatedUser = auth.currentUser;
        if (updatedUser) {
          await createUserProfile(updatedUser);
          setCurrentUser(updatedUser);
        }
      } else if (!isUsingMockAuth) {
        throw new Error('No user logged in');
      }
    } catch (error) {
      console.error('❌ Update profile failed:', error);
      throw error;
    }
  };

  /**
   * Update user password
   */
  const updateUserPassword = async (password: string): Promise<void> => {
    try {
      if (auth && auth.currentUser) {
        await updatePassword(auth.currentUser, password);
      } else if (!isUsingMockAuth) {
        throw new Error('No user logged in');
      }
    } catch (error) {
      console.error('❌ Update password failed:', error);
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
    updateUserProfile,
    updateUserPassword,
    signInWithGoogle,
    logout,
    getToken,
    isAuthenticated: !!currentUser,
    isMockMode: isUsingMockAuth,
    isAdmin,
  };

  return (
    <AuthContext.Provider value={value}>
      <SplashScreen />
      {children}
    </AuthContext.Provider>
  );
};

/**
 * AuthProvider Component
 * Wraps the application and provides authentication state and methods
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  return (
    <SplashProvider>
      <AuthContent>{children}</AuthContent>
    </SplashProvider>
  );
};

