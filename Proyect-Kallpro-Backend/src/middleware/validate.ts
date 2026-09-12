import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodTypeAny } from 'zod';

/**
 * Middleware de validación con Zod (Sprint 2.3 · paso 3).
 *
 * Valida `body`, `params` y/o `query` contra los esquemas dados. Si algo no cumple,
 * el ZodError se delega al errorHandler global, que responde 400 con
 * { error, message, code: 'VALIDATION_ERROR', details }.
 *
 * Al validar, REEMPLAZA cada sección con el valor parseado (coerción incluida: p.ej.
 * `z.coerce.number()` en query convierte el string a número). Úsalo a nivel de ruta:
 *
 *   router.post('/x', validateSchema({ body: createXSchema }), ctrl.createX);
 */
interface ValidationSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

export function validateSchema(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) req.params = schemas.params.parse(req.params) as Request['params'];
      if (schemas.query) req.query = schemas.query.parse(req.query) as Request['query'];
      next();
    } catch (err) {
      next(err); // ZodError → errorHandler global → 400 VALIDATION_ERROR
    }
  };
}
