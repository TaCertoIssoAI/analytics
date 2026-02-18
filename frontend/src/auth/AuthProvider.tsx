/**
 * Authentication Context and Provider
 *
 * This module provides authentication state management using React Context.
 * It supports real Firebase authentication.
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
  reauthenticateWithCredential,
  EmailAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider } from './firebaseConfig';
import { createUserProfile } from './userService';
import SplashScreen from '@/components/SplashScreen';
import { SplashProvider, useSplash } from '@/context/SplashContext';

// User type for real auth
export type AuthUser = FirebaseUser | null;

export interface AuthContextType {
  currentUser: AuthUser;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  updateUserProfile: (name: string) => Promise<void>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
  isAuthenticated: boolean;
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
    
    // Default to finish loading if auth is not initialized (error case)
    if (!auth) {
        console.error("Firebase Auth not initialized");
        setLoading(false);
        removeTask('auth-init');
        return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
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

        setLoading(false);
        removeTask('auth-init');
      });

    return () => unsubscribe();
  }, [addTask, removeTask]);

  /**
   * Sign in with email and password
   */
  const signInWithEmail = async (email: string, password: string): Promise<void> => {
    try {
      if (!auth) throw new Error('Auth not initialized');
      await firebaseSignInWithEmail(auth, email, password);
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
      if (!auth) throw new Error('Auth not initialized');
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
    } catch (error) {
      console.error('❌ Sign up failed:', error);
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
      } else {
        throw new Error('No user logged in');
      }
    } catch (error) {
      console.error('❌ Update profile failed:', error);
      throw error;
    }
  };

  /**
   * Update user password (re-authenticates first to satisfy Firebase)
   */
  const updateUserPassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    try {
      if (auth && auth.currentUser && auth.currentUser.email) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);
      } else {
        throw new Error('No user logged in');
      }
    } catch (error: any) {
      console.error('❌ Update password failed:', error);
      if (error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential') {
        throw new Error('Senha atual incorreta');
      }
      throw error;
    }
  };

  /**
   * Sign in with Google
   */
  const signInWithGoogle = async (): Promise<void> => {
    try {
      if (auth && googleProvider) {
        await firebaseSignInWithPopup(auth, googleProvider);
      } else {
        throw new Error('Auth or Google Provider not initialized');
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
      if (auth) {
        await firebaseSignOut(auth);
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
      return await currentUser.getIdToken();
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

