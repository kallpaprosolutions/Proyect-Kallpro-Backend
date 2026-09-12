import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app';

/**
 * Validación de PATCH /api/company/settings para las secciones del Sprint 2
 * (sales y security, backlog #14 del plan 18). Sin base de datos: los payloads
 * inválidos responden 400 en el controlador ANTES de llegar al servicio; el JWT
 * se acuña sin sessionId (pasa auth sin tocar la BD) y authorize() es en memoria.
 */
const token = jwt.sign(
  { userId: 'u1', companyId: 'c1', email: 'test@kallpapro.com', role: 'ADMIN' },
  process.env.JWT_SECRET as string,
  { expiresIn: '1h' },
);

const patchSettings = (settings: object) =>
  request(app)
    .patch('/api/company/settings')
    .set('Authorization', `Bearer ${token}`)
    .send({ settings });

describe('PATCH /company/settings — validación de sales y security (plan 18 · #14)', () => {
  it('rechaza un tope de descuento > 100%', async () => {
    const res = await patchSettings({ sales: { maxDiscountByRole: { FUERZA_VENTAS: 150 } } });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza un tope de descuento negativo', async () => {
    const res = await patchSettings({ sales: { maxDiscountByRole: { FUERZA_VENTAS: -5 } } });
    expect(res.status).toBe(400);
  });

  it('rechaza enforceCreditLimit no booleano', async () => {
    const res = await patchSettings({ sales: { enforceCreditLimit: 'si' } });
    expect(res.status).toBe(400);
  });

  it('rechaza sessionTimeoutMinutes menor a 5', async () => {
    const res = await patchSettings({ security: { sessionTimeoutMinutes: 1 } });
    expect(res.status).toBe(400);
  });

  it('rechaza sessionTimeoutMinutes mayor a 1440 (24 h)', async () => {
    const res = await patchSettings({ security: { sessionTimeoutMinutes: 999999 } });
    expect(res.status).toBe(400);
  });

  it('rechaza sessionTimeoutMinutes no entero', async () => {
    const res = await patchSettings({ security: { sessionTimeoutMinutes: 30.5 } });
    expect(res.status).toBe(400);
  });

  it('rechaza require2FAForRoles que no sea array de strings', async () => {
    const res = await patchSettings({ security: { require2FAForRoles: 'ADMIN' } });
    expect(res.status).toBe(400);
  });

  it('un rol sin permiso configure:CompanySettings → 403', async () => {
    const sellerToken = jwt.sign(
      { userId: 'u2', companyId: 'c1', email: 'seller@kallpapro.com', role: 'FUERZA_VENTAS' },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' },
    );
    const res = await request(app)
      .patch('/api/company/settings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ settings: { security: { sessionTimeoutMinutes: 30 } } });
    expect(res.status).toBe(403);
  });
});
