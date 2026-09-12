import { useAuthStore } from '../store/auth.store';
import { checkPermission, AppRole } from '../lib/permissions';

/**
 * Hook RBAC — KallpaPro
 *
 * Uso:
 *   const { role, can, isRole } = useRole();
 *   can('inventory', 'edit')          → boolean
 *   isRole('ADMIN', 'JEFE_BODEGA')    → boolean
 */
export function useRole() {
  const user = useAuthStore((s) => s.user);
  const role: string = (user as any)?.role || 'USER';

  /** Verifica permiso para módulo + acción */
  const can = (module: string, action: string): boolean =>
    checkPermission(role, module, action);

  /** Verifica si el usuario tiene uno de los roles dados */
  const isRole = (...roles: AppRole[]): boolean =>
    roles.includes(role as AppRole);

  return { role, can, isRole };
}
