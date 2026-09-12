import { prisma } from '../../src/lib/prisma';
import * as notes from '../../src/services/finance/financial-notes.service';

/** Integración con BD real: CRUD de notas a los estados financieros (Etapa 8). */
const TAG = `notes_${Date.now()}`;
let dbAvailable = false;
let companyId = '';

async function cleanup() {
  await prisma.financialStatementNote.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => {});
}

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
    return;
  }
  const company = await prisma.company.create({ data: { name: `Empresa ${TAG}`, email: `${TAG}@kallpapro.test` } });
  companyId = company.id;
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

describe('financial-notes.service — e2e con BD real', () => {
  it('crea, lista ordenado, actualiza y borra una nota', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }

    const n2 = await notes.createNote(companyId, { period: '2026-02', title: 'Nota B', content: 'contenido B', order: 2 });
    const n1 = await notes.createNote(companyId, { period: '2026-02', title: 'Nota A', content: 'contenido A', order: 1 });
    await notes.createNote(companyId, { period: '2026-01', title: 'De otro período', content: 'x' });

    const list = await notes.listNotes(companyId, '2026-02');
    expect(list.map((n) => n.title)).toEqual(['Nota A', 'Nota B']); // ordenado por `order`
    expect(list).toHaveLength(2);

    const updated = await notes.updateNote(companyId, n1.id, { content: 'contenido A editado' });
    expect(updated.content).toBe('contenido A editado');

    await notes.deleteNote(companyId, n2.id);
    const listAfterDelete = await notes.listNotes(companyId, '2026-02');
    expect(listAfterDelete).toHaveLength(1);
  });

  it('rechaza crear sin título y actualizar/borrar una nota de otra empresa', async () => {
    if (!dbAvailable) return;
    await expect(notes.createNote(companyId, { period: '2026-03', title: '', content: 'x' })).rejects.toThrow();

    const otherCompany = await prisma.company.create({ data: { name: `Otra ${TAG}`, email: `otra-${TAG}@kallpapro.test` } });
    const note = await notes.createNote(otherCompany.id, { period: '2026-03', title: 'Ajena', content: 'x' });
    await expect(notes.updateNote(companyId, note.id, { title: 'hackeada' })).rejects.toThrow();
    await expect(notes.deleteNote(companyId, note.id)).rejects.toThrow();
    await prisma.financialStatementNote.deleteMany({ where: { companyId: otherCompany.id } });
    await prisma.company.delete({ where: { id: otherCompany.id } });
  });
});
