import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app';

/**
 * Tests de integración contra la APP REAL (src/app.ts) que NO requieren base de datos:
 * health, índice API, 404, Correlation ID (X-Request-Id), rechazo de auth, y la cadena
 * auth → validateSchema → errorHandler usando un JWT acuñado sin sessionId (pasa auth
 * sin tocar la BD; el fallo de validación responde antes de llegar al servicio).
 */
const token = jwt.sign(
  { userId: 'u1', companyId: 'c1', email: 'test@kallpapro.com', role: 'ADMIN' },
  process.env.JWT_SECRET as string,
  { expiresIn: '1h' },
);

describe('app real (sin DB): health, 404, correlation id, auth, validación', () => {
  it('GET /health → 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api → 200 índice', async () => {
    const res = await request(app).get('/api');
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('KallpaPro');
  });

  it('toda respuesta trae header X-Request-Id', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).toMatch(/[0-9a-f-]{8,}/i);
  });

  it('reutiliza el X-Request-Id entrante', async () => {
    const res = await request(app).get('/health').set('X-Request-Id', 'mi-id-fijo-123');
    expect(res.headers['x-request-id']).toBe('mi-id-fijo-123');
  });

  it('ruta inexistente → 404 NOT_FOUND', async () => {
    const res = await request(app).get('/api/no-existe-xyz');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('endpoint protegido sin token → 401', async () => {
    const res = await request(app).get('/api/crm/contacts');
    expect(res.status).toBe(401);
  });

  it('endpoint protegido con token inválido → 401', async () => {
    const res = await request(app).get('/api/crm/contacts').set('Authorization', 'Bearer token-basura');
    expect(res.status).toBe(401);
  });

  it('cadena auth+validateSchema: POST /api/crm/contacts sin firstName → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/crm/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ lastName: 'Pérez' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.fieldErrors.firstName).toBeDefined();
  });

  it('GET /api/docs.json → 200 spec OpenAPI con paths', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBeDefined();
    expect(res.body.paths['/api/auth/login']).toBeDefined();
    expect(res.body.components.schemas.ErrorResponse).toBeDefined();
  });

  it('GET /api/docs/ → 200 UI de Swagger (sin auth)', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  it('POST /api/inventory/stock-check sin token → 401', async () => {
    const res = await request(app).post('/api/inventory/stock-check').send({ items: [] });
    expect(res.status).toBe(401);
  });

  it('POST /api/inventory/stock-check con items vacío → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/inventory/stock-check')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST credit-notes sin token → 401', async () => {
    const res = await request(app).post('/api/financial/invoices/x/credit-notes').send({ reason: 'r', lines: [] });
    expect(res.status).toBe(401);
  });

  it('POST credit-notes con lines vacío → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/financial/invoices/x/credit-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Devolución', lines: [] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('spec OpenAPI incluye el endpoint de notas de crédito', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.body.paths['/api/financial/invoices/{id}/credit-notes']).toBeDefined();
  });

  it('GET /api/reports/sales-invoice/:id/pdf sin token → 401', async () => {
    const res = await request(app).get('/api/reports/sales-invoice/x/pdf');
    expect(res.status).toBe(401);
  });

  it('spec OpenAPI incluye los PDF de venta (factura y NC)', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.body.paths['/api/reports/sales-invoice/{id}/pdf']).toBeDefined();
    expect(res.body.paths['/api/reports/credit-note/{id}/pdf']).toBeDefined();
  });
});
