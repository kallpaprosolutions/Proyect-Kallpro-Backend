import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index';
import { logger } from '../lib/logger';

/**
 * RBAC Middleware — Capa 3 KallpaPro
 *
 * Dev mode  (RBAC_ENFORCE=false): emite logger.warn, NO bloquea
 * Prod mode (RBAC_ENFORCE=true):  retorna 403 si el rol no está permitido
 */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role || 'USER';

    if (!roles.includes(userRole)) {
      if (process.env.RBAC_ENFORCE === 'true') {
        res.status(403).json({
          error: 'No tienes permisos para esta acción',
          required: roles,
          current: userRole,
        });
        return;
      }
      logger.warn(
        `[RBAC:DEV] Rol "${userRole}" accediendo a ruta que requiere: [${roles.join(', ')}] — PATH: ${req.method} ${req.path}`,
      );
    }

    next();
  };
}
