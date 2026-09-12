/**
 * Facturas de compra recurrentes (B3 del plan de mejoras): arriendos, servicios básicos,
 * suscripciones. Una plantilla NO contabiliza nada por sí sola — al vencer, genera un
 * SriDocument normal vía createManualSriDocument (mismo motor del ingreso manual), que cae en
 * PENDING_REVIEW como cualquier otro documento (regla 5: alguien lo confirma antes de que
 * impacte contabilidad). Así se reusa TODO el flujo existente (duplicados, matching de OC,
 * revisión, asiento) sin duplicar lógica contable.
 *
 * No hay infraestructura de cron en este proyecto (por diseño: los vencimientos se resuelven
 * "perezosamente" — ver cómo `convertQuotationToOrder` chequea `validUntil` al vuelo). Aquí
 * sigue el mismo patrón: `generateDueRecurringInvoices` se dispara manualmente (endpoint) y
 * genera lo que esté vencido a la fecha, sin duplicar gracias a `lastGeneratedPeriod`.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { createManualSriDocument } from '../sri-document.service';
import { isTemplateDue, periodKey } from './engines/recurring-invoice.engine';

const VALID_TAX_CODES = new Set(['0', '8', '12', '15', 'NO_OBJETO', 'EXENTO']);

export interface RecurringInvoiceTemplateInput {
  supplierId: string;
  description: string;
  amount: number;
  taxCode: string;
  taxRate: number;
  dayOfMonth: number;
  startDate: Date;
  endDate?: Date | null;
  isActive?: boolean;
}

function assertValidTemplateInput(data: RecurringInvoiceTemplateInput) {
  if (!data.description?.trim()) throw new Error('VALIDATION: la descripción es obligatoria');
  if (!(data.amount > 0)) throw new Error('VALIDATION: el monto debe ser mayor a cero');
  if (!VALID_TAX_CODES.has(data.taxCode)) throw new Error(`VALIDATION: código de tarifa IVA no reconocido (${data.taxCode})`);
  if (!(data.dayOfMonth >= 1 && data.dayOfMonth <= 28)) throw new Error('VALIDATION: el día del mes debe estar entre 1 y 28');
  if (data.endDate && data.endDate < data.startDate) throw new Error('VALIDATION: la fecha de fin no puede ser anterior al inicio');
}

export async function listRecurringTemplates(companyId: string) {
  return prisma.recurringInvoiceTemplate.findMany({
    where: { companyId },
    include: { supplier: { select: { id: true, name: true, ruc: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getRecurringTemplateById(id: string, companyId: string) {
  return prisma.recurringInvoiceTemplate.findFirst({
    where: { id, companyId },
    include: {
      supplier: { select: { id: true, name: true, ruc: true } },
      generatedDocuments: {
        select: { id: true, numeroDoc: true, fechaEmision: true, total: true, status: true },
        orderBy: { fechaEmision: 'desc' },
      },
    },
  });
}

export async function createRecurringTemplate(companyId: string, data: RecurringInvoiceTemplateInput, actorId?: string) {
  assertValidTemplateInput(data);
  const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, companyId } });
  if (!supplier) throw new Error('VALIDATION: proveedor no encontrado');
  // createManualSriDocument exige RUC del emisor (una factura EC no existe sin él) — fallar acá,
  // al crear la plantilla, en vez de descubrirlo recién el día que debía generarse la factura.
  if (!supplier.ruc?.trim()) throw new Error(`VALIDATION: el proveedor "${supplier.name}" no tiene RUC configurado; complétalo en Compras → Proveedores antes de crear la plantilla`);

  return prisma.recurringInvoiceTemplate.create({
    data: {
      companyId,
      supplierId: data.supplierId,
      description: data.description.trim(),
      amount: new Prisma.Decimal(data.amount),
      taxCode: data.taxCode,
      taxRate: new Prisma.Decimal(data.taxRate),
      dayOfMonth: data.dayOfMonth,
      startDate: data.startDate,
      endDate: data.endDate ?? null,
      isActive: data.isActive ?? true,
      createdBy: actorId,
    },
    include: { supplier: { select: { id: true, name: true, ruc: true } } },
  });
}

export async function updateRecurringTemplate(id: string, companyId: string, data: Partial<RecurringInvoiceTemplateInput>) {
  const existing = await prisma.recurringInvoiceTemplate.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error('RECURRING_TEMPLATE_NOT_FOUND');
  const merged: RecurringInvoiceTemplateInput = {
    supplierId: data.supplierId ?? existing.supplierId,
    description: data.description ?? existing.description,
    amount: data.amount ?? Number(existing.amount),
    taxCode: data.taxCode ?? existing.taxCode,
    taxRate: data.taxRate ?? Number(existing.taxRate),
    dayOfMonth: data.dayOfMonth ?? existing.dayOfMonth,
    startDate: data.startDate ?? existing.startDate,
    endDate: data.endDate !== undefined ? data.endDate : existing.endDate,
    isActive: data.isActive ?? existing.isActive,
  };
  assertValidTemplateInput(merged);
  // Solo exige RUC si la plantilla queda ACTIVA — permite desactivar una plantilla cuyo
  // proveedor perdió/nunca tuvo RUC sin quedar bloqueado por la misma validación.
  if (merged.isActive) {
    const supplier = await prisma.supplier.findFirst({ where: { id: merged.supplierId, companyId } });
    if (!supplier) throw new Error('VALIDATION: proveedor no encontrado');
    if (!supplier.ruc?.trim()) throw new Error(`VALIDATION: el proveedor "${supplier.name}" no tiene RUC configurado; complétalo en Compras → Proveedores para poder activar la plantilla`);
  }

  return prisma.recurringInvoiceTemplate.update({
    where: { id },
    data: {
      supplierId: merged.supplierId,
      description: merged.description.trim(),
      amount: new Prisma.Decimal(merged.amount),
      taxCode: merged.taxCode,
      taxRate: new Prisma.Decimal(merged.taxRate),
      dayOfMonth: merged.dayOfMonth,
      startDate: merged.startDate,
      endDate: merged.endDate,
      isActive: merged.isActive,
    },
    include: { supplier: { select: { id: true, name: true, ruc: true } } },
  });
}

interface GenerateResult {
  generated: Array<{ templateId: string; description: string; documentId: string }>;
  skipped: Array<{ templateId: string; description: string; reason: string }>;
}

/**
 * Genera el SriDocument de cada plantilla vencida a `asOf` (default: ahora) que no se haya
 * generado ya para ese período. Cada plantilla se procesa independiente — si una falla (ej.
 * proveedor desactivado), no bloquea el resto (mismo criterio que `processScheduledPayments`).
 */
