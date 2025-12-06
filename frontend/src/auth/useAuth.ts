/**
 * useAuth Hook
 *
 * Custom React hook for accessing authentication context.
 * Provides a convenient way to consume auth state and methods throughout the app.
 */

import { useContext } from 'react';
import { AuthContext, AuthContextType } from './AuthProvider';

/**
 * Hook to access authentication context
 *
 * @throws {Error} If used outside of AuthProvider
 * @returns {AuthContextType} Authentication context value
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { currentUser, signInWithEmail, logout } = useAuth();
 *
 *   if (!currentUser) {
 *     return <button onClick={() => signInWithEmail('user@example.com', 'password')}>
 *       Sign In
 *     </button>;
 *   }
 *
 *   return <button onClick={logout}>Sign Out</button>;
 * }
 * ```
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
