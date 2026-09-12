import { prisma } from '../lib/prisma';
import { getNextDocumentNumber } from '../utils/sequence.helper';
import { AppError } from '../utils/errors';

// ============================================================
// GESTIÓN DE CALIDAD (Sprint 12)
// ============================================================
// Normas de referencia implementadas:
//  · ISO 9001:2015 §8.5.2  — identificación y trazabilidad (lote único por producción)
//  · ISO 9001:2015 §8.6    — liberación de productos: no se entrega hasta verificar,
//                            con registro de la persona que autoriza
//  · ISO 9001:2015 §8.7    — control de salidas no conformes (ver nonconformity.service)
//  · ISO 22000 / HACCP     — parámetros marcados isCritical = Puntos Críticos de Control
//  · ARCSA (Ecuador)       — registro sanitario vigente, lote y fecha de vencimiento
//                            obligatorios en el rotulado; BPM Res. ARCSA-DE-067-2015
//
// Los motores de evaluación son PUROS (regla 6): no tocan BD y se testean unitariamente.

// ─── Tipos ────────────────────────────────────────────────────

export type ParameterType = 'NUMERIC' | 'BOOLEAN' | 'TEXT';

/** Especificación de calidad (lo que DEBE cumplir el producto). */
export interface QualitySpec {
  id: string;
  name: string;
  type: string;
  unit?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  expectedText?: string | null;
  isCritical: boolean;
}

/** Medición tomada por el inspector. */
export interface MeasuredValue {
  parameterId: string;
  valueNumeric?: number | null;
  valueBoolean?: boolean | null;
  valueText?: string | null;
  observation?: string | null;
}

export interface ParamEvaluation {
  parameterId: string;
  parameterName: string;
  isCritical: boolean;
  passed: boolean;
  /** Explicación en español, se muestra en la UI y en el Certificado de Análisis. */
  reason: string;
}

export interface InspectionEvaluation {
  status: 'PASSED' | 'FAILED';
  evaluations: ParamEvaluation[];
  /** Nombres de los PCC (puntos críticos) que fallaron — bloquean la liberación. */
  criticalFailures: string[];
  failedCount: number;
  totalCount: number;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(n));

// ─── Motor puro: evaluación de un parámetro ───────────────────

/**
 * Evalúa una medición contra su especificación.
 * Una medición ausente SIEMPRE reprueba: en ISO 9001 §8.6 "no verificado" ≠ "conforme".
 */
export function evaluateParameter(spec: QualitySpec, measured?: MeasuredValue): ParamEvaluation {
  const base = { parameterId: spec.id, parameterName: spec.name, isCritical: spec.isCritical };
  const unit = spec.unit ? ` ${spec.unit}` : '';

  if (spec.type === 'NUMERIC') {
    const v = measured?.valueNumeric;
    if (v === null || v === undefined || Number.isNaN(Number(v))) {
      return { ...base, passed: false, reason: 'Sin medición registrada' };
    }
    const value = Number(v);
    const min = spec.minValue ?? null;
    const max = spec.maxValue ?? null;
    if (min !== null && value < Number(min)) {
      return { ...base, passed: false, reason: `${fmt(value)}${unit} está por debajo del mínimo (${fmt(Number(min))}${unit})` };
    }
    if (max !== null && value > Number(max)) {
      return { ...base, passed: false, reason: `${fmt(value)}${unit} supera el máximo (${fmt(Number(max))}${unit})` };
    }
    const rango = min !== null && max !== null ? `${fmt(Number(min))}–${fmt(Number(max))}${unit}`
      : min !== null ? `≥ ${fmt(Number(min))}${unit}`
      : max !== null ? `≤ ${fmt(Number(max))}${unit}` : 'sin límites definidos';
    return { ...base, passed: true, reason: `${fmt(value)}${unit} dentro de especificación (${rango})` };
  }

  if (spec.type === 'BOOLEAN') {
    const v = measured?.valueBoolean;
    if (v === null || v === undefined) {
      return { ...base, passed: false, reason: 'Sin verificación registrada' };
    }
    // expectedText 'false' invierte el criterio; por defecto se espera "cumple" (true).
    const expected = String(spec.expectedText ?? 'true').toLowerCase() !== 'false';
    return v === expected
      ? { ...base, passed: true, reason: expected ? 'Cumple' : 'Ausente, como se esperaba' }
      : { ...base, passed: false, reason: expected ? 'No cumple' : 'Presente cuando debía estar ausente' };
  }

  // TEXT
  const t = (measured?.valueText ?? '').trim();
  if (!t) return { ...base, passed: false, reason: 'Sin valor registrado' };
  const expectedText = (spec.expectedText ?? '').trim();
  if (!expectedText) return { ...base, passed: true, reason: `Registrado: "${t}"` };
  return t.toLowerCase() === expectedText.toLowerCase()
    ? { ...base, passed: true, reason: `Coincide con lo esperado ("${expectedText}")` }
    : { ...base, passed: false, reason: `Se esperaba "${expectedText}" y se registró "${t}"` };
}

