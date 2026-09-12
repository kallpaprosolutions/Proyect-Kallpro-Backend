import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { reserveStock, fulfillReservation } from './inventory.service';
import { assertReleasedStock } from './quality.service';
import { createSalesEntryAmounts, createCOGSEntryAmount, createSalesWithholdingEntry } from './journal.service';
import { computeWithholdings, splitBases } from './withholding.service';
import { getNextDocumentNumber } from '../utils/sequence.helper';
import { recordAudit, diffRecords } from '../utils/audit';
import { logFieldChange, postMessage } from './chatter.service';
import { getErpConfig } from './erp-config.service';
import { resolveUnitPrice } from './price-list.service';
import { computeDueDate } from '../utils/payment-terms';
import { evaluateDiscountApproval, DiscountApprovalResult } from './sales/engines/discount-approval.engine';
import { AppError } from '../utils/errors';

// Ítem de venta tal como llega del cliente (cotización o pedido).
interface RawSalesItem {
  productId: string;
  warehouseId?: string;
  description?: string;
  quantity: number;
  unitPrice?: number;   // ignorado cuando reprice=true (sale de la lista vigente)
  discount?: number;
  taxRate?: number;
}

/**
 * Construye las líneas de venta con precios y descuentos VALIDADOS.
 *
 * - `reprice=true` (cotización/pedido nuevos): el precio NO se toma del cliente, sale de la
 *   lista vigente vía resolveUnitPrice. El descuento se topa por rol (ErpConfig.sales.maxDiscountByRole).
 * - `reprice=false` (conversión cotización→pedido): se confía en los precios/descuentos ya
 *   fijados y validados en la cotización (ya pasó por esta misma validación al crearse).
 *
 * Antes, un descuento fuera de tope tiraba un error 400 y el vendedor no podía ni guardar el
 * documento. Ahora `buildPricedItems` YA NO bloquea: evalúa con el motor puro
 * `evaluateDiscountApproval` (tope de rol + venta bajo costo, protección de margen que Odoo no
 * trae de fábrica) y devuelve `approval` para que el caller decida el estado del documento
 * (DRAFT normal vs PENDING_APPROVAL enrutado a un aprobador).
 */
async function buildPricedItems(
  companyId: string,
  role: string | undefined,
  items: RawSalesItem[],
  reprice: boolean,
  actorId?: string,
) {
  let cap = 100;
  if (reprice) {
    const cfg = await getErpConfig(companyId);
    cap = cfg.sales.maxDiscountByRole[role ?? ''] ?? 0;
  }
  // Costo actual por producto (solo hace falta si se va a revalidar el margen).
  const costByProduct = new Map<string, number>();
  if (reprice) {
    const products = await prisma.product.findMany({
      where: { companyId, id: { in: items.map((i) => i.productId) } },
      select: { id: true, avgCost: true },
    });
    for (const p of products) costByProduct.set(p.id, Number(p.avgCost ?? 0));
  }
  // Auditoría (DeepSeek #3/#13): registrar si el cliente intentó forzar un precio fuera de lista.
  const priceOverrides: Array<{ productId: string; sent: number; resolved: number }> = [];
  let subtotal = 0;
  let taxAmount = 0;
  const approvalItems: Array<{ productId: string; quantity: number; unitPrice: number; discount: number; unitCost?: number }> = [];
  const itemsData = await Promise.all(items.map(async (item) => {
    const discount = item.discount ?? 0;
    const taxRate = item.taxRate ?? 0;
    const unitPrice = reprice
      ? (await resolveUnitPrice(companyId, item.productId, Number(item.quantity))).unitPrice
      : Number(item.unitPrice ?? 0);
    if (reprice && item.unitPrice != null && Math.abs(Number(item.unitPrice) - unitPrice) > 1e-6) {
      priceOverrides.push({ productId: item.productId, sent: Number(item.unitPrice), resolved: unitPrice });
    }
    if (reprice) {
      approvalItems.push({ productId: item.productId, quantity: Number(item.quantity), unitPrice, discount, unitCost: costByProduct.get(item.productId) });
    }
    const itemSubtotal = Number(item.quantity) * unitPrice * (1 - discount / 100);
    const itemTax = itemSubtotal * (taxRate / 100);
    subtotal += itemSubtotal;
    taxAmount += itemTax;
    return {
      productId: item.productId,
      warehouseId: item.warehouseId,
      description: item.description,
      quantity: new Prisma.Decimal(item.quantity),
      unitPrice: new Prisma.Decimal(unitPrice),
      discount: new Prisma.Decimal(discount),
      subtotal: new Prisma.Decimal(itemSubtotal),
      taxRate: new Prisma.Decimal(taxRate),
      taxAmount: new Prisma.Decimal(itemTax),
      total: new Prisma.Decimal(itemSubtotal + itemTax),
    };
  }));
  if (priceOverrides.length > 0) {
    await recordAudit({
      companyId, userId: actorId, action: 'UPDATE', entityType: 'SalesPricing', entityId: null,
      changes: { ignoredUnitPrices: priceOverrides } as any,
    });
  }
  const approval: DiscountApprovalResult = reprice
    ? evaluateDiscountApproval(approvalItems, cap)
    : { needsApproval: false, reasons: [] };
  return { itemsData, subtotal, taxAmount, approval };
}
// ============================================================
// CLIENTES (CRM básico)
// ============================================================

