import { ReactNode } from 'react';
import { useRole } from '../hooks/useRole';

interface RoleGateProps {
  /** Módulo del mapa de permisos (ej: "inventory") */
  module: string;
  /** Acción del módulo (ej: "edit") */
  action: string;
  /** Contenido a mostrar si el rol tiene permiso */
  children: ReactNode;
  /** Fallback opcional si NO tiene permiso (por defecto no muestra nada) */
  fallback?: ReactNode;
}

/**
 * Muestra `children` solo si el usuario actual tiene el permiso
 * correspondiente al módulo + acción.
 *
 * Ejemplo:
 *   <RoleGate module="inventory" action="edit">
 *     <button>Editar Bodega</button>
 *   </RoleGate>
 */
export default function RoleGate({ module, action, children, fallback = null }: RoleGateProps) {
  const { can } = useRole();
  return can(module, action) ? <>{children}</> : <>{fallback}</>;
}
