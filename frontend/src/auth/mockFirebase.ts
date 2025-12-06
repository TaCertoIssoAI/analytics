/**
 * Mock Firebase Service for Testing
 *
 * This module provides mock implementations of Firebase authentication
 * functions to enable testing without a real Firebase connection.
 * All operations are logged to the console for verification.
 */

export interface MockUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerId: string;
}

export interface MockUserCredential {
  user: MockUser;
}

// Simulated user database for mock authentication
const MOCK_USERS = [
  {
    email: 'admin@example.com',
    password: 'admin123',
    uid: 'mock-uid-admin-001',
    displayName: 'Admin User',
    photoURL: 'https://via.placeholder.com/150',
    providerId: 'password'
  },
  {
    email: 'test@example.com',
    password: 'test123',
    uid: 'mock-uid-test-001',
    displayName: 'Test User',
    photoURL: 'https://via.placeholder.com/150',
    providerId: 'password'
  }
];

// Storage key for persisting mock auth state
const MOCK_AUTH_STORAGE_KEY = 'mockFirebaseAuth';

/**
 * Get the current mock user from localStorage
 */
export const getMockCurrentUser = (): MockUser | null => {
  const stored = localStorage.getItem(MOCK_AUTH_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Set the current mock user in localStorage
 */
const setMockCurrentUser = (user: MockUser | null) => {
  if (user) {
    localStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(MOCK_AUTH_STORAGE_KEY);
  }
};

/**
 * Mock implementation of signInWithEmailAndPassword
 * Simulates Firebase email/password authentication
 */
export const mockSignInWithEmailAndPassword = async (
  email: string,
  password: string
): Promise<MockUserCredential> => {
  console.log('🔐 [MOCK] Attempting email/password login...');
  console.log('   Email:', email);
  console.log('   Password:', '*'.repeat(password.length));

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Find user in mock database
  const user = MOCK_USERS.find(u => u.email === email && u.password === password);

  if (!user) {
    console.error('❌ [MOCK] Login failed: Invalid credentials');
    throw new Error('auth/invalid-credential');
  }

  const mockUser: MockUser = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    providerId: user.providerId
  };

  setMockCurrentUser(mockUser);

  console.log('✅ [MOCK] Login successful!');
  console.log('   User ID:', mockUser.uid);
  console.log('   Display Name:', mockUser.displayName);

  return { user: mockUser };
};

/**
 * Mock implementation of signInWithPopup (Google Sign-In)
 * Simulates Firebase Google authentication
 */
export const mockSignInWithPopup = async (): Promise<MockUserCredential> => {
  console.log('🔐 [MOCK] Attempting Google Sign-In...');

  // Simulate popup delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  const mockUser: MockUser = {
    uid: 'mock-uid-google-001',
    email: 'googleuser@gmail.com',
    displayName: 'Google User',
    photoURL: 'https://via.placeholder.com/150',
    providerId: 'google.com'
  };

  setMockCurrentUser(mockUser);

  console.log('✅ [MOCK] Google Sign-In successful!');
  console.log('   User ID:', mockUser.uid);
  console.log('   Display Name:', mockUser.displayName);
  console.log('   Provider:', mockUser.providerId);

  return { user: mockUser };
};

/**
 * Mock implementation of signOut
 * Simulates Firebase sign out
 */
export const mockSignOut = async (): Promise<void> => {
  console.log('🚪 [MOCK] Signing out...');

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  setMockCurrentUser(null);

  console.log('✅ [MOCK] Sign out successful!');
};

/**
 * Mock implementation of getIdToken
 * Generates a fake JWT token for testing
 */
export const mockGetIdToken = async (user: MockUser): Promise<string> => {
  console.log('🎫 [MOCK] Generating ID token...');
  console.log('   User ID:', user.uid);

  // Simulate token generation delay
  await new Promise(resolve => setTimeout(resolve, 300));

  // Generate a fake JWT-like token
  const header = btoa(JSON.stringify({ alg: 'MOCK', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    uid: user.uid,
    email: user.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
  }));
  const signature = btoa('mock-signature');

  const token = `${header}.${payload}.${signature}`;

  console.log('✅ [MOCK] Token generated!');
  console.log('   Full Token:', token);
  console.log('   Token Length:', token.length);

  return token;
};

/**
 * Mock implementation of onAuthStateChanged
 * Simulates Firebase auth state observer
 */
export const mockOnAuthStateChanged = (callback: (user: MockUser | null) => void): (() => void) => {
  console.log('👂 [MOCK] Auth state listener registered');

  // Immediately call with current user
  const currentUser = getMockCurrentUser();
  setTimeout(() => callback(currentUser), 0);

  // Return unsubscribe function
  return () => {
    console.log('👋 [MOCK] Auth state listener unregistered');
  };
};

/**
 * Check if mock mode is enabled
 * Based on environment variable
 */
export const isMockMode = (): boolean => {
  return import.meta.env.VITE_USE_MOCK_AUTH === 'true' ||
    import.meta.env.VITE_FIREBASE_APIKEY === 'mock';
};

console.log('📦 [MOCK] Mock Firebase service loaded');