export async function getCustomers(companyId: string) {
  return prisma.customer.findMany({
    where: { companyId, isActive: true },
    orderBy: { name: 'asc' },
  });
}

export async function getCustomerById(id: string, companyId: string) {
  return prisma.customer.findFirst({
    where: { id, companyId },
    include: {
      salesOrders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, orderNumber: true, status: true, total: true, createdAt: true },
      },
    },
  });
}

export async function createCustomer(companyId: string, data: any) {
  return prisma.customer.create({
    data: {
      ...data,
      companyId,
      creditLimit: new Prisma.Decimal(data.creditLimit ?? 0),
    },
  });
}

export async function updateCustomer(id: string, companyId: string, data: any, actorId?: string) {
  const before = await prisma.customer.findFirst({ where: { id, companyId } });
  const updated = await prisma.customer.update({ where: { id }, data });
  await recordAudit({ companyId, userId: actorId, action: 'UPDATE', entityType: 'Customer', entityId: id, changes: diffRecords(before, updated) });
  return updated;
}

// ============================================================
// COTIZACIONES DE VENTA
// ============================================================

export async function getQuotations(companyId: string) {
  return prisma.salesQuotation.findMany({
    where: { companyId },
    include: { customer: true, items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getQuotationById(id: string, companyId: string) {
  return prisma.salesQuotation.findFirst({
    where: { id, companyId },
    include: { customer: true, items: { include: { product: true } }, salesOrder: true },
  });
}

export async function createQuotation(companyId: string, data: {
  customerId: string;
  validUntil?: Date;
  notes?: string;
  createdBy?: string;
  role?: string; // rol del usuario, para topar el descuento
  reprice?: boolean; // false al convertir desde cotización ya valorada (default true)
  items: Array<{
    productId: string;
    description?: string;
    quantity: number;
    unitPrice?: number;
    discount?: number;
    taxRate?: number;
  }>;
}) {
  const { itemsData: rawItems, subtotal, taxAmount, approval } =
    await buildPricedItems(companyId, data.role, data.items, data.reprice !== false, data.createdBy);
  // Las cotizaciones no llevan warehouseId en sus ítems
  const itemsData = rawItems.map(({ warehouseId, ...rest }) => rest);
  const status = approval.needsApproval ? 'PENDING_APPROVAL' : 'DRAFT';

  const quotation = await prisma.$transaction(async (tx) => {
    const quoteNumber = await getNextDocumentNumber(tx, companyId, 'SALES_QUOTATION', 'COT-');
    return tx.salesQuotation.create({
      data: {
        companyId,
        quoteNumber,
        customerId: data.customerId,
        validUntil: data.validUntil,
        notes: data.notes,
        createdBy: data.createdBy,
        status,
        subtotal: new Prisma.Decimal(subtotal),
        taxAmount: new Prisma.Decimal(taxAmount),
        total: new Prisma.Decimal(subtotal + taxAmount),
        items: { create: itemsData },
      },
      include: { customer: true, items: { include: { product: true } } },
    });
  });

  if (approval.needsApproval && data.createdBy) {
    const reasonText = describeApprovalReasons(approval, quotation.items);
    await logFieldChange(companyId, data.createdBy, 'SALES_QUOTATION', quotation.id, 'STATUS', 'DRAFT', 'PENDING_APPROVAL');
    await postMessage(companyId, data.createdBy, 'SALES_QUOTATION', quotation.id, `Enviada a aprobación: ${reasonText}`, 'NOTE');
  }
  return quotation;
}

// Motor PURO: arma el texto legible de por qué una cotización quedó pendiente de aprobación
// (para dejarlo como nota en el chatter, no solo el código crudo).
function describeApprovalReasons(approval: DiscountApprovalResult, items: Array<{ productId: string; product?: { name: string } | null }>): string {
  const nameOf = (productId: string) => items.find((i) => i.productId === productId)?.product?.name ?? productId;
  return approval.reasons.map((r) => {
    if (r.reason === 'DISCOUNT_EXCEEDS_CAP') return `${nameOf(r.productId)}: descuento ${r.discount}% supera el tope (${r.cap}%)`;
    return `${nameOf(r.productId)}: precio $${r.netUnitPrice?.toFixed(2)} queda por debajo del costo $${r.unitCost?.toFixed(2)}`;
  }).join(' · ');
}

export async function updateQuotationStatus(id: string, companyId: string, status: string) {
  const quotation = await prisma.salesQuotation.findFirst({ where: { id, companyId }, select: { status: true } });
  if (!quotation) throw new Error('QUOTATION_NOT_FOUND');
  // La transición PENDING_APPROVAL → cualquier estado solo puede hacerla approveQuotation/
  // rejectQuotation (valida el rol aprobador); este endpoint genérico no debe ser un bypass.
  if (quotation.status === 'PENDING_APPROVAL') throw new Error('QUOTATION_PENDING_APPROVAL');
  return prisma.salesQuotation.update({ where: { id }, data: { status } });
}

// El gate CASL `approve:Sales` (sales.routes.ts) ya limita esta ruta a roles de venta/dirección;
// esta segunda validación es la que de verdad importa (regla de negocio configurable en
// Ajustes → Empresa, igual que las aprobaciones por monto de CxP/CxC de la Fase 4), porque
// GERENTE_VENTAS tiene `approve:Sales` por CASL pero el ADMIN puede querer reservar la
// aprobación de márgenes solo para ADMIN/GERENTE en una empresa concreta.
async function assertCanApproveDiscount(companyId: string, role: string | undefined) {
  const cfg = await getErpConfig(companyId);
  if (!role || !cfg.sales.discountApproverRoles.includes(role)) {
    throw AppError.forbidden('Tu rol no está autorizado para aprobar cotizaciones/pedidos fuera de tope', 'DISCOUNT_APPROVAL_FORBIDDEN');
  }
}

/** Aprueba una cotización PENDING_APPROVAL → vuelve a DRAFT (lista para enviar/convertir). */
export async function approveQuotation(id: string, companyId: string, actorId: string, actorRole?: string) {
  await assertCanApproveDiscount(companyId, actorRole);
  const quotation = await prisma.salesQuotation.findFirst({ where: { id, companyId } });
  if (!quotation) throw new Error('QUOTATION_NOT_FOUND');
  if (quotation.status !== 'PENDING_APPROVAL') throw new Error('QUOTATION_NOT_PENDING');
  const updated = await prisma.salesQuotation.update({ where: { id }, data: { status: 'DRAFT' } });
  await logFieldChange(companyId, actorId, 'SALES_QUOTATION', id, 'STATUS', 'PENDING_APPROVAL', 'DRAFT');
  return updated;
}

/** Rechaza una cotización PENDING_APPROVAL, con motivo obligatorio (queda como nota en el chatter). */
export async function rejectQuotation(id: string, companyId: string, actorId: string, reason: string, actorRole?: string) {
  await assertCanApproveDiscount(companyId, actorRole);
  const quotation = await prisma.salesQuotation.findFirst({ where: { id, companyId } });
  if (!quotation) throw new Error('QUOTATION_NOT_FOUND');
  if (quotation.status !== 'PENDING_APPROVAL') throw new Error('QUOTATION_NOT_PENDING');
  const updated = await prisma.salesQuotation.update({ where: { id }, data: { status: 'REJECTED' } });
  await logFieldChange(companyId, actorId, 'SALES_QUOTATION', id, 'STATUS', 'PENDING_APPROVAL', 'REJECTED');
  await postMessage(companyId, actorId, 'SALES_QUOTATION', id, `Rechazada: ${reason}`, 'NOTE');
  return updated;
}

// ============================================================
// PEDIDOS DE VENTA
// ============================================================

export async function getSalesOrders(companyId: string) {
  return prisma.salesOrder.findMany({
    where: { companyId },
    include: {
      customer: true,
      items: { include: { product: true, warehouse: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getSalesOrderById(id: string, companyId: string) {
  const order = await prisma.salesOrder.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      quotation: true,
      items: { include: { product: true, warehouse: true } },
      invoices: true,
    },
  });
  if (!order) return null;

  // Enriquecer cada ítem con el stock físico disponible en su bodega (para el DispatchModal).
  // Los ítems de tipo SERVICIO (servicios, productos no cargados a inventario) no tienen
  // stock que chequear — availableStock queda `null` (no un 0 engañoso) para que el frontend
  // no los marque como "sin stock suficiente".
  const defaultWh = await prisma.warehouse.findFirst({ where: { companyId, isDefault: true }, select: { id: true } });
  const items = await Promise.all(order.items.map(async (it) => {
    if (it.product?.type === 'SERVICE') return { ...it, availableStock: null };
    const whId = it.warehouseId || defaultWh?.id || null;
    let availableStock = 0;
    if (whId) {
      const stock = await prisma.productStock.findUnique({
        where: { productId_warehouseId: { productId: it.productId, warehouseId: whId } },
        select: { quantity: true, reserved: true },
      });
      if (stock) {
        // Disponible para ESTE pedido = físico − reservas de OTROS pedidos.
        // Se readiciona la reserva propia del ítem (ya incluida en stock.reserved) para no
        // bloquear el despacho del stock que confirmOrder ya apartó para este mismo pedido.
        const net = Number(stock.quantity) - Number(stock.reserved) + Number(it.reservedQty ?? 0);
        availableStock = Math.max(0, net);
      }
    }
    return { ...it, availableStock };
  }));
  return { ...order, items };
}

/**
 * Recalcula el estado GLOBAL del pedido a partir de las cantidades acumuladas
 * (shippedQty / invoicedQty) de sus ítems. Idempotente. No toca DRAFT/CANCELLED ni
 * fuerza estados si aún no se ha despachado nada. Llamar tras cada despacho y facturación.
 */
export async function recalculateOrderStatus(orderId: string, companyId: string, userId?: string) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: orderId, companyId },
    select: { id: true, status: true, items: { select: { quantity: true, shippedQty: true, invoicedQty: true } } },
  });
  if (!order || order.items.length === 0) return;
  if (order.status === 'DRAFT' || order.status === 'CANCELLED' || order.status === 'PENDING_APPROVAL') return;

  const someShipped = order.items.some((it) => Number(it.shippedQty) > 1e-6);
  const fullyShipped = order.items.every((it) => Number(it.shippedQty) >= Number(it.quantity) - 1e-6);
  const someInvoiced = order.items.some((it) => Number(it.invoicedQty) > 1e-6);
  const fullyInvoiced = order.items.every((it) => Number(it.invoicedQty) >= Number(it.quantity) - 1e-6);

  // Nada despachado ni facturado todavía → sigue en fase de confirmación (CONFIRMED/PICKING)
  if (!someShipped && !someInvoiced) return;

  let next: string;
  if (fullyShipped && fullyInvoiced) next = 'COMPLETED';
  else if (fullyShipped && someInvoiced) next = 'PARTIALLY_INVOICED';
  else if (fullyShipped) next = order.status === 'DELIVERED' ? 'DELIVERED' : 'DISPATCHED';
  // Cubre tanto "despacho parcial" como "facturado sin despachar aún" (flujo de anticipo):
  // en ambos casos el pedido NO debe quedarse pegado en CONFIRMED.
  else next = 'PARTIALLY_SHIPPED';

  if (next !== order.status) {
    await prisma.salesOrder.update({ where: { id: orderId }, data: { status: next } });
    if (userId) await logFieldChange(companyId, userId, 'SALES_ORDER', orderId, 'STATUS', order.status, next);
  }
  return next;
}

export async function createSalesOrder(companyId: string, data: {
  customerId: string;
  quotationId?: string;
  deliveryDate?: Date;
  deliveryAddress?: string;
  notes?: string;
  createdBy?: string;
  role?: string; // rol del usuario, para topar el descuento
  reprice?: boolean; // false al convertir desde cotización ya valorada (default true)
  items: Array<{
    productId: string;
    warehouseId?: string;
    description?: string;
    quantity: number;
    unitPrice?: number;
    discount?: number;
    taxRate?: number;
  }>;
}) {
  const { itemsData, subtotal, taxAmount, approval } =
    await buildPricedItems(companyId, data.role, data.items, data.reprice !== false, data.createdBy);
  const status = approval.needsApproval ? 'PENDING_APPROVAL' : 'DRAFT';

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await getNextDocumentNumber(tx, companyId, 'SALES_ORDER', 'PV-');
    const created = await tx.salesOrder.create({
      data: {
        companyId,
        orderNumber,
        customerId: data.customerId,
        quotationId: data.quotationId,
        deliveryDate: data.deliveryDate,
        deliveryAddress: data.deliveryAddress,
        notes: data.notes,
        createdBy: data.createdBy,
        status,
        subtotal: new Prisma.Decimal(subtotal),
        taxAmount: new Prisma.Decimal(taxAmount),
        total: new Prisma.Decimal(subtotal + taxAmount),
        items: { create: itemsData },
      },
      include: { customer: true, items: { include: { product: true } } },
    });
    // Marcar la cotización como aceptada si viene enlazada (misma transacción)
    if (data.quotationId) {
      await tx.salesQuotation.update({ where: { id: data.quotationId }, data: { status: 'ACCEPTED' } });
    }
    return created;
  });

  if (approval.needsApproval && data.createdBy) {
    const reasonText = describeApprovalReasons(approval, order.items);
    await logFieldChange(companyId, data.createdBy, 'SALES_ORDER', order.id, 'STATUS', 'DRAFT', 'PENDING_APPROVAL');
    await postMessage(companyId, data.createdBy, 'SALES_ORDER', order.id, `Enviado a aprobación: ${reasonText}`, 'NOTE');
  }
  return order;
}

/** Aprueba un pedido de venta PENDING_APPROVAL (creado directo, sin cotización) → vuelve a DRAFT. */
export async function approveSalesOrder(id: string, companyId: string, actorId: string, actorRole?: string) {
  await assertCanApproveDiscount(companyId, actorRole);
  const order = await prisma.salesOrder.findFirst({ where: { id, companyId } });
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (order.status !== 'PENDING_APPROVAL') throw new Error('ORDER_NOT_PENDING');
  const updated = await prisma.salesOrder.update({ where: { id }, data: { status: 'DRAFT' } });
  await logFieldChange(companyId, actorId, 'SALES_ORDER', id, 'STATUS', 'PENDING_APPROVAL', 'DRAFT');
  return updated;
}

/** Rechaza un pedido de venta PENDING_APPROVAL → CANCELLED, con motivo en el chatter. */
export async function rejectSalesOrder(id: string, companyId: string, actorId: string, reason: string, actorRole?: string) {
  await assertCanApproveDiscount(companyId, actorRole);
  const order = await prisma.salesOrder.findFirst({ where: { id, companyId } });
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (order.status !== 'PENDING_APPROVAL') throw new Error('ORDER_NOT_PENDING');
  const updated = await prisma.salesOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
  await logFieldChange(companyId, actorId, 'SALES_ORDER', id, 'STATUS', 'PENDING_APPROVAL', 'CANCELLED');
  await postMessage(companyId, actorId, 'SALES_ORDER', id, `Rechazado: ${reason}`, 'NOTE');
  return updated;
}

export async function convertQuotationToOrder(quotationId: string, companyId: string, createdBy?: string) {
  const quotation = await prisma.salesQuotation.findFirst({
    where: { id: quotationId, companyId },
    include: { items: true, salesOrder: true },
  });
  if (!quotation) throw new Error('QUOTATION_NOT_FOUND');
  if (quotation.salesOrder) throw new Error('ALREADY_CONVERTED');
  if (quotation.status === 'PENDING_APPROVAL') throw new Error('QUOTATION_PENDING_APPROVAL');
  if (quotation.status === 'EXPIRED' || (quotation.validUntil && quotation.validUntil < new Date())) {
    throw new Error('QUOTATION_EXPIRED');
  }

  return createSalesOrder(companyId, {
    customerId: quotation.customerId,
    quotationId: quotation.id,
    notes: quotation.notes ?? undefined,
    createdBy,
    reprice: false, // los precios/descuentos ya fueron fijados y validados en la cotización
    items: quotation.items.map(item => ({
      productId: item.productId,
      description: item.description ?? undefined,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
      taxRate: Number(item.taxRate),
    })),
  });
}

// CONFIRMAR pedido → reserva stock (los ítems tipo SERVICIO, servicios o productos no
// cargados a inventario, no reservan nada — ver el loop de abajo).
export async function confirmOrder(orderId: string, companyId: string, userId?: string) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: orderId, companyId },
    include: { items: { include: { product: true } } },
  });
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (order.status !== 'DRAFT') throw new Error('INVALID_STATUS');

  // ── Validación de límite de crédito (config: sales.enforceCreditLimit) ──
  // creditLimit <= 0 se interpreta como "sin límite definido" → no bloquea.
  const cfg = await getErpConfig(companyId);
  const customer = await prisma.customer.findFirst({ where: { id: order.customerId, companyId } });
  const creditLimit = Number(customer?.creditLimit ?? 0);
  if (cfg.sales.enforceCreditLimit && creditLimit > 0) {
    // Cartera = facturas de venta no pagadas (vía pedido) + pedidos confirmados aún sin facturar
    const unpaid = await prisma.invoice.findMany({
      where: { companyId, type: 'SALES', status: { notIn: ['PAID', 'CANCELLED', 'DRAFT'] }, salesOrder: { customerId: order.customerId } },
      select: { totalAmount: true, paidAmount: true },
    });
    // Saldo de facturas = totalAmount - paidAmount (no hay columna outstandingBalance en Invoice)
    const outstandingInvoices = unpaid.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0);
    const confirmedNotInvoiced = await prisma.salesOrder.aggregate({
      where: { companyId, customerId: order.customerId, status: 'CONFIRMED', invoices: { none: {} }, id: { not: order.id } },
      _sum: { total: true },
    });
    const pendingOrdersTotal = Number(confirmedNotInvoiced._sum.total ?? 0);
    const exposure = outstandingInvoices + pendingOrdersTotal + Number(order.total);
    if (exposure > creditLimit) {
      throw new Error(`CREDIT_LIMIT_EXCEEDED:${exposure.toFixed(2)}:${creditLimit.toFixed(2)}`);
    }
  }

  // Get default warehouse for products without specific warehouse
  const defaultWarehouse = await prisma.warehouse.findFirst({
    where: { companyId, isDefault: true },
  });

  for (const item of order.items) {
    // Servicio / producto no cargado a inventario: no hay stock que reservar. Se marca
    // reservado (para que el pedido pueda avanzar y facturarse) pero sin bodega ni movimiento —
    // dispatchOrder ya se salta bodega=null para el chequeo de calidad y el consumo de stock.
    if (item.product.type === 'SERVICE') {
      await prisma.salesOrderItem.update({ where: { id: item.id }, data: { reservedQty: item.quantity } });
      continue;
    }
    const warehouseId = item.warehouseId || defaultWarehouse?.id;
    if (!warehouseId) continue;
    try {
      await reserveStock(companyId, {
        productId: item.productId,
        warehouseId,
        quantity: Number(item.quantity),
        reference: order.orderNumber,
      });
      // Update item with warehouse and reserved qty
      await prisma.salesOrderItem.update({
        where: { id: item.id },
        data: {
          warehouseId,
          reservedQty: item.quantity,
        },
      });
    } catch (e: any) {
      throw new Error(`STOCK_ERROR:${item.productId}:${e.message}`);
    }
  }

  const updated = await prisma.salesOrder.update({
    where: { id: orderId },
    data: { status: 'CONFIRMED' },
    include: { customer: true, items: { include: { product: true } } },
  });
  if (userId) await logFieldChange(companyId, userId, 'SALES_ORDER', orderId, 'STATUS', order.status, 'CONFIRMED');
  return updated;
}

