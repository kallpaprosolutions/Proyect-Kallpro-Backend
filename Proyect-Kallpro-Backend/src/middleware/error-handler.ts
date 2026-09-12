import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, LEGACY_ERROR_CODES } from '../utils/errors';
import { logger } from '../lib/logger';

/**
 * Manejo de errores centralizado (Sprint 2.2).
 *
 * Hoy cada controlador hace `try/catch` y responde 500 a mano; además NO existe un
 * middleware de errores global, así que un `throw` en un handler async sin `try/catch`
 * deja la request colgada. Este middleware cierra ese hueco y unifica el contrato de error.
 *
 * Orden de resolución:
 *   1. AppError            → su statusCode + code.
 *   2. ZodError            → 422 con el detalle de validación.
 *   3. Error con message en LEGACY_ERROR_CODES → status mapeado (red de seguridad).
 *   4. Cualquier otro      → 500 genérico (sin filtrar detalles internos en producción).
 *
 * Contrato de respuesta (retrocompatible): { error, message, code, details? }.
 */

/**
 * Envuelve un handler async para que cualquier rechazo llegue al errorHandler vía next().
 * Genérico sobre el tipo de request (p.ej. AuthRequest) para no exigir casts en cada controlador.
 */
export const asyncHandler =
  <Req extends Request = Request>(
    fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req as Req, res, next)).catch(next);

/** 404 para rutas no registradas. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Recurso no encontrado', message: 'Recurso no encontrado', code: 'NOT_FOUND' });
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  // Si ya se empezó a enviar la respuesta, delegar al manejador por defecto de Express.
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      message: err.message,
      code: err.code,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    // 400 para alinear con la convención del resto de la app (controladores usan
    // safeParse → AppError.badRequest 'VALIDATION_ERROR'). Lo emite validateSchema.
    res.status(400).json({
      error: 'Datos inválidos',
      message: 'Datos inválidos',
      code: 'VALIDATION_ERROR',
      details: err.flatten(),
    });
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  const legacy = LEGACY_ERROR_CODES[message];
  if (legacy) {
    res.status(legacy.status).json({ error: legacy.message, message: legacy.message, code: message });
    return;
  }

  // Error inesperado → 500. Se loguea siempre; el detalle solo se expone fuera de producción.
  logger.error('Error no controlado', {
    err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    method: req.method,
    url: req.originalUrl,
    userId: (req as any).user?.userId ?? (req as any).user?.id,
  });
  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: isProd ? 'Error interno del servidor' : message,
    message: isProd ? 'Error interno del servidor' : message,
    code: 'INTERNAL_ERROR',
  });
}
