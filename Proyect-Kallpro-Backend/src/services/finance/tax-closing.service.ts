/**
 * Etapa 6 del plan SRI: cierre de impuestos automático (asiento de liquidación de IVA), estilo
 * Odoo. Reusa el motor puro ya existente (`sri-casillas.service.buildForm104Casillas`/
 * `getForm104Casillas`) para no duplicar el cálculo del Formulario 104 — el cierre solo decide
 * si postear el asiento y bloquear el período, la aritmética del IVA es la misma que ya se le
 * muestra al usuario en la pestaña Declaraciones antes de cerrar.
 */
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { getForm104Casillas, periodRange } from './sri-casillas.service';
import { createTaxClosingEntry } from '../journal.service';
import { closePeriod } from './fiscal-period.service';

function findRow(casillas: Awaited<ReturnType<typeof getForm104Casillas>>, casilla: string): number {
  for (const s of casillas.sections) {
    const row = s.rows.find((r) => r.casilla === casilla);
    if (row) return row.value;
  }
  return 0;
}

/** Vista previa del cierre: reusa el Form 104 tal cual, sin efectos secundarios. */
export async function getTaxClosingPreview(companyId: string, period: string) {
  const casillas = await getForm104Casillas(companyId, period);
  const alreadyClosed = await prisma.journalEntry.findFirst({
    where: { companyId, entityType: 'TAX_CLOSING', entityId: period, status: { not: 'REVERSED' } },
    select: { id: true, entryNumber: true },
  });
  return {
    period,
    resultado: casillas.resultado,
    periodStatus: casillas.periodStatus,
    pendientes: casillas.pendientes,
    yaCerrado: !!alreadyClosed,
    entryNumber: alreadyClosed?.entryNumber ?? null,
  };
}

/**
 * Cierra los impuestos del período: postea el asiento de liquidación (solo si hay IVA A PAGAR)
 * y bloquea el mes contable — mismo `FiscalPeriod` que ya usa el cierre contable general
 * (Sprint 6), no un candado paralelo. Idempotente por diseño de `closePeriod`, pero el asiento
 * de liquidación en sí se protege explícitamente contra doble posteo (regla 5: lo contabilizado
 * no se reversa con un simple re-click).
 */
export async function closeTaxPeriod(companyId: string, period: string, userId?: string) {
  const casillas = await getForm104Casillas(companyId, period);
  if (casillas.periodStatus === 'CLOSED') {
    throw AppError.badRequest(`El período ${period} ya está cerrado contablemente`, 'PERIOD_ALREADY_CLOSED');
  }
  const existing = await prisma.journalEntry.findFirst({
    where: { companyId, entityType: 'TAX_CLOSING', entityId: period, status: { not: 'REVERSED' } },
  });
  if (existing) {
    throw AppError.badRequest(`Los impuestos de ${period} ya se cerraron (${existing.entryNumber})`, 'TAX_PERIOD_ALREADY_CLOSED');
  }
  if (casillas.pendientes.sriDocsPendientes > 0 || casillas.pendientes.facturasBorrador > 0) {
    throw AppError.badRequest(
      'Hay documentos pendientes de revisar en el período (SRI por confirmar o facturas en borrador) — resuélvelos antes de cerrar los impuestos',
      'TAX_PERIOD_HAS_PENDING_DOCS',
    );
  }

  const { end, year, month } = periodRange(period);
  const impuestoGenerado = findRow(casillas, '429');
  const creditoAdquisiciones = findRow(casillas, '520');
  const retencionesIvaRecibidas = findRow(casillas, '609');
  const totalPagar = casillas.resultado.type === 'A_PAGAR' ? casillas.resultado.value : 0;

  const entry = totalPagar > 0
    ? await createTaxClosingEntry(companyId, { period, entryDate: end, impuestoGenerado, creditoAdquisiciones, retencionesIvaRecibidas, totalPagar })
    : null;

  await closePeriod(companyId, year, month, userId, entry ? `Cierre de impuestos: IVA a pagar $${totalPagar.toFixed(2)} (${entry.entryNumber})` : 'Cierre de impuestos: sin IVA a pagar (crédito tributario a favor)');

  return { entry, totalPagar, resultado: casillas.resultado };
}
