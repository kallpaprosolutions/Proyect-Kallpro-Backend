import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger';
import { requestContext } from '../lib/request-context';

/**
 * Log de cada request (Sprint 2.2 · paso 2) + Correlation ID (Sprint 2.3).
 *
 * - Genera (o reutiliza el header entrante) un `requestId`, lo expone en `X-Request-Id`
 *   y lo guarda en AsyncLocalStorage para que TODOS los logs de la request lo incluyan.
 * - Registra al cerrar la respuesta ('finish'): método, ruta, código, duración, usuario, IP.
 *   Nivel según el código: >=500 error, >=400 warn, resto info.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  res.setHeader('X-Request-Id', requestId);
  (req as any).requestId = requestId;

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const meta = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      userId: (req as any).user?.userId ?? (req as any).user?.id,
      companyId: (req as any).user?.companyId,
      ip: req.ip,
    };

    const msg = `${req.method} ${req.originalUrl} ${res.statusCode} ${meta.durationMs}ms`;
    if (res.statusCode >= 500) logger.error(msg, meta);
    else if (res.statusCode >= 400) logger.warn(msg, meta);
    else logger.info(msg, meta);
  });

  // El resto de la cadena corre dentro del contexto → el logger inyecta requestId solo.
  requestContext.run({ requestId }, () => next());
}
