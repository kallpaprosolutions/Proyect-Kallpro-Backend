/**
 * Diferidos (06-contabilidad backlog): gastos pagados por anticipado / ingresos cobrados por
 * anticipado, reconocidos en línea recta (NIC 1, devengo). El registro del diferido NO
 * contabiliza la transacción original (el pago o cobro anticipado ya se registró como
 * activo/pasivo diferido en una factura o asiento manual aparte); genera el asiento MENSUAL de
 * reconocimiento vía journal.service, auto-posteado — mismo patrón perezoso sin cron que
 * activos fijos (B4) y facturas recurrentes (B3): se dispara bajo demanda.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { getNextDocumentNumber } from '../../utils/sequence.helper';
import { createDeferredRecognitionEntry } from '../journal.service';
import { computeDueRecognitionPeriods, computeMonthlyRecognition, type DeferredKind } from './engines/deferred.engine';

export interface DeferredItemInput {
  kind: DeferredKind;
  description: string;
  deferredAccountCode: string;
  deferredAccountName: string;
  recognitionAccountCode: string;
  recognitionAccountName: string;
  totalAmount: number;
  startDate: Date;
  months: number;
  notes?: string;
}

function assertValidInput(data: DeferredItemInput) {
  if (data.kind !== 'GASTO' && data.kind !== 'INGRESO') throw new Error('VALIDATION: tipo inválido (GASTO | INGRESO)');
  if (!data.description?.trim()) throw new Error('VALIDATION: la descripción es obligatoria');
  if (!data.deferredAccountCode) throw new Error('VALIDATION: selecciona la cuenta donde vive hoy el diferido');
  if (!data.recognitionAccountCode) throw new Error('VALIDATION: selecciona la cuenta de reconocimiento');
  if (data.deferredAccountCode === data.recognitionAccountCode) throw new Error('VALIDATION: la cuenta diferida y la de reconocimiento deben ser distintas');
  if (!(data.totalAmount > 0)) throw new Error('VALIDATION: el monto total debe ser mayor a cero');
  if (!Number.isInteger(data.months) || data.months <= 0) throw new Error('VALIDATION: los meses de reconocimiento deben ser un entero mayor a cero');
}

export async function listDeferredItems(companyId: string) {
  return prisma.deferredItem.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
}

export async function getDeferredItemById(id: string, companyId: string) {
  const item = await prisma.deferredItem.findFirst({ where: { id, companyId } });
  if (!item) return null;
  const entries = await prisma.journalEntry.findMany({
    where: { companyId, entityType: 'DEFERRED_ITEM', entityId: id },
    select: { id: true, entryNumber: true, entryDate: true, totalDebit: true, description: true },
    orderBy: { entryDate: 'desc' },
  });
  return { ...item, recognitionEntries: entries };
}

export async function createDeferredItem(companyId: string, data: DeferredItemInput, actorId?: string) {
  // Cuentas por defecto del posting setup si no se eligieron (propuesta 06 #5 — nunca quemadas).
  if (!data.deferredAccountCode || !data.recognitionAccountCode) {
    const { mappedAccount } = await import('../journal.service');
    const [def, rec] = await Promise.all(data.kind === 'INGRESO'
      ? [mappedAccount(companyId, 'DEFERRED_REVENUE_LIABILITY'), mappedAccount(companyId, 'DEFERRED_REVENUE_RECOGNITION')]
      : [mappedAccount(companyId, 'DEFERRED_EXPENSE_ASSET'), mappedAccount(companyId, 'DEFERRED_EXPENSE_RECOGNITION')]);
    if (!data.deferredAccountCode) { data.deferredAccountCode = def.code; data.deferredAccountName = def.name; }
    if (!data.recognitionAccountCode) { data.recognitionAccountCode = rec.code; data.recognitionAccountName = rec.name; }
  }
  assertValidInput(data);
  return prisma.$transaction(async (tx) => {
    const itemNumber = await getNextDocumentNumber(tx, companyId, 'DEFERRED_ITEM', 'DIF-');
    return tx.deferredItem.create({
      data: {
        companyId,
        itemNumber,
        kind: data.kind,
        description: data.description.trim(),
        deferredAccountCode: data.deferredAccountCode,
        deferredAccountName: data.deferredAccountName,
        recognitionAccountCode: data.recognitionAccountCode,
        recognitionAccountName: data.recognitionAccountName,
        totalAmount: new Prisma.Decimal(data.totalAmount),
        startDate: data.startDate,
        months: data.months,
        notes: data.notes,
        createdBy: actorId,
      },
    });
  });
}

interface GenerateResult {
  generated: Array<{ itemId: string; itemNumber: string; description: string; amount: number; entryId: string }>;
  skipped: Array<{ itemId: string; description: string; reason: string }>;
}

/** Genera el asiento de reconocimiento de cada diferido ACTIVO vencido a `asOf`. Cada uno se
 * procesa independiente — si uno falla, no bloquea el resto. */
export async function generateDueRecognition(companyId: string, actorId?: string, asOf: Date = new Date()): Promise<GenerateResult> {
  const items = await prisma.deferredItem.findMany({ where: { companyId, status: 'ACTIVE' } });
  const result: GenerateResult = { generated: [], skipped: [] };

  for (const item of items) {
    const due = computeDueRecognitionPeriods(item, asOf);
    if (!due) continue;
    try {
      const rec = computeMonthlyRecognition(Number(item.totalAmount), item.months, Number(item.recognizedAmount), due.periodsElapsed);
      if (rec.amount <= 0) {
        await prisma.deferredItem.update({
          where: { id: item.id },
          data: { lastRecognizedPeriod: due.toPeriod, status: rec.completed ? 'COMPLETED' : undefined },
        });
        continue;
      }

      const entry = await createDeferredRecognitionEntry(companyId, {
        itemId: item.id, itemNumber: item.itemNumber, description: item.description, kind: item.kind as DeferredKind,
        period: due.toPeriod, fromPeriod: due.periodsElapsed > 1 ? due.fromPeriod : undefined, amount: rec.amount,
        deferredAccountCode: item.deferredAccountCode, deferredAccountName: item.deferredAccountName,
        recognitionAccountCode: item.recognitionAccountCode, recognitionAccountName: item.recognitionAccountName,
        entryDate: asOf,
      });
      if (!entry) continue;

      await prisma.deferredItem.update({
        where: { id: item.id },
        data: {
          recognizedAmount: new Prisma.Decimal(rec.newRecognized),
          lastRecognizedPeriod: due.toPeriod,
          status: rec.completed ? 'COMPLETED' : 'ACTIVE',
        },
      });

      result.generated.push({ itemId: item.id, itemNumber: item.itemNumber, description: item.description, amount: rec.amount, entryId: entry.id });
    } catch (e: any) {
      logger.warn('[deferred] no se pudo reconocer un diferido', { itemId: item.id, err: e?.message });
      result.skipped.push({ itemId: item.id, description: item.description, reason: e?.message ?? 'Error desconocido' });
    }
  }

  if (actorId) {
    logger.info('[deferred] generación de reconocimiento ejecutada', { companyId, actorId, generated: result.generated.length, skipped: result.skipped.length });
  }
  return result;
}
