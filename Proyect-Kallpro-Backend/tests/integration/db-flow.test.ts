import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';

/**
 * Test de integración END-TO-END contra la BD real (Sprint 2.4 / cierre backlog).
 * Flujo completo del stack: registro → login → /me → endpoint con BD → stock-check.
 *
 * Crea una empresa+usuario efímeros y los limpia en afterAll (borrar la empresa cascada
 * a usuario y sesiones). Si la BD no está disponible, el suite se omite con gracia.
 */
const TEST_EMAIL = `e2e_${Date.now()}@kallpapro.test`;
const PASSWORD = 'Sup3rSecret!23';
let dbAvailable = false;
let companyId: string | null = null;
let accessToken = '';

async function cleanup() {
  await prisma.userSession.deleteMany({ where: { user: { email: TEST_EMAIL } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } }).catch(() => {});
  if (companyId) await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => {});
  await prisma.company.deleteMany({ where: { email: TEST_EMAIL } }).catch(() => {});
}

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
    return;
  }
  await cleanup(); // por si quedó algo de una corrida fallida
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

describe('e2e con BD real: registro → login → endpoints', () => {
  it('POST /api/auth/register crea empresa + usuario (201)', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const res = await request(app).post('/api/auth/register').send({
      companyName: 'E2E Test Co', email: TEST_EMAIL, password: PASSWORD, firstName: 'E2E', lastName: 'Tester',
    });
    expect(res.status).toBe(201);
    expect(res.body.company?.id).toBeDefined();
    expect(res.body.user?.email).toBe(TEST_EMAIL);
    companyId = res.body.company.id;
  });

  it('rechaza email duplicado (409 EMAIL_EXISTS)', async () => {
    if (!dbAvailable) return;
    const res = await request(app).post('/api/auth/register').send({
      companyName: 'Dup', email: TEST_EMAIL, password: PASSWORD, firstName: 'A', lastName: 'B',
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_EXISTS');
  });

  it('POST /api/auth/login devuelve accessToken (200)', async () => {
    if (!dbAvailable) return;
    const res = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    accessToken = res.body.accessToken;
  });

  it('login con contraseña incorrecta → 401', async () => {
    if (!dbAvailable) return;
    const res = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: 'mala' });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me con el token real → 200', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user?.email).toBe(TEST_EMAIL);
  });

  it('GET /api/inventory/products (con BD, sesión real) → 200 array', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get('/api/inventory/products').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/inventory/stock-check con producto inexistente → found:false', async () => {
    if (!dbAvailable) return;
    const res = await request(app).post('/api/inventory/stock-check')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ items: [{ productId: 'no-existe-uuid', quantity: 5 }] });
    expect(res.status).toBe(200);
    expect(res.body.items[0].found).toBe(false);
    expect(res.body.items[0].available).toBe(0);
    expect(res.body.hasWarnings).toBe(true);
  });
});
