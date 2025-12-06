/**
 * AuthSwitch Component
 *
 * A reusable component that renders different content based on authentication state.
 * This makes it easy to show/hide elements depending on whether the user is logged in.
 */

import { ReactNode } from 'react';
import { useAuth } from './useAuth';

interface AuthSwitchProps {
  /** Content to show when user is logged in */
  authenticated: ReactNode;
  /** Content to show when user is logged out */
  unauthenticated: ReactNode;
  /** Optional: Show loading state while checking auth */
  loading?: ReactNode;
}

/**
 * Conditionally renders content based on authentication state
 *
 * @example
 * ```tsx
 * <AuthSwitch
 *   authenticated={<button>Logout</button>}
 *   unauthenticated={<button>Login</button>}
 * />
 * ```
 */
export const AuthSwitch: React.FC<AuthSwitchProps> = ({
  authenticated,
  unauthenticated,
  loading,
}) => {
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Show loading state while checking authentication
  if (authLoading && loading) {
    return <>{loading}</>;
  }

  // Return appropriate content based on auth state
  return <>{isAuthenticated ? authenticated : unauthenticated}</>;
};

interface ShowWhenProps {
  children: ReactNode;
}

/**
 * Shows children only when user is authenticated
 *
 * @example
 * ```tsx
 * <ShowWhenAuthenticated>
 *   <button>Admin Panel</button>
 * </ShowWhenAuthenticated>
 * ```
 */
export const ShowWhenAuthenticated: React.FC<ShowWhenProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : null;
};

/**
 * Shows children only when user is NOT authenticated
 *
 * @example
 * ```tsx
 * <ShowWhenUnauthenticated>
 *   <button>Sign Up Now</button>
 * </ShowWhenUnauthenticated>
 * ```
 */
export const ShowWhenUnauthenticated: React.FC<ShowWhenProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return !isAuthenticated ? <>{children}</> : null;
};
