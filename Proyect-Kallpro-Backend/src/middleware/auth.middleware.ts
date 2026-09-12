import { Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.service';
import { prisma } from '../lib/prisma';
import { getErpConfig } from '../services/erp-config.service';
import { AuthRequest } from '../types/index';

// Re-exportado para los controladores que tipan sus handlers con AuthRequest
// importándolo desde el middleware (en vez de desde types/index).
export type { AuthRequest } from '../types/index';

// Solo escribimos lastActivityAt/expiresAt cada 2 min para no golpear la BD en cada
// request (mejora DeepSeek #3). Menos de eso, la sesión se considera válida sin tocar BD.
const ACTIVITY_THROTTLE_MS = 2 * 60 * 1000;

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  req.user = payload;

  // Validación de la SESIÓN concreta (jti). Tokens emitidos antes de las sesiones (sin
  // sessionId) siguen funcionando hasta expirar, por compatibilidad.
  if (payload.sessionId) {
    const session = await prisma.userSession.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.revokedAt || session.userId !== payload.userId) {
      res.status(401).json({ error: 'SESSION_REVOKED' });
      return;
    }
    const now = Date.now();
    // expiresAt funciona como deadline de inactividad (se desliza con la actividad).
    if (session.expiresAt.getTime() < now) {
      res.status(401).json({ error: 'SESSION_EXPIRED' });
      return;
    }
    if (now - session.lastActivityAt.getTime() > ACTIVITY_THROTTLE_MS) {
      try {
        const cfg = await getErpConfig(payload.companyId);
        const newExpiry = new Date(now + cfg.security.sessionTimeoutMinutes * 60 * 1000);
        // updateMany condicional → atómico: ante requests concurrentes solo uno actualiza
        // (los demás no matchean porque lastActivityAt ya avanzó). Evita escrituras redundantes.
        await prisma.userSession.updateMany({
          where: { id: session.id, lastActivityAt: { lt: new Date(now - ACTIVITY_THROTTLE_MS) } },
          data: { lastActivityAt: new Date(now), expiresAt: newExpiry },
        });
      } catch { /* no-fatal: no romper la request por un fallo al refrescar actividad */ }
    }
  }

  next();
}
