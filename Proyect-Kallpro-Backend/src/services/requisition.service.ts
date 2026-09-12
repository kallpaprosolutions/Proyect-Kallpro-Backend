import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { checkBudgetAvailability, updateConsumed } from './budget.service';
import { getErpConfig } from './erp-config.service';
import { getNextDocumentNumber } from '../utils/sequence.helper';
import { logFieldChange } from './chatter.service';
// ============================================================
// LISTAR Y OBTENER
// ============================================================

export async function getRequisitions(companyId: string, status?: string) {
  return prisma.requisition.findMany({
    where: { companyId, ...(status ? { status } : {}) },
    include: {
      department: true,
      items: { include: { product: true } },
      quotations: { include: { supplier: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getRequisitionById(id: string, companyId: string) {
  return prisma.requisition.findFirst({
    where: { id, companyId },
    include: {
      department: true,
      items: {
        include: { product: true, quotationItems: { include: { quotation: { include: { supplier: true } } } } },
      },
      quotations: {
        include: { supplier: true, items: { include: { requisitionItem: true } } },
      },
      purchaseOrders: { include: { supplier: true } },
    },
  });
}

// ============================================================
// CREAR REQUISICIÓN
// ============================================================

export async function createRequisition(
  companyId: string,
  data: {
    title: string;
    notes?: string;
    priority?: string;
    departmentId?: string;
    requestedBy: string;
    neededBy?: string; // fecha para la cual se necesita el material (deadline operativo)
    scoringCriteria?: any;
    items: {
      description: string;
      productId?: string;
      quantity: number;
      unit?: string;
      estimatedCost?: number;
      notes?: string;
    }[];
  },
) {
  const cfg = await getErpConfig(companyId);

  const totalEstimated = data.items.reduce((s, i) => s + (i.estimatedCost ?? 0) * i.quantity, 0);

  // Verificar presupuesto disponible
  const budgetCheck = await checkBudgetAvailability(companyId, data.departmentId, totalEstimated);
  const budgetExceeded = !budgetCheck.available && budgetCheck.budget > 0;

  const req = await prisma.$transaction(async (tx) => {
    const reqNumber = await getNextDocumentNumber(tx, companyId, 'REQUISITION', cfg.documents.reqPrefix);
    return tx.requisition.create({
      data: {
        companyId,
        reqNumber,
        title: data.title,
        notes: data.notes,
        priority: data.priority ?? 'NORMAL',
        departmentId: data.departmentId,
        requestedBy: data.requestedBy,
        status: 'PENDING_L1', // se envía directamente a aprobación
        totalEstimated: new Prisma.Decimal(totalEstimated),
        budgetExceeded,
        neededBy: data.neededBy ? new Date(data.neededBy) : undefined,
        scoringCriteria: data.scoringCriteria ?? undefined,
        items: {
          create: data.items.map((item) => ({
            description: item.description,
            productId: item.productId,
            quantity: new Prisma.Decimal(item.quantity),
            unit: item.unit ?? 'UNIDAD',
            estimatedCost: new Prisma.Decimal(item.estimatedCost ?? 0),
            notes: item.notes,
          })),
        },
      },
      include: {
        department: true,
        items: { include: { product: true } },
      },
    });
  });

  return { requisition: req, budgetCheck };
}

// ============================================================
// APROBAR REQUISICIÓN (niveles 1, 2 o 3)
// ============================================================

export async function approveRequisition(
  id: string,
  companyId: string,
  level: 1 | 2 | 3,
  approverId: string,
  notes?: string,
) {
  const req = await prisma.requisition.findFirst({ where: { id, companyId } });
  if (!req) throw new Error('Requisición no encontrada');

  const expectedStatus = level === 1 ? 'PENDING_L1' : level === 2 ? 'PENDING_L2' : 'PENDING_L3';
  if (req.status !== expectedStatus) {
    throw new Error(`La requisición no está en estado ${expectedStatus}`);
  }

  // Determinar siguiente estado
  let nextStatus: string;
  if (level === 1) {
    // L1 → L2 siempre (L2 decide si escala a gerencia)
    nextStatus = 'PENDING_L2';
  } else if (level === 2) {
    // L2 → L3 si excede presupuesto, si no → APPROVED
    nextStatus = req.budgetExceeded ? 'PENDING_L3' : 'APPROVED';
  } else {
    // L3 → siempre APPROVED
    nextStatus = 'APPROVED';
  }

  const updateData: any = { status: nextStatus };
  if (level === 1) { updateData.l1ApproverId = approverId; updateData.l1ApprovedAt = new Date(); updateData.l1Notes = notes; }
  if (level === 2) { updateData.l2ApproverId = approverId; updateData.l2ApprovedAt = new Date(); updateData.l2Notes = notes; }
  if (level === 3) { updateData.l3ApproverId = approverId; updateData.l3ApprovedAt = new Date(); updateData.l3Notes = notes; }

  const updated = await prisma.requisition.update({
    where: { id },
    data: updateData,
    include: { department: true, items: { include: { product: true } } },
  });
  await logFieldChange(companyId, approverId, 'REQUISITION', id, 'STATUS', req.status, nextStatus);
  return updated;
}

// ============================================================
// RECHAZAR REQUISICIÓN
// ============================================================

export async function rejectRequisition(
  id: string,
  companyId: string,
  rejectedBy: string,
  reason: string,
) {
  const req = await prisma.requisition.findFirst({ where: { id, companyId } });
  if (!req) throw new Error('Requisición no encontrada');
  if (!['PENDING_L1', 'PENDING_L2', 'PENDING_L3'].includes(req.status)) {
    throw new Error('Solo se pueden rechazar requisiciones en estado pendiente');
  }

  const updated = await prisma.requisition.update({
    where: { id },
    data: { status: 'REJECTED', rejectedBy, rejectedAt: new Date(), rejectionReason: reason },
  });
  await logFieldChange(companyId, rejectedBy, 'REQUISITION', id, 'STATUS', req.status, 'REJECTED');
  return updated;
}

// ============================================================
// COTIZACIONES
// ============================================================

export async function getQuotationsForRequisition(requisitionId: string, companyId: string) {
  return prisma.supplierQuotation.findMany({
    where: { requisitionId, companyId },
    include: {
      supplier: true,
      items: { include: { requisitionItem: true } },
    },
    orderBy: { totalAmount: 'asc' },
  });
}

export async function createQuotation(
  companyId: string,
  requisitionId: string,
  userId: string,
  data: {
    supplierId: string;
    quoteNumber?: string;
    validUntil?: Date;
    deliveryDays?: number;
    paymentTerms?: string;
    notes?: string;
    items: {
      requisitionItemId: string;
      description: string;
      quantity: number;
      unitPrice: number;
      brand?: string;
      notes?: string;
    }[];
  },
) {
  // Máximo 3 cotizaciones por requisición
  const count = await prisma.supplierQuotation.count({ where: { requisitionId, companyId } });
  if (count >= 3) throw new Error('QUOTATION_LIMIT: Solo se permiten hasta 3 cotizaciones por requisición');

  const req = await prisma.requisition.findFirst({ where: { id: requisitionId, companyId } });
  if (!req) throw new Error('Requisición no encontrada');
  if (!['APPROVED', 'QUOTED'].includes(req.status)) throw new Error('La requisición debe estar en estado APPROVED para agregar cotizaciones');

  const totalAmount = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const quotation = await prisma.supplierQuotation.create({
    data: {
      companyId,
      requisitionId,
      supplierId: data.supplierId,
      quoteNumber: data.quoteNumber,
      validUntil: data.validUntil,
      deliveryDays: data.deliveryDays,
      paymentTerms: data.paymentTerms,
      notes: data.notes,
      totalAmount: new Prisma.Decimal(totalAmount),
      items: {
        create: data.items.map((item) => ({
          requisitionItemId: item.requisitionItemId,
          description: item.description,
          quantity: new Prisma.Decimal(item.quantity),
          unitPrice: new Prisma.Decimal(item.unitPrice),
          lineTotal: new Prisma.Decimal(item.quantity * item.unitPrice),
          brand: item.brand,
          notes: item.notes,
        })),
      },
    },
    include: { supplier: true, items: { include: { requisitionItem: true } } },
  });

  // Actualizar estado de la requisición a QUOTED
  if (req.status !== 'QUOTED') {
    await prisma.requisition.update({ where: { id: requisitionId }, data: { status: 'QUOTED' } });
    await logFieldChange(companyId, userId, 'REQUISITION', requisitionId, 'STATUS', req.status, 'QUOTED');
  }

  return quotation;
}

// ============================================================
// SELECCIONAR GANADOR → CREAR OC
// ============================================================

export async function selectWinnerAndCreatePO(
  requisitionId: string,
  quotationId: string,
  companyId: string,
  userId: string,
  overrideReason?: string,
) {
  const req = await prisma.requisition.findFirst({
    where: { id: requisitionId, companyId },
    include: { items: true },
  });
  if (!req) throw new Error('Requisición no encontrada');

  // Mínimo de cotizaciones configurable (Config → Empresa → Compras) antes de elegir ganador
  const cfg = await getErpConfig(companyId);
  const minQuotations = cfg.purchases.minQuotations;
  const quotationCount = await prisma.supplierQuotation.count({ where: { requisitionId, companyId } });
  if (quotationCount < minQuotations) {
    throw new Error(`MIN_QUOTATIONS: Se requieren al menos ${minQuotations} cotizaciones de proveedores antes de seleccionar al ganador (cargadas: ${quotationCount}/${minQuotations})`);
  }

  const quotation = await prisma.supplierQuotation.findFirst({
    where: { id: quotationId, requisitionId, companyId },
    include: { items: { include: { requisitionItem: true } }, supplier: true },
  });
  if (!quotation) throw new Error('Cotización no encontrada');

  // El anticipo exigido por el proveedor ganador se hereda en la OC
  const advancePercent = Math.max(0, Math.min(100, quotation.advanceRequiredPct ?? 0));
  const advanceAmount = (Number(quotation.totalAmount) * advancePercent) / 100;

  // Crear OC basada en la cotización ganadora (numeración atómica, mismo correlativo que compras)
  const po = await prisma.$transaction(async (tx) => {
    const poNumber = await getNextDocumentNumber(tx, companyId, 'PURCHASE_ORDER', cfg.documents.poPrefix);
    return tx.purchaseOrder.create({
      data: {
        companyId,
        supplierId: quotation.supplierId,
        poNumber,
        status: 'DRAFT',
        totalAmount: quotation.totalAmount,
        advancePercent,
        advanceAmount: new Prisma.Decimal(advanceAmount),
        advanceStatus: advancePercent > 0 ? 'PENDING' : 'NONE',
        requisitionId: req.id,
        notes: `Generada desde Requisición ${req.reqNumber}${overrideReason ? ` · Override: ${overrideReason}` : ''}`,
        items: {
          // POItem no tiene `description`; arrastramos productId desde el ítem de
          // requisición para que la recepción mueva inventario correctamente.
          create: quotation.items.map((qi) => ({
            productId: qi.requisitionItem?.productId ?? null,
            quantity: Number(qi.quantity),
            unitPrice: qi.unitPrice,
            lineTotal: qi.lineTotal,
          })),
        },
      },
      include: { supplier: true, items: true },
    });
  });

  // Marcar cotización ganadora
  await prisma.supplierQuotation.update({ where: { id: quotationId }, data: { isWinner: true } });

  // Actualizar estado de la requisición
  await prisma.requisition.update({ where: { id: requisitionId }, data: { status: 'PO_CREATED' } });
  await logFieldChange(companyId, userId, 'REQUISITION', requisitionId, 'STATUS', req.status, 'PO_CREATED');

  // Actualizar presupuesto consumido
  const now = new Date();
  await updateConsumed(
    companyId,
    req.departmentId,
    now.getFullYear(),
    now.getMonth() + 1,
    Number(quotation.totalAmount),
  );

  return { purchaseOrder: po, quotation };
}
