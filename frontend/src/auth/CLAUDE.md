# Firebase Authentication Setup for Vite React App with Google & Email Login

This guide explains how to set up Firebase Authentication in a Vite React project deployed on Vercel, including Google and email/password login, token injection for backend requests, and backend verification using a Golang server on Cloud Run.

---

## 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Add a **Web App** to get Firebase config values.
3. Enable Authentication:

   * Navigate to **Build > Authentication > Sign-in method**.
   * Enable **Email/Password** and **Google** providers.
   * Add `localhost` and your Vercel domain to **Authorized Domains**.

---

## 2. Install and Configure Firebase in Vite React

### Install Firebase SDK:

```bash
npm install firebase
```

### Add Firebase Config to `.env`:

```env
VITE_FIREBASE_APIKEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### Initialize Firebase:

```js
// src/firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
```

---

## 3. Admin Login Page in React

### Component Setup:

```jsx
import { useState } from 'react';
import { auth, googleProvider } from './firebaseConfig';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';

function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Google sign-in failed:', err);
    }
  };

  return (
    <div>
      <h2>Admin Login</h2>
      <form onSubmit={handleEmailLogin}>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="submit">Login</button>
      </form>
      <button onClick={handleGoogleLogin}>Sign in with Google</button>
    </div>
  );
}
```

---

## 4. Firebase Token Handling

* Firebase issues an **ID Token** (~1 hour lifespan) and a **refresh token**.
* Call `auth.currentUser.getIdToken()` to get a valid token.
* Firebase handles automatic refresh under the hood.

```js
const token = await auth.currentUser.getIdToken();
```

---

## 5. Middleware to Inject Token in Fetch Requests

### Using Fetch:

```js
async function fetchWithAuth(url, options = {}) {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return fetch(url, options);
}
```

### Using Axios:

```js
import axios from 'axios';
import { auth } from './firebaseConfig';

axios.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

---

## 6. Verifying Token on Golang Backend (Cloud Run)

### Extract and Verify ID Token:

```go
authHeader := r.Header.Get("Authorization")
if authHeader == "" {
  http.Error(w, "Unauthorized", http.StatusUnauthorized)
  return
}
tokenString := strings.TrimPrefix(authHeader, "Bearer ")
tokenString = strings.TrimSpace(tokenString)

app, err := firebase.NewApp(ctx, nil)
authClient, err := app.Auth(ctx)
token, err := authClient.VerifyIDToken(ctx, tokenString)
if err != nil {
  http.Error(w, "Invalid token", http.StatusUnauthorized)
  return
}
uid := token.UID
```

---

## 7. Deployment Notes

* **Frontend:** Add `.env` variables to Vercel project settings.
* **Backend:** Use service account or Cloud Run service account identity for Firebase Admin SDK.
* **User Session:** Firebase handles persistence via `localStorage` by default.
* **Logout:** Call `auth.signOut()` to clear session.

---

## ✅ Summary

* 🔒 Secure login with Firebase Auth (Google + Email/Password).
* 🔄 Built-in token refresh support.
* 🚀 Token injection via middleware for backend API calls.
* 🛡️ Golang backend on Cloud Run verifies tokens using Admin SDK.

This setup ensures a robust, secure, and scalable admin interface.