/**
 * Evalúa la inspección completa. Cualquier parámetro fuera de especificación
 * reprueba el lote; los PCC fallidos se reportan aparte porque, además de
 * reprobar, exigen abrir una no conformidad (HACCP / ISO 22000).
 */
export function evaluateInspection(specs: QualitySpec[], measurements: MeasuredValue[]): InspectionEvaluation {
  const byId = new Map(measurements.map((m) => [m.parameterId, m]));
  const evaluations = specs.map((s) => evaluateParameter(s, byId.get(s.id)));
  const failed = evaluations.filter((e) => !e.passed);
  return {
    status: failed.length === 0 ? 'PASSED' : 'FAILED',
    evaluations,
    criticalFailures: failed.filter((e) => e.isCritical).map((e) => e.parameterName),
    failedCount: failed.length,
    totalCount: evaluations.length,
  };
}

// ─── Motores puros: lote, caducidad y vigencia sanitaria ──────

/** Nº de lote legible y rastreable: LOTE-AAAAMMDD-<correlativo de la orden>. */
export function buildLotNumber(orderNumber: string, date: Date): string {
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const seq = orderNumber.replace(/^\D+/, '') || orderNumber;
  return `LOTE-${ymd}-${seq}`;
}

/** Vencimiento del lote = fecha de elaboración + vida útil (ARCSA exige ambas en el rotulado). */
export function computeExpiryDate(manufacturingDate: Date, shelfLifeDays?: number | null): Date | null {
  if (!shelfLifeDays || shelfLifeDays <= 0) return null;
  const d = new Date(manufacturingDate);
  d.setDate(d.getDate() + shelfLifeDays);
  return d;
}

export interface SanitaryCheck {
  ok: boolean;
  level: 'OK' | 'MISSING' | 'EXPIRING' | 'EXPIRED';
  message: string;
}

/**
 * Vigencia del Registro Sanitario / Notificación Sanitaria Obligatoria (ARCSA).
 * No bloquea la producción (el trámite de renovación puede estar en curso) pero
 * deja constancia visible, que es lo que exige una auditoría.
 */
export function checkSanitaryRegistry(
  registry?: string | null,
  expiry?: Date | null,
  today: Date = new Date(),
): SanitaryCheck {
  if (!registry) {
    return { ok: true, level: 'MISSING', message: 'Producto sin registro sanitario ARCSA declarado' };
  }
  if (!expiry) {
    return { ok: true, level: 'OK', message: `Registro sanitario ${registry} (sin fecha de vencimiento registrada)` };
  }
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  if (days < 0) {
    return { ok: false, level: 'EXPIRED', message: `Registro sanitario ${registry} VENCIDO hace ${Math.abs(days)} día(s)` };
  }
  if (days <= 60) {
    return { ok: true, level: 'EXPIRING', message: `Registro sanitario ${registry} vence en ${days} día(s)` };
  }
  return { ok: true, level: 'OK', message: `Registro sanitario ${registry} vigente` };
}

// ─── Parámetros de calidad (especificaciones) ─────────────────

