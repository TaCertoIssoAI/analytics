# Firebase Authentication Implementation

This directory contains the Firebase authentication implementation for the React-Vite application.

## 📁 File Structure

```
src/auth/
├── firebaseConfig.ts      # Firebase initialization and configuration
├── AuthProvider.tsx       # React Context for auth state management
├── useAuth.ts            # Custom hook to access auth context
├── httpClient.ts         # HTTP client with automatic token injection
├── ProtectedRoute.tsx    # Route guard component
├── index.ts              # Central export point
├── CLAUDE.md             # Firebase setup documentation
└── README.md             # This file
```

## 🚀 Setup

### Environment Variables

Ensure your `.env` file has the following Firebase configuration:

```env
VITE_FIREBASE_APIKEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

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

The `httpClient.ts` module provides functions that automatically inject the Firebase ID token into requests.

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
