import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * AdminRoute Component
 *
 * Wraps a route that requires admin privileges.
 */
export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isAuthenticated, loading, isAdmin } = useAuth();
  const location = useLocation();
  const [showAccessDenied, setShowAccessDenied] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated && !isAdmin) {
      toast.error("Acesso negado. Privilégios de administrador necessários.");
      setShowAccessDenied(true);
    }
  }, [loading, isAuthenticated, isAdmin]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/entrar" state={{ from: location }} replace />;
  }

  // If authenticated but not admin
  if (showAccessDenied || !isAdmin) {
     return <Navigate to="/" replace />;
  }

  // User is authenticated and is admin
  return <>{children}</>;
};
