import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { useRole } from '../hooks/useRole';
import { AppRole } from '../lib/permissions';

interface RoleProtectedRouteProps {
  /** Roles que pueden acceder a esta ruta */
  roles: AppRole[];
  /** Componente a renderizar si el rol es válido */
  children: ReactNode;
  /** Ruta de redirección si no tiene permiso (default: "/") */
  redirectTo?: string;
}

/**
 * Protege una ruta completa según el rol del usuario.
 *
 * Ejemplo en App.tsx:
 *   <Route path="/admin/users" element={
 *     <RoleProtectedRoute roles={['ADMIN']}>
 *       <UsersPage />
 *     </RoleProtectedRoute>
 *   } />
 */
export default function RoleProtectedRoute({
  roles,
  children,
  redirectTo = '/',
}: RoleProtectedRouteProps) {
  const { isRole } = useRole();

  if (!isRole(...roles)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