export async function listQualityParameters(companyId: string, productId?: string) {
  return prisma.qualityParameter.findMany({
    where: {
      companyId,
      isActive: true,
      // Para un producto: sus parámetros propios + los generales de la empresa.
      ...(productId ? { OR: [{ productId }, { productId: null }] } : {}),
    },
    include: { product: { select: { id: true, name: true, sku: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createQualityParameter(companyId: string, data: {
  productId?: string | null; name: string; type?: string; unit?: string;
  minValue?: number; maxValue?: number; expectedText?: string; method?: string;
  isCritical?: boolean; norm?: string; sortOrder?: number;
}) {
  if (!data.name?.trim()) throw AppError.badRequest('El parámetro necesita un nombre', 'PARAM_NAME_REQUIRED');
  const type = (data.type ?? 'NUMERIC').toUpperCase();
  if (type === 'NUMERIC' && data.minValue == null && data.maxValue == null) {
    throw AppError.badRequest('Un parámetro numérico requiere al menos un límite (mínimo o máximo)', 'PARAM_LIMITS_REQUIRED');
  }
  return prisma.qualityParameter.create({
    data: {
      companyId,
      productId: data.productId || null,
      name: data.name.trim(),
      type,
      unit: data.unit,
      minValue: data.minValue,
      maxValue: data.maxValue,
      expectedText: data.expectedText,
      method: data.method,
      isCritical: data.isCritical ?? false,
      norm: data.norm,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export async function updateQualityParameter(id: string, companyId: string, data: Record<string, unknown>) {
  const found = await prisma.qualityParameter.findFirst({ where: { id, companyId } });
  if (!found) throw AppError.notFound('Parámetro no encontrado', 'PARAM_NOT_FOUND');
  return prisma.qualityParameter.update({ where: { id }, data });
}

export async function deactivateQualityParameter(id: string, companyId: string) {
  const found = await prisma.qualityParameter.findFirst({ where: { id, companyId } });
  if (!found) throw AppError.notFound('Parámetro no encontrado', 'PARAM_NOT_FOUND');
  // Baja lógica: los resultados históricos deben seguir apuntando al parámetro (trazabilidad).
  return prisma.qualityParameter.update({ where: { id }, data: { isActive: false } });
}

// ─── Inspecciones ─────────────────────────────────────────────

export async function listInspections(companyId: string, filters?: { productionOrderId?: string; status?: string }) {
  return prisma.qualityInspection.findMany({
    where: {
      companyId,
      ...(filters?.productionOrderId ? { productionOrderId: filters.productionOrderId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
    },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      productionOrder: { select: { id: true, poNumber: true, lotNumber: true } },
      results: { include: { parameter: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export async function getInspection(id: string, companyId: string) {
  const inspection = await prisma.qualityInspection.findFirst({
    where: { id, companyId },
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true, sanitaryRegistry: true } },
      productionOrder: { select: { id: true, poNumber: true, lotNumber: true, expiryDate: true, manufacturingDate: true, quantity: true } },
      results: { include: { parameter: true } },
      nonConformities: { select: { id: true, ncNumber: true, status: true, severity: true } },
    },
  });
  if (!inspection) throw AppError.notFound('Inspección no encontrada', 'INSPECTION_NOT_FOUND');
  return inspection;
}

/**
 * Registra una inspección con sus mediciones. El resultado (PASSED/FAILED) lo
 * decide el motor puro, no el usuario: nadie "aprueba a mano" un lote fuera de
 * especificación (ISO 9001 §8.6).
 */
export async function createInspection(companyId: string, userId: string, data: {
  productionOrderId?: string;
  productId: string;
  type?: string;
  lotNumber?: string;
  notes?: string;
  measurements: MeasuredValue[];
}) {
  const product = await prisma.product.findFirst({ where: { id: data.productId, companyId } });
  if (!product) throw AppError.notFound('Producto no encontrado', 'PRODUCT_NOT_FOUND');

  const specs = await listQualityParameters(companyId, data.productId);
  if (specs.length === 0) {
    throw AppError.badRequest(
      'El producto no tiene parámetros de calidad definidos. Configúralos en Producción → Calidad.',
      'NO_QUALITY_PARAMETERS',
    );
  }

  const evaluation = evaluateInspection(
    specs.map((s) => ({
      id: s.id, name: s.name, type: s.type, unit: s.unit,
      minValue: s.minValue == null ? null : Number(s.minValue),
      maxValue: s.maxValue == null ? null : Number(s.maxValue),
      expectedText: s.expectedText, isCritical: s.isCritical,
    })),
    data.measurements,
  );

  const inspectionNumber = await prisma.$transaction((tx) =>
    getNextDocumentNumber(tx, companyId, 'QUALITY_INSPECTION', 'INS-'));

  const byId = new Map(data.measurements.map((m) => [m.parameterId, m]));

  return prisma.qualityInspection.create({
    data: {
      companyId,
      inspectionNumber,
      productionOrderId: data.productionOrderId,
      productId: data.productId,
      type: (data.type ?? 'FINAL').toUpperCase(),
      status: evaluation.status,
      lotNumber: data.lotNumber,
      inspectedBy: userId,
      inspectedAt: new Date(),
      notes: data.notes,
      results: {
        create: evaluation.evaluations.map((e) => {
          const m = byId.get(e.parameterId);
          return {
            parameterId: e.parameterId,
            valueNumeric: m?.valueNumeric ?? null,
            valueBoolean: m?.valueBoolean ?? null,
            valueText: m?.valueText ?? null,
            passed: e.passed,
            observation: m?.observation ?? e.reason,
          };
        }),
      },
    },
    include: { results: { include: { parameter: true } }, product: { select: { name: true, sku: true } } },
  });
}

// ─── Liberación de lote (ISO 9001 §8.6) ───────────────────────

/**
 * Libera o rechaza el lote de una orden de producción.
 * Reglas duras:
 *  · Solo se libera un lote en CUARENTENA.
 *  · Si el producto exige control de calidad, debe existir una inspección FINAL
 *    APROBADA; sin ella la liberación se rechaza (no hay "liberación por confianza").
 *  · La liberación queda firmada (usuario + fecha) y propaga el estado al InventoryBatch,
 *    que es lo que consulta la venta para permitir o bloquear el despacho.
 */
export async function releaseLot(
  productionOrderId: string,
  companyId: string,
  userId: string,
  args: { approve: boolean; notes?: string },
) {
  const order = await prisma.productionOrder.findFirst({
    where: { id: productionOrderId, companyId },
    include: { product: { select: { id: true, name: true, requiresQualityControl: true } } },
  });
  if (!order) throw AppError.notFound('Orden de producción no encontrada', 'ORDER_NOT_FOUND');
  if (order.qualityStatus !== 'QUARANTINE') {
    throw AppError.badRequest(
      `El lote no está en cuarentena (estado actual: ${order.qualityStatus}). Solo se libera un lote producido y pendiente de control.`,
      'LOT_NOT_IN_QUARANTINE',
    );
  }

  if (args.approve && order.product.requiresQualityControl) {
    const approved = await prisma.qualityInspection.findFirst({
      where: { companyId, productionOrderId, type: 'FINAL', status: 'PASSED' },
    });
    if (!approved) {
      throw AppError.badRequest(
        'Este producto exige control de calidad: registra una inspección final APROBADA antes de liberar el lote.',
        'QC_INSPECTION_REQUIRED',
      );
    }
  }

  const newStatus = args.approve ? 'RELEASED' : 'REJECTED';

  return prisma.$transaction(async (tx) => {
    const updated = await tx.productionOrder.update({
      where: { id: productionOrderId },
      data: {
        qualityStatus: newStatus,
        releasedBy: userId,
        releasedAt: new Date(),
        releaseNotes: args.notes,
      },
      include: { product: { select: { name: true, sku: true } } },
    });
    if (order.batchId) {
      await tx.inventoryBatch.update({
        where: { id: order.batchId },
        data: { qualityStatus: newStatus },
      });
    }
    return updated;
  });
}

/**
 * Guarda de despacho (ISO 9001 §8.6): impide entregar producto que no ha sido
 * liberado por calidad. Se llama antes de consumir stock en una venta.
 *
 * Si el producto no maneja lotes no bloquea nada (no hay control que aplicar);
 * si maneja lotes, solo cuenta como disponible el stock de lotes RELEASED.
 */
export async function assertReleasedStock(
  companyId: string,
  productId: string,
  warehouseId: string,
  quantity: number,
): Promise<void> {
  const batches = await prisma.inventoryBatch.findMany({
    where: { companyId, productId, warehouseId, isExhausted: false },
    select: { remainingQty: true, qualityStatus: true, lotNumber: true },
  });
  if (batches.length === 0) return; // producto sin control de lote

  const released = batches
    .filter((b) => b.qualityStatus === 'RELEASED')
    .reduce((s, b) => s + Number(b.remainingQty), 0);
  if (released + 1e-6 >= quantity) return;

  const bloqueados = batches.filter((b) => b.qualityStatus !== 'RELEASED');
  const detalle = bloqueados
    .map((b) => `${b.lotNumber ?? 'sin lote'} (${Number(b.remainingQty)} en ${b.qualityStatus === 'QUARANTINE' ? 'cuarentena' : 'rechazado'})`)
    .join(', ');
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { name: true } });

  throw AppError.badRequest(
    `No se puede despachar ${quantity} de ${product?.name ?? 'el producto'}: solo hay ${released} liberado(s) por calidad. Retenido: ${detalle || 'ninguno'}.`,
    'LOT_NOT_RELEASED',
  );
}

// ─── Trazabilidad (ISO 9001 §8.5.2 · ARCSA recall) ────────────

export interface TraceabilityReport {
  order: { id: string; poNumber: string; lotNumber: string | null; quantity: number;
           manufacturingDate: Date | null; expiryDate: Date | null; qualityStatus: string };
  product: { id: string; name: string; sku: string | null; sanitaryRegistry: string | null };
  /** Hacia atrás: materias primas y sus lotes/proveedores. */
  backward: { componentName: string; lotNumber: string | null; quantity: number;
              unitCost: number; totalCost: number; supplierBatch: string | null; receivedAt: Date | null }[];
  /** Hacia adelante: salidas del lote producido (a quién se le entregó → recall). */
  forward: { movementId: string; date: Date; quantity: number; reference: string | null; notes: string | null }[];
  inspections: { id: string; inspectionNumber: string; type: string; status: string; inspectedAt: Date | null }[];
  nonConformities: { id: string; ncNumber: string; severity: string; status: string; description: string }[];
}

/** Ficha completa de trazabilidad del lote: de dónde vino y a dónde fue. */
export async function getTraceability(productionOrderId: string, companyId: string): Promise<TraceabilityReport> {
  const order = await prisma.productionOrder.findFirst({
    where: { id: productionOrderId, companyId },
    include: {
      product: { select: { id: true, name: true, sku: true, sanitaryRegistry: true } },
      consumptions: { include: { component: { select: { name: true } } } },
      inspections: { select: { id: true, inspectionNumber: true, type: true, status: true, inspectedAt: true } },
      nonConformities: { select: { id: true, ncNumber: true, severity: true, status: true, description: true } },
    },
  });
  if (!order) throw AppError.notFound('Orden de producción no encontrada', 'ORDER_NOT_FOUND');

  // Datos del lote de origen (proveedor) para cada consumo
  const batchIds = order.consumptions.map((c) => c.batchId).filter((b): b is string => !!b);
  const batches = batchIds.length
    ? await prisma.inventoryBatch.findMany({
        where: { id: { in: batchIds } },
        select: { id: true, supplierBatch: true, receivedAt: true },
      })
    : [];
  const batchById = new Map(batches.map((b) => [b.id, b]));

  // Salidas del lote producido: movimientos OUT que apuntan al batch generado
  const forward = order.batchId
    ? await prisma.inventoryMovement.findMany({
        where: { companyId, batchId: order.batchId, type: { in: ['OUT', 'TRANSFER_OUT'] } },
        select: { id: true, createdAt: true, quantity: true, reference: true, notes: true },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  return {
    order: {
      id: order.id, poNumber: order.poNumber, lotNumber: order.lotNumber,
      quantity: Number(order.quantity), manufacturingDate: order.manufacturingDate,
      expiryDate: order.expiryDate, qualityStatus: order.qualityStatus,
    },
    product: order.product,
    backward: order.consumptions.map((c) => {
      const b = c.batchId ? batchById.get(c.batchId) : undefined;
      return {
        componentName: c.component.name,
        lotNumber: c.lotNumber,
        quantity: Number(c.quantity),
        unitCost: Number(c.unitCost),
        totalCost: Number(c.totalCost),
        supplierBatch: b?.supplierBatch ?? null,
        receivedAt: b?.receivedAt ?? null,
      };
    }),
    forward: forward.map((m) => ({
      movementId: m.id, date: m.createdAt, quantity: Number(m.quantity),
      reference: m.reference, notes: m.notes,
    })),
    inspections: order.inspections,
    nonConformities: order.nonConformities,
  };
}