// DESPACHAR pedido (total o PARCIAL) → consume reservas + crea GUÍA DE ENVÍO con sus líneas.
// `dispatchItems` opcional: si se omite, despacha TODO lo restante; si se indica, solo esas
// cantidades. La FACTURA se emite por envío cuando éste se marca DELIVERED (ver invoiceShipment).
export interface DispatchItemInput { salesOrderItemId: string; quantity: number }

export async function dispatchOrder(
  orderId: string,
  companyId: string,
  createdBy?: string,
  dispatchItems?: DispatchItemInput[],
) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: orderId, companyId },
    include: { items: { include: { product: true } }, customer: true },
  });
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (!['CONFIRMED', 'PICKING', 'PARTIALLY_SHIPPED'].includes(order.status)) throw new Error('INVALID_STATUS');

  // El despacho PARCIAL (envío con cantidades específicas) requiere habilitarlo en Configuración.
  if (dispatchItems && dispatchItems.length > 0) {
    const cfg = await getErpConfig(companyId);
    if (!cfg.sales.allowPartialDispatch) throw new Error('PARTIAL_DISPATCH_DISABLED');
  }

  const remainingOf = (it: (typeof order.items)[number]) => Number(it.quantity) - Number(it.shippedQty);

  // Resolver qué se despacha: explícito (parcial) o todo lo restante
  let toShip: Array<{ item: (typeof order.items)[number]; qty: number }>;
  if (dispatchItems && dispatchItems.length > 0) {
    toShip = dispatchItems.map((d) => {
      const it = order.items.find((x) => x.id === d.salesOrderItemId);
      if (!it) throw new Error(`ITEM_NOT_FOUND:${d.salesOrderItemId}`);
      if (d.quantity <= 0) throw new Error('INVALID_QTY');
      if (d.quantity > remainingOf(it) + 1e-6) throw new Error(`QTY_EXCEEDS_REMAINING:${it.id}`);
      return { item: it, qty: d.quantity };
    });
  } else {
    toShip = order.items.map((it) => ({ item: it, qty: remainingOf(it) })).filter((x) => x.qty > 1e-6);
  }
  if (toShip.length === 0) throw new Error('NOTHING_TO_SHIP');

  // Calidad (ISO 9001 §8.6): no se entrega producto sin liberar. Se valida ANTES de
  // consumir stock para no dejar el despacho a medias (Sprint 12).
  for (const { item, qty } of toShip) {
    if (!item.warehouseId) continue;
    await assertReleasedStock(companyId, item.productId, item.warehouseId, qty);
  }

  // Consumir reservas (movimientos OUT) por la cantidad despachada de cada ítem.
  // El movimiento devuelve el costo REAL del método de valoración (capas FIFO/LIFO o
  // promedio) — se captura por línea para que la factura de este envío contabilice el
  // COGS exacto (fix doc 23).
  const dispatchCost = new Map<string, number>(); // salesOrderItemId → unitCost real
  for (const { item, qty } of toShip) {
    if (!item.warehouseId) continue;
    try {
      const movement = await fulfillReservation(companyId, {
        productId: item.productId,
        warehouseId: item.warehouseId,
        quantity: qty,
        reference: order.orderNumber,
        notes: `Despacho ${order.orderNumber}`,
        createdBy,
      });
      if (movement) dispatchCost.set(item.id, Number((movement as any).unitCost ?? 0));
    } catch { /* continue even if stock already moved */ }
  }

  // Crear el envío con sus líneas (tracking atómico) y acumular shippedQty
  await prisma.$transaction(async (tx) => {
    const trackingNumber = await getNextDocumentNumber(tx, companyId, 'SHIPMENT', 'KP-', 8);
    await tx.shipment.create({
      data: {
        companyId,
        orderType: 'SALES',
        orderId: order.id,
        trackingNumber,
        status: 'DISPATCHED',
        destAddress: order.deliveryAddress ?? null,
        recipientName: order.customer?.razonSocial || order.customer?.name || null,
        recipientPhone: order.customer?.phone ?? null,
        createdBy,
        events: { create: { status: 'DISPATCHED', notes: `Despacho ${order.orderNumber}`, createdBy } },
        items: {
          create: toShip.map(({ item, qty }) => ({
            salesOrderItemId: item.id,
            productId: item.productId,
            quantity: new Prisma.Decimal(qty),
            unitCost: new Prisma.Decimal(dispatchCost.get(item.id) ?? 0),
          })),
        },
      },
    });
    for (const { item, qty } of toShip) {
      await tx.salesOrderItem.update({ where: { id: item.id }, data: { shippedQty: { increment: qty } } });
    }
  });

  // Recalcular el estado global del pedido según cantidades acumuladas
  await recalculateOrderStatus(order.id, companyId, createdBy);
  return prisma.salesOrder.findFirst({
    where: { id: orderId, companyId },
    include: { customer: true, items: { include: { product: true } } },
  });
}

