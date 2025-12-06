# Firebase Authentication Implementation

This directory contains a complete Firebase authentication implementation for the React-Vite application, with full support for **mock mode** testing.

## 📁 File Structure

```
src/auth/
├── firebaseConfig.ts      # Firebase initialization and configuration
├── mockFirebase.ts        # Mock authentication service for testing
├── AuthProvider.tsx       # React Context for auth state management
├── useAuth.ts            # Custom hook to access auth context
├── httpClient.ts         # HTTP client with automatic token injection
├── ProtectedRoute.tsx    # Route guard component
├── index.ts              # Central export point
├── CLAUDE.md             # Firebase setup documentation
└── README.md             # This file
```

## 🎭 Mock Mode vs Real Firebase

This implementation supports two modes:

### Mock Mode (Default)
- No real Firebase connection required
- Perfect for development and testing
- Console logging for all auth operations
- Simulated user database with test accounts

### Real Firebase Mode
- Connects to actual Firebase project
- Production-ready authentication
- Full Firebase feature support

## 🚀 Quick Start

### 1. Environment Setup

The project is currently configured for **mock mode**. Check your `.env` file:

```env
VITE_USE_MOCK_AUTH=true
VITE_FIREBASE_APIKEY=mock
```

### 2. Test Credentials (Mock Mode)

Use these credentials to test the login:

- **Email:** `admin@example.com` | **Password:** `admin123`
- **Email:** `test@example.com` | **Password:** `test123`

Google Sign-In will simulate a Google user login.

### 3. Access the Login Page

Navigate to `/login` in your browser to see the login page.

## 📖 Usage Examples

### Using Authentication in Components

```tsx
import { useAuth } from '@/auth';

function MyComponent() {
  const { currentUser, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <p>Please log in</p>;
  }

  return (
    <div>
      <p>Welcome, {currentUser.email}!</p>
      <button onClick={logout}>Sign Out</button>
    </div>
  );
}
```

### Protecting Routes

```tsx
import { ProtectedRoute } from '@/auth';
import AdminDashboard from './pages/AdminDashboard';

<Route
  path="/admin"
  element={
    <ProtectedRoute>
      <AdminDashboard />
    </ProtectedRoute>
  }
/>
```

### Making Authenticated API Requests

```tsx
import { fetchWithAuth, post } from '@/auth';

// Using fetchWithAuth
const response = await fetchWithAuth('/api/protected-data');
const data = await response.json();

// Using convenience methods
const result = await post('/api/create-item', {
  name: 'New Item',
  value: 123
});
```

## 🔐 Authentication Methods

### Email/Password Login

```tsx
const { signInWithEmail } = useAuth();

await signInWithEmail('user@example.com', 'password123');
```

### Google Sign-In

```tsx
const { signInWithGoogle } = useAuth();

await signInWithGoogle();
```

### Logout

```tsx
const { logout } = useAuth();

await logout();
```

### Get Authentication Token

```tsx
const { getToken } = useAuth();

const token = await getToken();
console.log('ID Token:', token);
```

## 🔧 Switching to Real Firebase

When you're ready to use real Firebase:

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Add a Web App
4. Enable Authentication (Email/Password and Google)

### 2. Update Environment Variables

Replace the values in your `.env` file:

```env
VITE_USE_MOCK_AUTH=false
VITE_FIREBASE_APIKEY=your-actual-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### 3. Restart Development Server

```bash
npm run dev
```

The system will automatically detect the real Firebase credentials and switch modes!

## 🧪 Testing Authentication

### Mock Mode Verification

All mock operations are logged to the console with these prefixes:

- 🔐 `[MOCK]` - Authentication operations
- 🎫 `[MOCK]` - Token generation
- 🚪 `[MOCK]` - Sign out operations
- 👂 `[MOCK]` - Auth state listeners

### Testing HTTP Requests

```tsx
import { fetchWithAuth } from '@/auth';

// This will log the token being used
const response = await fetchWithAuth('https://api.example.com/data');

// Check the console to see:
// 🌐 [HTTP] Making authenticated request...
//    URL: https://api.example.com/data
//    Method: GET
//    Has Token: true
//    Token Preview: eyJhbGci...
```

## 🛡️ Security Features

### Token Lifecycle Management

- Tokens are automatically injected into HTTP requests
- Firebase handles token refresh automatically
- Tokens expire after ~1 hour (handled by Firebase)
- Mock tokens simulate the same behavior

### Protected Routes

- Unauthenticated users are redirected to login
- Original destination is saved for post-login redirect
- Loading states handled gracefully

### Auth State Persistence

- Firebase uses localStorage for session persistence
- Mock mode simulates the same behavior
- Users remain logged in across page refreshes

## 📱 HTTP Client Features

The `httpClient.ts` module provides:

### fetchWithAuth

```tsx
const response = await fetchWithAuth('/api/endpoint', {
  method: 'POST',
  body: JSON.stringify({ data: 'value' })
});
```

### Convenience Methods

```tsx
import { get, post, put, patch, del } from '@/auth';

await get('/api/items');
await post('/api/items', { name: 'New Item' });
await put('/api/items/1', { name: 'Updated' });
await patch('/api/items/1', { status: 'active' });
await del('/api/items/1');
```

### Axios Integration

If you're using axios, you can create an interceptor:

```tsx
import axios from 'axios';
import { getAuthToken } from '@/auth';

axios.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## 🐛 Troubleshooting

### Login Not Working

1. Check console logs for detailed error messages
2. Verify you're using correct test credentials in mock mode
3. Ensure `.env` file is properly configured

### Token Not Injected

1. Check that you're using `fetchWithAuth` or the HTTP client methods
2. Verify the user is authenticated before making requests
3. Check console logs for token generation messages

### Protected Route Not Working

1. Ensure route is wrapped with `<ProtectedRoute>`
2. Check that `AuthProvider` is in your app hierarchy
3. Verify authentication state in React DevTools

## 📚 Additional Resources

- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Firebase Console](https://console.firebase.google.com/)
- Original setup guide: `CLAUDE.md` in this directory

## 🎉 Features Summary

✅ Email/Password authentication
✅ Google social login
✅ Mock mode for testing
✅ Automatic token injection
✅ Protected routes
✅ Auth state management
✅ Token lifecycle handling
✅ Session persistence
✅ Console logging for debugging
✅ TypeScript support
✅ Full documentation

---

**Note:** This implementation is production-ready but currently configured for mock testing. Switch to real Firebase when you're ready to deploy!
