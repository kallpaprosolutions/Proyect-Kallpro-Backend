import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index';
import { defineAbilitiesFor } from '../auth/abilities';
import { Action, Subject } from '../auth/roles';
import { logger } from '../lib/logger';

/**
 * Middleware de autorización basado en CASL.
 *
 * Uso: router.post('/pay', authorize('pay', 'Purchase'), ctrl.payAdvancePO)
 *
 * ADMIN (manage all) siempre pasa. Si el rol no tiene el permiso → 403.
 * Respeta RBAC_ENFORCE=false para modo desarrollo (solo advierte, no bloquea).
 */
export function authorize(action: Action, subject: Subject) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role || 'USER';
    const ability = defineAbilitiesFor(role);

    if (ability.can(action, subject)) {
      next();
      return;
    }

    if (process.env.RBAC_ENFORCE === 'false') {
      logger.warn(`[RBAC:DEV] "${role}" sin permiso ${action}:${subject} — ${req.method} ${req.path}`);
      next();
      return;
    }

    res.status(403).json({
      error: 'No tienes permisos para esta acción',
      required: `${action}:${subject}`,
      role,
    });
  };
}