export async function generateDueRecurringInvoices(companyId: string, actorId?: string, asOf: Date = new Date()): Promise<GenerateResult> {
  const templates = await prisma.recurringInvoiceTemplate.findMany({
    where: { companyId, isActive: true },
    include: { supplier: true },
  });

  const result: GenerateResult = { generated: [], skipped: [] };

  for (const template of templates) {
    if (!isTemplateDue(template, asOf)) continue;
    try {
      const supplier = template.supplier;
      if (!supplier || !supplier.isActive) throw new Error('El proveedor de esta plantilla está inactivo');

      const { document } = await createManualSriDocument(companyId, {
        tipoDocumento: 'FACTURA',
        supplierId: supplier.id,
        rucEmisor: supplier.ruc ?? '',
        razonSocialEmisor: supplier.razonSocial ?? supplier.name,
        fechaEmision: asOf.toISOString(),
        items: [{
          descripcion: template.description,
          cantidad: 1,
          precioUnitario: Number(template.amount),
          codigoTarifa: template.taxCode,
          tarifaIva: Number(template.taxRate),
        }],
        source: 'MANUAL',
      });

      await prisma.$transaction([
        prisma.sriDocument.update({
          where: { id: document.id },
          data: {
            recurringTemplateId: template.id,
            observaciones: `Generada automáticamente por plantilla recurrente: ${template.description}`,
          },
        }),
        prisma.recurringInvoiceTemplate.update({
          where: { id: template.id },
          data: { lastGeneratedPeriod: periodKey(asOf) },
        }),
      ]);

      result.generated.push({ templateId: template.id, description: template.description, documentId: document.id });
    } catch (e: any) {
      logger.warn('[recurring-invoice] no se pudo generar la factura de una plantilla', { templateId: template.id, err: e?.message });
      result.skipped.push({ templateId: template.id, description: template.description, reason: e?.message ?? 'Error desconocido' });
    }
  }

  if (actorId) {
    logger.info('[recurring-invoice] generación de facturas recurrentes ejecutada', { companyId, actorId, generated: result.generated.length, skipped: result.skipped.length });
  }
  return result;
}
