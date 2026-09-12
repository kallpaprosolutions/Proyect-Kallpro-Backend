/**
 * Notas a los Estados Financieros (NIC 1 §112-116), Etapa 8 del plan SRI/NIIF. KallpaPro NO
 * genera el contenido (políticas contables, desagregaciones, contingencias son juicio del
 * contador) — solo las guarda por período y las incluye en el paquete de exportación
 * NIIF/Supercías (`financial-statements-package.service.ts`).
 */
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';

export async function listNotes(companyId: string, period: string) {
  return prisma.financialStatementNote.findMany({
    where: { companyId, period },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createNote(
  companyId: string,
  data: { period: string; title: string; content: string; order?: number },
  userId?: string,
) {
  if (!data.period?.trim()) throw AppError.badRequest('El período es obligatorio', 'VALIDATION_ERROR');
  if (!data.title?.trim()) throw AppError.badRequest('El título de la nota es obligatorio', 'VALIDATION_ERROR');
  return prisma.financialStatementNote.create({
    data: {
      companyId, period: data.period, title: data.title,
      content: data.content ?? '', order: data.order ?? 0, createdBy: userId,
    },
  });
}

export async function updateNote(
  companyId: string,
  id: string,
  data: { title?: string; content?: string; order?: number },
) {
  const existing = await prisma.financialStatementNote.findFirst({ where: { id, companyId } });
  if (!existing) throw AppError.notFound('Nota no encontrada');
  return prisma.financialStatementNote.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.order !== undefined && { order: data.order }),
    },
  });
}

export async function deleteNote(companyId: string, id: string) {
  const existing = await prisma.financialStatementNote.findFirst({ where: { id, companyId } });
  if (!existing) throw AppError.notFound('Nota no encontrada');
  await prisma.financialStatementNote.delete({ where: { id } });
  return { ok: true };
}
