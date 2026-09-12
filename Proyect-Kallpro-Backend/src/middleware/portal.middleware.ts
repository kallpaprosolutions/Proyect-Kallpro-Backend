import { Request, Response, NextFunction } from 'express';
import { verifyPortalToken, PortalPayload } from '../services/portal.service';

export interface PortalRequest extends Request {
  supplier?: PortalPayload;
}

export function portalAuthMiddleware(req: PortalRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de portal requerido' });
    return;
  }
  try {
    const payload = verifyPortalToken(auth.split(' ')[1]);
    if (payload.type !== 'PORTAL') {
      res.status(401).json({ error: 'Token inválido' });
      return;
    }
    req.supplier = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token de portal inválido o expirado' });
  }
}
