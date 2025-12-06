/**
 * Authentication Module Exports
 *
 * Central export point for all authentication-related functionality.
 * Import from this file to access auth services throughout your app.
 */

// Core authentication
export { AuthProvider } from './AuthProvider';
export type { AuthContextType, AuthUser } from './AuthProvider';
export { useAuth } from './useAuth';

// Route protection
export { ProtectedRoute } from './ProtectedRoute';

// Conditional rendering based on auth state
export { AuthSwitch, ShowWhenAuthenticated, ShowWhenUnauthenticated } from './AuthSwitch';

// HTTP client with auth
export {
  fetchWithAuth,
  getAuthToken,
  get,
  post,
  put,
  patch,
  del,
  createAuthInterceptor,
} from './httpClient';
export type { HttpMethod } from './httpClient';

// Firebase configuration
export { auth, googleProvider, firebaseApp, isUsingMockAuth } from './firebaseConfig';

// Mock services (for testing)
export {
  mockSignInWithEmailAndPassword,
  mockSignInWithPopup,
  mockSignOut,
  mockGetIdToken,
  mockOnAuthStateChanged,
  getMockCurrentUser,
  isMockMode,
} from './mockFirebase';
export type { MockUser, MockUserCredential } from './mockFirebase';

// Token utilities
export {
  decodeJWT,
  getTokenExpiration,
  isTokenExpired,
  getTimeUntilExpiration,
  logTokenDetails,
} from './tokenUtils';