// Emite la factura de venta de UN ENVÍO específico (idempotente por shipmentId).
// Factura solo las cantidades de ese envío (Shipment.items). Si el envío no tiene líneas
// (envío manual/legacy), factura lo que falte por facturar del pedido. Los asientos
// contables se posean una sola vez, cuando el pedido queda totalmente facturado.
export async function invoiceSalesOrder(companyId: string, shipmentId: string, createdBy?: string) {
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, companyId, orderType: 'SALES' },
    include: { items: true },
  });
  if (!shipment) throw new Error('SHIPMENT_NOT_FOUND');

  // Idempotente: si ya existe factura para este envío, devolverla
  const existing = await prisma.invoice.findFirst({ where: { companyId, shipmentId } });
  if (existing) return existing;

  const order = await prisma.salesOrder.findFirst({
    where: { id: shipment.orderId, companyId },
    include: { items: { include: { product: true } }, customer: true },
  });
  if (!order) throw new Error('ORDER_NOT_FOUND');

  // Determinar líneas a facturar. `dispatchUnitCost` es el costo real capturado al
  // despachar (capas FIFO/LIFO o promedio) — 0 en envíos legados → fallback a avgCost.
  let lines: Array<{ orderItem: (typeof order.items)[number]; qty: number; dispatchUnitCost: number }>;
  if (shipment.items.length > 0) {
    lines = shipment.items.map((si) => {
      const oi = order.items.find((x) => x.id === si.salesOrderItemId);
      if (!oi) throw new Error('SHIPMENT_ITEM_ORPHAN');
      return { orderItem: oi, qty: Number(si.quantity), dispatchUnitCost: Number(si.unitCost ?? 0) };
    });
  } else {
    lines = order.items
      .map((oi) => ({ orderItem: oi, qty: Number(oi.quantity) - Number(oi.invoicedQty), dispatchUnitCost: 0 }))
      .filter((l) => l.qty > 1e-6);
  }
  if (lines.length === 0) return null; // nada por facturar

  // Montos de ESTE envío (proporcionales a las cantidades facturadas)
  let invoiceSubtotal = 0;
  let invoiceTax = 0;
  let shipmentCogs = 0;
  const invItems = lines.map(({ orderItem, qty, dispatchUnitCost }) => {
    const sub = qty * Number(orderItem.unitPrice) * (1 - Number(orderItem.discount) / 100);
    const tax = sub * (Number(orderItem.taxRate) / 100);
    invoiceSubtotal += sub;
    invoiceTax += tax;
    // COGS: costo real del despacho si se capturó; si no (legado), avgCost del producto
    shipmentCogs += qty * (dispatchUnitCost > 0 ? dispatchUnitCost : Number(orderItem.product?.avgCost ?? 0));
    return {
      description: orderItem.description || orderItem.product.name,
      quantity: Math.round(qty),
      unitPrice: orderItem.unitPrice,
      lineTotal: new Prisma.Decimal(sub + tax),
    };
  });
  const invoiceTotal = invoiceSubtotal + invoiceTax;

  // ── Retenciones de venta de ESTE envío (el cliente nos retiene IVA/Renta) ──
  // Base de Renta separada por bienes/servicios (mejora DeepSeek #1).
  const bases = splitBases(
    lines,
    ({ orderItem }) => orderItem.product?.type,
    ({ orderItem, qty }) => qty * Number(orderItem.unitPrice) * (1 - Number(orderItem.discount) / 100),
    ({ orderItem, qty }) => qty * Number(orderItem.unitPrice) * (1 - Number(orderItem.discount) / 100) * (Number(orderItem.taxRate) / 100),
  );
  const withholdings = await computeWithholdings(companyId, order.customerId, bases);
  const totalWithheld = Math.round(withholdings.reduce((s, w) => s + w.valor, 0) * 100) / 100;

  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await getNextDocumentNumber(tx, companyId, 'SALES_INVOICE', 'FAC-V-');
    const inv = await tx.invoice.create({
      data: {
        companyId,
        number: invoiceNumber,
        type: 'SALES',
        status: 'SENT',
        totalAmount: new Prisma.Decimal(invoiceTotal),
        // La retención es un anticipo de impuesto liquidado al emitir: se trata como pago
        // inmediato, de modo que el saldo cobrable (totalAmount - paidAmount) sea el NETO.
        paidAmount: new Prisma.Decimal(totalWithheld),
        issueDate: new Date(),
        // Si el cliente no tiene plazo configurado, se mantiene el default histórico de 30 días.
        dueDate: computeDueDate(new Date(), order.customer?.paymentTerms ?? '30_DIAS'),
        notes: `Pedido ${order.orderNumber} · Envío ${shipment.trackingNumber} - ${order.customer.name}`,
        salesOrderId: order.id,
        shipmentId: shipment.id,
        items: { create: invItems },
        withholdings: { create: withholdings.map((w) => ({
          tipo: w.tipo, codigo: w.codigo, descripcion: w.descripcion,
          baseImponible: new Prisma.Decimal(w.baseImponible), porcentaje: new Prisma.Decimal(w.porcentaje), valor: new Prisma.Decimal(w.valor),
        })) },
      },
    });
    for (const { orderItem, qty } of lines) {
      await tx.salesOrderItem.update({ where: { id: orderItem.id }, data: { invoicedQty: { increment: qty } } });
    }
    return inv;
  });

  // Asientos contables PROPORCIONALES a este envío (uno por factura, no solo al final)
  const ref = `Venta ${order.orderNumber} · Envío ${shipment.trackingNumber}`;
  try { await createSalesEntryAmounts(companyId, { description: ref, entityType: 'SALES_INVOICE', entityId: invoice.id, subtotal: invoiceSubtotal, tax: invoiceTax, total: invoiceTotal }); }
  catch (e) { logger.warn('[sales] createSalesEntryAmounts failed (non-fatal)', { err: e }); }
  try { await createCOGSEntryAmount(companyId, { description: `Costo · ${ref}`, entityType: 'SALES_INVOICE', entityId: invoice.id, cogs: shipmentCogs }); }
  catch (e) { logger.warn('[sales] createCOGSEntryAmount failed (non-fatal)', { err: e }); }
  // Asiento de retención: DR crédito tributario (activo) / CR CxC (baja la cuenta al neto)
  if (totalWithheld > 0) {
    const retRenta = withholdings.filter((w) => w.tipo === 'RENTA').reduce((s, w) => s + w.valor, 0);
    const retIva = withholdings.filter((w) => w.tipo === 'IVA').reduce((s, w) => s + w.valor, 0);
    try { await createSalesWithholdingEntry(companyId, { description: ref, entityId: invoice.id, retRenta, retIva }); }
    catch (e) { logger.warn('[sales] createSalesWithholdingEntry failed (non-fatal)', { err: e }); }
  }

  // Mantener el estado del pedido sincronizado con lo facturado
  try { await recalculateOrderStatus(order.id, companyId, createdBy); }
  catch (e) { logger.warn('[sales] recalculateOrderStatus failed (non-fatal)', { err: e }); }

  return invoice;
}

