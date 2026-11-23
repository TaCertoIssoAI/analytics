/**
 * Client-side Mock Authentication for offline/demo mode.
 *
 * Completely decouples the app from Firebase Auth servers when IS_MOCK_MODE
 * is active, while exposing a Firebase `User`-compatible interface and
 * persisting the optional demo session in localStorage.
 */

export interface MockAuthSession {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: "admin" | "user";
  createdAt: number;
}

export interface MockFirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  providerData: Array<{ providerId: string }>;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
  getIdTokenResult: (forceRefresh?: boolean) => Promise<{
    token: string;
    claims: Record<string, unknown>;
  }>;
}

const SESSION_STORAGE_KEY = "tcia_mock_auth_session_v1";

export const DEMO_ACCOUNTS: Record<"reviewer" | "admin", MockAuthSession> = {
  reviewer: {
    uid: "demo-reviewer",
    email: "revisor.demo@tacertoissoai.com.br",
    displayName: "Revisor Demo",
    photoURL: null,
    role: "user",
    createdAt: 1764547200000,
  },
  admin: {
    uid: "demo-admin",
    email: "admin.demo@tacertoissoai.com.br",
    displayName: "Admin Demo",
    photoURL: null,
    role: "admin",
    createdAt: 1764547200000,
  },
};

type AuthListener = (user: MockFirebaseUser | null) => void;
const listeners = new Set<AuthListener>();

function buildMockFirebaseUser(session: MockAuthSession): MockFirebaseUser {
  const token = `mock-token:${session.uid}:${session.role}`;
  return {
    uid: session.uid,
    email: session.email,
    displayName: session.displayName,
    photoURL: session.photoURL,
    emailVerified: true,
    isAnonymous: false,
    providerData: [{ providerId: "password" }],
    getIdToken: async () => token,
    getIdTokenResult: async () => ({
      token,
      claims: {
        admin: session.role === "admin",
        role: session.role,
      },
    }),
  };
}

export function getStoredMockSession(): MockAuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MockAuthSession;
  } catch {
    return null;
  }
}

export function getCurrentMockUser(): MockFirebaseUser | null {
  const session = getStoredMockSession();
  return session ? buildMockFirebaseUser(session) : null;
}

function saveSession(session: MockAuthSession | null): void {
  try {
    if (session) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
  const user = session ? buildMockFirebaseUser(session) : null;
  listeners.forEach((cb) => cb(user));
}

export function subscribeMockAuth(listener: AuthListener): () => void {
  listeners.add(listener);
  // Emit current state asynchronously like Firebase onAuthStateChanged
  queueMicrotask(() => {
    listener(getCurrentMockUser());
  });
  return () => {
    listeners.delete(listener);
  };
}

function deterministicUidFromEmail(email: string): string {
  const clean = email.trim().toLowerCase();
  if (clean === DEMO_ACCOUNTS.admin.email) return DEMO_ACCOUNTS.admin.uid;
  if (clean === DEMO_ACCOUNTS.reviewer.email) return DEMO_ACCOUNTS.reviewer.uid;
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) | 0;
  }
  return `demo-${Math.abs(hash).toString(36)}`;
}

export async function mockSignIn(email: string, _password: string): Promise<MockFirebaseUser> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    throw new Error("Informe um e-mail válido.");
  }

  let session: MockAuthSession;
  if (normalized === DEMO_ACCOUNTS.admin.email) {
    session = { ...DEMO_ACCOUNTS.admin };
  } else if (normalized === DEMO_ACCOUNTS.reviewer.email) {
    session = { ...DEMO_ACCOUNTS.reviewer };
  } else {
    const isAdmin = normalized.includes("admin");
    const namePart = normalized.split("@")[0].replace(/[._-]+/g, " ");
    const displayName = namePart
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    session = {
      uid: deterministicUidFromEmail(normalized),
      email: normalized,
      displayName: displayName || "Revisor Demo",
      photoURL: null,
      role: isAdmin ? "admin" : "user",
      createdAt: Date.now(),
    };
  }

  saveSession(session);
  return buildMockFirebaseUser(session);
}

export async function mockSignInDemo(kind: "reviewer" | "admin"): Promise<MockFirebaseUser> {
  const session = { ...DEMO_ACCOUNTS[kind] };
  saveSession(session);
  return buildMockFirebaseUser(session);
}

export async function mockSignUp(
  email: string,
  _password: string,
  displayName?: string
): Promise<MockFirebaseUser> {
  const normalized = email.trim().toLowerCase();
  const session: MockAuthSession = {
    uid: deterministicUidFromEmail(normalized),
    email: normalized,
    displayName: displayName?.trim() || "Novo Revisor",
    photoURL: null,
    role: "user",
    createdAt: Date.now(),
  };
  saveSession(session);
  return buildMockFirebaseUser(session);
}

export async function mockSignOut(): Promise<void> {
  saveSession(null);
}

export async function mockUpdateAuthProfile(displayName: string, photoURL?: string): Promise<void> {
  const current = getStoredMockSession();
  if (!current) return;
  const updated: MockAuthSession = {
    ...current,
    displayName,
    ...(photoURL !== undefined ? { photoURL } : {}),
  };
  saveSession(updated);
}

export function extractUidFromAuthHeader(authHeader: string | null): {
  uid: string;
  role: "admin" | "user";
} | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const session = getStoredMockSession();
    return session ? { uid: session.uid, role: session.role } : null;
  }
  const token = authHeader.slice(7).trim();
  if (token.startsWith("mock-token:")) {
    const parts = token.split(":");
    return {
      uid: parts[1] || "demo-reviewer",
      role: parts[2] === "admin" ? "admin" : "user",
    };
  }
  const session = getStoredMockSession();
  return session ? { uid: session.uid, role: session.role } : null;
}
