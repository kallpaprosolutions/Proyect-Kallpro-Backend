import { AuthPayload } from './index';

// Augmentación global del Request de Express: expone `req.user` (poblado por
// authMiddleware) en TODOS los handlers, incluso los que usan el tipo `Request`
// estándar en vez de `AuthRequest`.
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export {};
