import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { asyncHandler, errorHandler, notFoundHandler } from '../../src/middleware/error-handler';
import { validateSchema } from '../../src/middleware/validate';
import { AppError } from '../../src/utils/errors';

/**
 * Tests de integración de la INFRAESTRUCTURA de errores/validación (Sprint 2.2/2.3).
 * Usa una mini-app dedicada (sin DB) para ejercer determinísticamente:
 * asyncHandler, errorHandler (AppError / código legacy / ZodError / error inesperado),
 * validateSchema y notFoundHandler.
 */
function buildApp() {
  const app = express();
  app.use(express.json());

  app.get('/ok', asyncHandler(async (_req, res) => { res.json({ ok: true }); }));
  app.get('/not-found', asyncHandler(async () => { throw AppError.notFound('Cosa no encontrada', 'THING_NOT_FOUND'); }));
  app.get('/forbidden', asyncHandler(async () => { throw AppError.forbidden('Sin permiso', 'NOPE'); }));
  app.get('/legacy', asyncHandler(async () => { throw new Error('QUOTATION_NOT_FOUND'); })); // del catálogo
  app.get('/boom', asyncHandler(async () => { throw new Error('algo inesperado'); }));
  app.post('/validate', validateSchema({ body: z.object({ name: z.string().min(1) }) }), (req, res) => {
    res.json({ name: req.body.name });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('infra: errorHandler + asyncHandler + validateSchema', () => {
  const app = buildApp();

  it('asyncHandler deja pasar respuestas OK', async () => {
    const res = await request(app).get('/ok');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('AppError.notFound → 404 con code y message', async () => {
    const res = await request(app).get('/not-found');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('THING_NOT_FOUND');
    expect(res.body.error).toBe('Cosa no encontrada');
    expect(res.body.message).toBe('Cosa no encontrada');
  });

  it('AppError.forbidden → 403', async () => {
    const res = await request(app).get('/forbidden');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOPE');
  });

  it('código legacy (QUOTATION_NOT_FOUND) → 404 vía catálogo', async () => {
    const res = await request(app).get('/legacy');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('QUOTATION_NOT_FOUND');
  });

  it('error inesperado → 500 INTERNAL_ERROR', async () => {
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });

  it('validateSchema rechaza body inválido → 400 VALIDATION_ERROR con details', async () => {
    const res = await request(app).post('/validate').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.fieldErrors.name).toBeDefined();
  });

  it('validateSchema acepta body válido y lo reemplaza con el parseado', async () => {
    const res = await request(app).post('/validate').send({ name: 'Ana' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'Ana' });
  });

  it('ruta desconocida → 404 NOT_FOUND', async () => {
    const res = await request(app).get('/ruta-inexistente');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
