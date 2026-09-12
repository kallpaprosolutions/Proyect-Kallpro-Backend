import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app';

/**
 * Sprint 6 — Contabilidad Pro: rutas y RBAC sin BD.
 * Valida que los endpoints nuevos existan, que la validación responda 400 antes
 * de tocar la BD, y que los roles nuevos (AUDITOR/TRIBUTARIO) tengan los permisos
 * correctos vía CASL (en memoria).
 */
const mint = (role: string) =>
  jwt.sign(
    { userId: 'u1', companyId: 'c1', email: `${role.toLowerCase()}@kallpapro.com`, role },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h' },
  );

describe('períodos fiscales — validación y RBAC', () => {
  it('POST /fiscal-periods/close sin year/month → 400', async () => {
    const res = await request(app)
      .post('/api/financial/fiscal-periods/close')
      .set('Authorization', `Bearer ${mint('ADMIN')}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /fiscal-periods/close con rol AUDITOR (solo lectura) → 403', async () => {
    const res = await request(app)
      .post('/api/financial/fiscal-periods/close')
      .set('Authorization', `Bearer ${mint('AUDITOR')}`)
      .send({ year: 2026, month: 5 });
    expect(res.status).toBe(403);
  });

  it('POST /fiscal-periods/reopen con rol FUERZA_VENTAS → 403', async () => {
    const res = await request(app)
      .post('/api/financial/fiscal-periods/reopen')
      .set('Authorization', `Bearer ${mint('FUERZA_VENTAS')}`)
      .send({ year: 2026, month: 5 });
    expect(res.status).toBe(403);
  });

  it('fiscal-periods sin token → 401', async () => {
    const res = await request(app).get('/api/financial/fiscal-periods');
    expect(res.status).toBe(401);
  });
});

describe('roles nuevos en el catálogo de auth', () => {
  it('ROLE_RULES incluye AUDITOR (read all) y TRIBUTARIO', async () => {
    const { ROLE_RULES, ROLE_CATALOG } = await import('../../src/auth/roles');
    expect(ROLE_RULES.AUDITOR).toEqual([['read', 'all']]);
    expect(ROLE_RULES.TRIBUTARIO).toBeDefined();
    const keys = ROLE_CATALOG.map((r) => r.key);
    expect(keys).toContain('AUDITOR');
    expect(keys).toContain('TRIBUTARIO');
  });
});