// ============================================================
// KPIs DE VENTAS
// ============================================================

export async function getSalesKPIs(companyId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalOrders,
    pendingOrders,
    monthlyRevenue,
    totalCustomers,
  ] = await Promise.all([
    prisma.salesOrder.count({ where: { companyId } }),
    prisma.salesOrder.count({ where: { companyId, status: { in: ['DRAFT', 'CONFIRMED', 'PICKING'] } } }),
    prisma.salesOrder.aggregate({
      where: { companyId, status: { in: ['DISPATCHED', 'DELIVERED', 'INVOICED'] }, createdAt: { gte: startOfMonth } },
      _sum: { total: true },
    }),
    prisma.customer.count({ where: { companyId, isActive: true } }),
  ]);

  const topCustomers = await prisma.salesOrder.groupBy({
    by: ['customerId'],
    where: { companyId, status: { in: ['DISPATCHED', 'DELIVERED', 'INVOICED'] } },
    _sum: { total: true },
    orderBy: { _sum: { total: 'desc' } },
    take: 5,
  });

  const customerIds = topCustomers.map(c => c.customerId);
  const customers = await prisma.customer.findMany({ where: { id: { in: customerIds } } });
  const topCustomersList = topCustomers.map(tc => ({
    ...tc,
    customer: customers.find(c => c.id === tc.customerId),
  }));

  return {
    totalOrders,
    pendingOrders,
    monthlyRevenue: Number(monthlyRevenue._sum.total ?? 0),
    totalCustomers,
    topCustomers: topCustomersList,
  };
}
