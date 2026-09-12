import { prisma } from '../lib/prisma';
import { DEFAULT_MAPPINGS } from './finance/accounting.service';
import { assertPeriodOpen } from './finance/fiscal-period.service';
import { getNextDocumentNumber } from '../utils/sequence.helper';
// ─── Resolver de cuentas (posting setup configurable) ─────────
// Lee AccountMapping de la empresa; si no existe usa el default Supercías.
async function acct(companyId: string, key: string): Promise<{ code: string; name: string }> {
  const m = await prisma.accountMapping.findUnique({
    where: { companyId_key: { companyId, key } },
  });
  if (m) return { code: m.accountCode, name: m.accountName };
  const d = DEFAULT_MAPPINGS.find((x) => x.key === key);
  if (d) return { code: d.accountCode, name: d.accountName };
  throw new Error(`Configuración de cuenta no encontrada para '${key}'`);
}

// ─── Auto-number entries ──────────────────────────────────────
// Punto único por el que pasa TODO asiento nuevo: aquí se valida que el período
// fiscal de la fecha del asiento esté abierto (cierre contable, Sprint 6).
// Los asientos automáticos se fechan "hoy"; el manual pasa su fecha propia.
async function nextEntryNumber(companyId: string, entryDate: Date = new Date()): Promise<string> {
  await assertPeriodOpen(companyId, entryDate);
  // Numeración atómica en su propia transacción (independiente del asiento; nunca duplica).
  return prisma.$transaction((tx) => getNextDocumentNumber(tx, companyId, 'JOURNAL_ENTRY', 'AST-'));
}

// ─── PO Receipt Entry ─────────────────────────────────────────
// DR Inventario (1110)        ← totalAmount
//   CR IVA Crédito (1120)     ← estimated IVA (12% of subtotal, if items exist)
//   CR Cuentas por Pagar (2110) ← subtotal (totalAmount - ivaAmount)
export async function createPOReceiptEntry(companyId: string, poId: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where:   { id: poId, companyId },
    include: { supplier: { select: { name: true } }, items: true },
  });
  if (!po) throw new Error('OC no encontrada');

  const totalAmount = Number(po.totalAmount);

  // Estimate IVA (12%) from SRI document if available, else assume 0 IVA for simplicity
  const sriDoc = await prisma.sriDocument.findFirst({
    where: { purchaseOrderId: poId, companyId, status: 'CONFIRMED' },
  });
  const ivaAmount   = sriDoc ? Number(sriDoc.iva ?? 0) : 0;
  const subtotalNet = totalAmount - ivaAmount;

  const [INV, IVAC, AP] = await Promise.all([
    acct(companyId, 'INVENTORY'), acct(companyId, 'IVA_CREDIT'), acct(companyId, 'AP'),
  ]);
  const entryNumber = await nextEntryNumber(companyId);

  return prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      description: `Recepción OC ${po.poNumber} - ${po.supplier.name}`,
      entityType:  'PURCHASE_ORDER',
      entityId:    poId,
      totalDebit:  totalAmount,
      totalCredit: totalAmount,
      lines: {
        create: [
          {
            accountCode: INV.code,
            accountName: INV.name,
            debit:       subtotalNet,
            credit:      0,
            description: `Mercadería recibida OC ${po.poNumber}`,
          },
          ...(ivaAmount > 0 ? [{
            accountCode: IVAC.code,
            accountName: IVAC.name,
            debit:       ivaAmount,
            credit:      0,
            description: `IVA crédito fiscal OC ${po.poNumber}`,
          }] : []),
          {
            accountCode: AP.code,
            accountName: AP.name,
            debit:       0,
            credit:      totalAmount,
            description: `Obligación con ${po.supplier.name}`,
          },
        ],
      },
    },
    include: { lines: true },
  });
}

// ─── Direct Purchase Entry (factura de compra SIN orden de compra vinculada) ──
// DR Inventario (proporción de ítems PRODUCTO)
// DR Gasto — PURCHASE_EXPENSE (proporción de ítems SERVICIO)
// DR IVA Crédito Tributario        ← doc.iva
//   CR Cuentas por Pagar           ← doc.total
//
// Cierra un gap real: antes, confirmar una factura de compra SIN OC actualizaba el
// inventario físico (registerMovement) pero NUNCA generaba el pasivo/gasto contable — el
// saldo de CxP que mostraba el aging no tenía contrapartida en el mayor. Con OC, el pasivo
// ya lo registra createPOReceiptEntry en la recepción; esta función cubre el caso sin OC.
const round2 = (n: number) => Math.round(n * 100) / 100;

async function computeDirectPurchaseLines(companyId: string, doc: {
  id: string; numeroDoc: string | null; claveAcceso: string; total: any; iva: any;
  razonSocialEmisor: string | null; supplier?: { razonSocial: string | null; name: string | null } | null;
  items: { tipoItem: string; precioTotal: any }[];
}) {
  const total = Number(doc.total);
  const iva = Number(doc.iva ?? 0);
  const net = round2(total - iva);

  const productSum = doc.items.filter((i) => i.tipoItem === 'PRODUCTO').reduce((s, i) => s + Number(i.precioTotal), 0);
  const serviceSum = doc.items.filter((i) => i.tipoItem === 'SERVICIO').reduce((s, i) => s + Number(i.precioTotal), 0);
  const itemsSum = productSum + serviceSum;

  // Proporción sobre el neto real del documento (no la suma de líneas) — el remanente
  // absorbe redondeo y descuentos de cabecera, garantizando que inventario+gasto = neto.
  let inventoryAmount = 0, expenseAmount = 0;
  if (itemsSum > 0) {
    inventoryAmount = round2(net * (productSum / itemsSum));
    expenseAmount = round2(net - inventoryAmount);
  } else {
    expenseAmount = net;
  }

  const [AP, IVAC] = await Promise.all([acct(companyId, 'AP'), acct(companyId, 'IVA_CREDIT')]);
  const inv = inventoryAmount > 0 ? await acct(companyId, 'INVENTORY') : null;
  const exp = expenseAmount > 0 ? await acct(companyId, 'PURCHASE_EXPENSE') : null;
  const supplierName = doc.supplier?.razonSocial ?? doc.supplier?.name ?? doc.razonSocialEmisor ?? 'proveedor';
  const label = doc.numeroDoc ?? doc.claveAcceso;

  const lines = [
    ...(inv ? [{ accountCode: inv.code, accountName: inv.name, debit: inventoryAmount, credit: 0, description: `Mercadería ${label}` }] : []),
    ...(exp ? [{ accountCode: exp.code, accountName: exp.name, debit: expenseAmount, credit: 0, description: `Gasto ${label}` }] : []),
    ...(iva > 0 ? [{ accountCode: IVAC.code, accountName: IVAC.name, debit: iva, credit: 0, description: `IVA crédito fiscal ${label}` }] : []),
    { accountCode: AP.code, accountName: AP.name, debit: 0, credit: total, description: `Obligación con ${supplierName}` },
  ];
  return { total, description: `Factura de compra ${label} - ${supplierName}`, lines };
}

/** Solo lectura — para mostrar "asiento sugerido" en el detalle antes de confirmar. No persiste nada. */
export async function previewDirectPurchaseEntry(companyId: string, sriDocumentId: string) {
  const doc = await prisma.sriDocument.findFirst({
    where: { id: sriDocumentId, companyId },
    include: { items: true, supplier: { select: { razonSocial: true, name: true } } },
  });
  if (!doc) throw new Error('Documento SRI no encontrado');
  return computeDirectPurchaseLines(companyId, doc);
}

export async function createDirectPurchaseEntry(companyId: string, sriDocumentId: string) {
  const doc = await prisma.sriDocument.findFirst({
    where: { id: sriDocumentId, companyId },
    include: { items: true, supplier: { select: { razonSocial: true, name: true } } },
  });
  if (!doc) throw new Error('Documento SRI no encontrado');

  const { total, description, lines } = await computeDirectPurchaseLines(companyId, doc);
  const entryNumber = await nextEntryNumber(companyId);

  return prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      description,
      entityType: 'SRI_DOCUMENT',
      entityId: sriDocumentId,
      totalDebit: total,
      totalCredit: total,
      lines: { create: lines },
    },
    include: { lines: true },
  });
}

// ─── Advance Payment (anticipo a proveedor) ──────────────────
// DR Anticipos a proveedores (activo)  ← monto anticipo
//   CR Bancos                          ← monto anticipo
export async function createAdvancePaymentEntry(companyId: string, poId: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, companyId },
    include: { supplier: { select: { name: true } } },
  });
  if (!po) throw new Error('OC no encontrada');
  const amount = Number(po.advanceAmount ?? 0);
  if (amount <= 0) throw new Error('La OC no tiene anticipo configurado');

  const [ADV, CASH] = await Promise.all([
    acct(companyId, 'SUPPLIER_ADVANCE'), acct(companyId, 'CASH'),
  ]);
  const entryNumber = await nextEntryNumber(companyId);

  return prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      description: `Anticipo OC ${po.poNumber} - ${po.supplier.name}`,
      entityType:  'PURCHASE_ORDER',
      entityId:    poId,
      totalDebit:  amount,
      totalCredit: amount,
      lines: {
        create: [
          { accountCode: ADV.code,  accountName: ADV.name,  debit: amount, credit: 0, description: `Anticipo a ${po.supplier.name}` },
          { accountCode: CASH.code, accountName: CASH.name, debit: 0, credit: amount, description: `Pago anticipo OC ${po.poNumber}` },
        ],
      },
    },
    include: { lines: true },
  });
}

// ─── Balance Payment (saldo contra entrega) ──────────────────
// DR Cuentas por Pagar               ← saldo (total - anticipo)
//   CR Bancos                        ← saldo
//   (y se aplica el anticipo: DR AP / CR Anticipos por el monto del anticipo)
export async function createBalancePaymentEntry(companyId: string, poId: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, companyId },
    include: { supplier: { select: { name: true } } },
  });
  if (!po) throw new Error('OC no encontrada');
  const total   = Number(po.totalAmount);
  const advance = Number(po.advanceAmount ?? 0);
  const balance = Math.max(0, total - advance);

  const [AP, CASH, ADV] = await Promise.all([
    acct(companyId, 'AP'), acct(companyId, 'CASH'), acct(companyId, 'SUPPLIER_ADVANCE'),
  ]);
  const entryNumber = await nextEntryNumber(companyId);

  const lines: any[] = [
    // Cancelar la obligación total contra el proveedor
    { accountCode: AP.code, accountName: AP.name, debit: total, credit: 0, description: `Cancelación OC ${po.poNumber}` },
    // Salida de banco por el saldo
    { accountCode: CASH.code, accountName: CASH.name, debit: 0, credit: balance, description: `Pago saldo OC ${po.poNumber}` },
  ];
  // Aplicar anticipo previamente pagado
  if (advance > 0) {
    lines.push({ accountCode: ADV.code, accountName: ADV.name, debit: 0, credit: advance, description: `Aplicación anticipo OC ${po.poNumber}` });
  }

  return prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      description: `Pago saldo OC ${po.poNumber} - ${po.supplier.name}`,
      entityType:  'PURCHASE_ORDER',
      entityId:    poId,
      totalDebit:  total,
      totalCredit: balance + advance,
      lines: { create: lines },
    },
    include: { lines: true },
  });
}

// ─── Invoice Payment / Collection Entry ───────────────────────
// Compra (pago):  DR Cuentas por Pagar  / CR Bancos
// Venta (cobro):  DR Bancos / CR Cuentas por Cobrar
export async function createInvoicePaymentEntry(companyId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId } });
  if (!invoice) throw new Error('Factura no encontrada');

  const amount = Number(invoice.paidAmount ?? invoice.totalAmount);
  if (amount <= 0) return null;
  const isSale = invoice.type === 'SALES';
  const [CASH, AR, AP] = await Promise.all([
    acct(companyId, 'CASH'), acct(companyId, 'AR'), acct(companyId, 'AP'),
  ]);
  const entryNumber = await nextEntryNumber(companyId);

  const lines = isSale
    ? [
        { accountCode: CASH.code, accountName: CASH.name, debit: amount, credit: 0, description: `Cobro factura ${invoice.number}` },
        { accountCode: AR.code, accountName: AR.name, debit: 0, credit: amount, description: `Cancelación CxC factura ${invoice.number}` },
      ]
    : [
        { accountCode: AP.code, accountName: AP.name, debit: amount, credit: 0, description: `Cancelación CxP factura ${invoice.number}` },
        { accountCode: CASH.code, accountName: CASH.name, debit: 0, credit: amount, description: `Salida de caja/bancos` },
      ];

  return prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      description: `${isSale ? 'Cobro' : 'Pago'} factura ${invoice.number}`,
      entityType:  'INVOICE',
      entityId:    invoiceId,
      totalDebit:  amount,
      totalCredit: amount,
      lines: { create: lines },
    },
    include: { lines: true },
  });
}

// ─── Sales Entry ──────────────────────────────────────────────
// DR Cuentas por Cobrar (1130)  ← total
//   CR Ingresos por Ventas (4100) ← subtotal
//   CR IVA Débito (2120)          ← taxAmount
export async function createSalesEntry(companyId: string, salesOrderId: string) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: salesOrderId, companyId },
    include: { customer: { select: { name: true } } },
  });
  if (!order) throw new Error('Pedido de venta no encontrado');

  const subtotal = Number(order.subtotal);
  const tax = Number(order.taxAmount);
  const total = Number(order.total);
  const [AR, SALES, IVAD] = await Promise.all([
    acct(companyId, 'AR'), acct(companyId, 'SALES'), acct(companyId, 'IVA_DEBIT'),
  ]);
  const entryNumber = await nextEntryNumber(companyId);

  return prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      description: `Venta ${order.orderNumber} - ${order.customer.name}`,
      entityType: 'SALES_ORDER',
      entityId: salesOrderId,
      totalDebit: total,
      totalCredit: total,
      lines: {
        create: [
          { accountCode: AR.code, accountName: AR.name, debit: total, credit: 0, description: `CxC ${order.customer.name}` },
          { accountCode: SALES.code, accountName: SALES.name, debit: 0, credit: subtotal, description: `Ingreso venta ${order.orderNumber}` },
          ...(tax > 0 ? [{ accountCode: IVAD.code, accountName: IVAD.name, debit: 0, credit: tax, description: `IVA débito ${order.orderNumber}` }] : []),
        ],
      },
    },
    include: { lines: true },
  });
}

// ─── COGS Entry ───────────────────────────────────────────────
// DR Costo de Ventas (5100)  ← costo (avgCost × qty)
//   CR Inventario (1110)     ← costo
export async function createCOGSEntry(companyId: string, salesOrderId: string) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: salesOrderId, companyId },
    include: { items: { include: { product: { select: { avgCost: true, name: true } } } } },
  });
  if (!order) throw new Error('Pedido de venta no encontrado');

  const cogs = order.items.reduce(
    (s, it) => s + Number(it.product?.avgCost ?? 0) * Number(it.quantity), 0,
  );
  if (cogs <= 0) return null; // sin costo registrado, no se asienta

  const [COGS, INV] = await Promise.all([acct(companyId, 'COGS'), acct(companyId, 'INVENTORY')]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      description: `Costo de ventas ${order.orderNumber}`,
      entityType: 'SALES_ORDER',
      entityId: salesOrderId,
      totalDebit: cogs,
      totalCredit: cogs,
      lines: {
        create: [
          { accountCode: COGS.code, accountName: COGS.name, debit: cogs, credit: 0, description: `Costo mercadería vendida ${order.orderNumber}` },
          { accountCode: INV.code, accountName: INV.name, debit: 0, credit: cogs, description: `Salida de inventario ${order.orderNumber}` },
        ],
      },
    },
    include: { lines: true },
  });
}

// ─── Asientos por MONTO (despachos parciales: un asiento por envío/factura) ───
// Permiten contabilizar la porción facturada de cada Shipment, no el pedido completo.
export async function createSalesEntryAmounts(companyId: string, opts: {
  description: string; entityType: string; entityId: string;
  subtotal: number; tax: number; total: number;
}) {
  if (opts.total <= 0) return null;
  const [AR, SALES, IVAD] = await Promise.all([
    acct(companyId, 'AR'), acct(companyId, 'SALES'), acct(companyId, 'IVA_DEBIT'),
  ]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber, description: opts.description,
      entityType: opts.entityType, entityId: opts.entityId,
      totalDebit: opts.total, totalCredit: opts.total,
      lines: {
        create: [
          { accountCode: AR.code, accountName: AR.name, debit: opts.total, credit: 0, description: opts.description },
          { accountCode: SALES.code, accountName: SALES.name, debit: 0, credit: opts.subtotal, description: opts.description },
          ...(opts.tax > 0 ? [{ accountCode: IVAD.code, accountName: IVAD.name, debit: 0, credit: opts.tax, description: `IVA débito · ${opts.description}` }] : []),
        ],
      },
    },
    include: { lines: true },
  });
}

export async function createCOGSEntryAmount(companyId: string, opts: {
  description: string; entityType: string; entityId: string; cogs: number;
}) {
  if (opts.cogs <= 0) return null;
  const [COGS, INV] = await Promise.all([acct(companyId, 'COGS'), acct(companyId, 'INVENTORY')]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber, description: opts.description,
      entityType: opts.entityType, entityId: opts.entityId,
      totalDebit: opts.cogs, totalCredit: opts.cogs,
      lines: {
        create: [
          { accountCode: COGS.code, accountName: COGS.name, debit: opts.cogs, credit: 0, description: opts.description },
          { accountCode: INV.code, accountName: INV.name, debit: 0, credit: opts.cogs, description: opts.description },
        ],
      },
    },
    include: { lines: true },
  });
}

// ─── Depreciación de activo fijo (B4) ──────────────────────────
// DR Depreciación (gasto, 52022101)   ← cuota del período
//   CR Depreciación acumulada PPE (1020112, cuenta contra-activo) ← cuota del período
export async function createDepreciationEntry(companyId: string, opts: {
  assetId: string; assetNumber: string; assetName: string; period: string; amount: number; entryDate?: Date;
}) {
  if (opts.amount <= 0) return null;
  const [EXP, ACCUM] = await Promise.all([
    acct(companyId, 'FIXED_ASSET_DEPRECIATION_EXPENSE'), acct(companyId, 'FIXED_ASSET_ACCUM_DEPRECIATION'),
  ]);
  const description = `Depreciación ${opts.period} · ${opts.assetNumber} · ${opts.assetName}`;
  const entryDate = opts.entryDate ?? new Date();
  const entryNumber = await nextEntryNumber(companyId, entryDate);
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber, entryDate, description,
      entityType: 'FIXED_ASSET', entityId: opts.assetId,
      totalDebit: opts.amount, totalCredit: opts.amount,
      lines: {
        create: [
          { accountCode: EXP.code, accountName: EXP.name, debit: opts.amount, credit: 0, description },
          { accountCode: ACCUM.code, accountName: ACCUM.name, debit: 0, credit: opts.amount, description },
        ],
      },
    },
    include: { lines: true },
  });
}

// ─── Retention Entry (factura de compra con retenciones) ──────
// DR Cuentas por Pagar (2110)   ← total retenido (menor pago al proveedor)
//   CR Retenciones por Pagar (2130) ← total retenido
export async function createRetentionEntry(companyId: string, sriDocumentId: string) {
  const doc = await prisma.sriDocument.findFirst({
    where: { id: sriDocumentId, companyId },
    include: { retentions: true },
  });
  if (!doc) throw new Error('Documento SRI no encontrado');

  const rets = doc.retentions ?? [];
  let retRenta = rets.filter((r) => r.tipo === 'RENTA').reduce((s, r) => s + Number(r.valor ?? 0), 0);
  let retIva   = rets.filter((r) => r.tipo === 'IVA').reduce((s, r) => s + Number(r.valor ?? 0), 0);
  if (retRenta === 0 && retIva === 0) {
    retRenta = Number(doc.retencionRenta ?? 0);
    retIva   = Number(doc.retencionIva ?? 0);
  }
  const totalRet = retRenta + retIva;
  if (totalRet <= 0) return null;

  const [AP, RR, RI] = await Promise.all([
    acct(companyId, 'AP'), acct(companyId, 'RETENTION_PAYABLE_RENTA'), acct(companyId, 'RETENTION_PAYABLE_IVA'),
  ]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      description: `Retenciones factura ${doc.numeroDoc ?? doc.claveAcceso}`,
      entityType: 'SRI_DOCUMENT',
      entityId: sriDocumentId,
      totalDebit: totalRet,
      totalCredit: totalRet,
      lines: {
        create: [
          { accountCode: AP.code, accountName: AP.name, debit: totalRet, credit: 0, description: 'Disminución CxP por retención' },
          ...(retRenta > 0 ? [{ accountCode: RR.code, accountName: RR.name, debit: 0, credit: retRenta, description: 'Retención IR por pagar al SRI' }] : []),
          ...(retIva > 0 ? [{ accountCode: RI.code, accountName: RI.name, debit: 0, credit: retIva, description: 'Retención IVA por pagar al SRI' }] : []),
        ],
      },
    },
    include: { lines: true },
  });
}

// ─── Sales Withholding Entry (retención que el CLIENTE nos practica) ──────────
// El cliente paga menos: lo retenido es crédito tributario (ACTIVO), no pasivo.
// DR Crédito tributario / Retención a favor (RETENTION_ASSET)  ← total retenido
//   CR Cuentas por Cobrar (AR)                                 ← total retenido (baja la CxC al neto)
export async function createSalesWithholdingEntry(companyId: string, opts: {
  description: string; entityId: string; retRenta: number; retIva: number;
}) {
  const retRenta = Math.round(Number(opts.retRenta) * 100) / 100;
  const retIva = Math.round(Number(opts.retIva) * 100) / 100;
  const total = retRenta + retIva;
  if (total <= 0) return null;

  const [ASSET, AR] = await Promise.all([
    acct(companyId, 'RETENTION_ASSET'), acct(companyId, 'AR'),
  ]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      description: `Retención en venta · ${opts.description}`,
      entityType: 'SALES_INVOICE',
      entityId: opts.entityId,
      totalDebit: total,
      totalCredit: total,
      lines: {
        create: [
          ...(retRenta > 0 ? [{ accountCode: ASSET.code, accountName: ASSET.name, debit: retRenta, credit: 0, description: 'Retención IR a favor (crédito tributario)' }] : []),
          ...(retIva > 0 ? [{ accountCode: ASSET.code, accountName: ASSET.name, debit: retIva, credit: 0, description: 'Retención IVA a favor (crédito tributario)' }] : []),
          { accountCode: AR.code, accountName: AR.name, debit: 0, credit: total, description: `Disminución CxC por retención · ${opts.description}` },
        ],
      },
    },
    include: { lines: true },
  });
}

// ═══════════════════════════════════════════════════════════════
// NOTAS DE CRÉDITO DE VENTA (Sprint 4) — reversos de la factura
// ═══════════════════════════════════════════════════════════════

// Reverso de venta: DR Ventas (subtotal) + DR IVA débito (tax) / CR CxC (total).
export async function createCreditNoteSalesReversal(companyId: string, opts: {
  description: string; entityId: string; subtotal: number; tax: number; total: number;
}) {
  const total = Math.round(Number(opts.total) * 100) / 100;
  if (total <= 0) return null;
  const [AR, SALES, IVAD] = await Promise.all([
    acct(companyId, 'AR'), acct(companyId, 'SALES'), acct(companyId, 'IVA_DEBIT'),
  ]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber, description: `NC · ${opts.description}`,
      entityType: 'CREDIT_NOTE', entityId: opts.entityId,
      totalDebit: total, totalCredit: total,
      lines: {
        create: [
          { accountCode: SALES.code, accountName: SALES.name, debit: opts.subtotal, credit: 0, description: `Reverso de ingreso · ${opts.description}` },
          ...(opts.tax > 0 ? [{ accountCode: IVAD.code, accountName: IVAD.name, debit: opts.tax, credit: 0, description: `Reverso IVA débito · ${opts.description}` }] : []),
          { accountCode: AR.code, accountName: AR.name, debit: 0, credit: total, description: `Disminución CxC por NC · ${opts.description}` },
        ],
      },
    },
    include: { lines: true },
  });
}

// Reverso de COGS (mercancía devuelta a inventario): DR Inventario / CR Costo de ventas.
export async function createCreditNoteCogsReversal(companyId: string, opts: {
  description: string; entityId: string; cogs: number;
}) {
  const cogs = Math.round(Number(opts.cogs) * 100) / 100;
  if (cogs <= 0) return null;
  const [COGS, INV] = await Promise.all([acct(companyId, 'COGS'), acct(companyId, 'INVENTORY')]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber, description: `NC costo · ${opts.description}`,
      entityType: 'CREDIT_NOTE', entityId: opts.entityId,
      totalDebit: cogs, totalCredit: cogs,
      lines: {
        create: [
          { accountCode: INV.code, accountName: INV.name, debit: cogs, credit: 0, description: `Reingreso a inventario · ${opts.description}` },
          { accountCode: COGS.code, accountName: COGS.name, debit: 0, credit: cogs, description: `Reverso de costo de ventas · ${opts.description}` },
        ],
      },
    },
    include: { lines: true },
  });
}

// Reverso de retención (proporcional a lo acreditado): DR CxC / CR Crédito tributario (activo).
export async function createCreditNoteWithholdingReversal(companyId: string, opts: {
  description: string; entityId: string; retRenta: number; retIva: number;
}) {
  const retRenta = Math.round(Number(opts.retRenta) * 100) / 100;
  const retIva = Math.round(Number(opts.retIva) * 100) / 100;
  const total = retRenta + retIva;
  if (total <= 0) return null;
  const [ASSET, AR] = await Promise.all([acct(companyId, 'RETENTION_ASSET'), acct(companyId, 'AR')]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber, description: `NC retención · ${opts.description}`,
      entityType: 'CREDIT_NOTE', entityId: opts.entityId,
      totalDebit: total, totalCredit: total,
      lines: {
        create: [
          { accountCode: AR.code, accountName: AR.name, debit: total, credit: 0, description: `Reverso disminución CxC por retención · ${opts.description}` },
          ...(retRenta > 0 ? [{ accountCode: ASSET.code, accountName: ASSET.name, debit: 0, credit: retRenta, description: 'Reverso retención IR a favor' }] : []),
          ...(retIva > 0 ? [{ accountCode: ASSET.code, accountName: ASSET.name, debit: 0, credit: retIva, description: 'Reverso retención IVA a favor' }] : []),
        ],
      },
    },
    include: { lines: true },
  });
}

// Nota de débito de venta: DR CxC (aumenta lo que debe el cliente) / CR Otros ingresos + CR IVA débito.
export async function createDebitNoteEntry(companyId: string, opts: {
  description: string; entityId: string; subtotal: number; tax: number; total: number;
}) {
  const total = Math.round(Number(opts.total) * 100) / 100;
  if (total <= 0) return null;
  const [AR, INCOME, IVAD] = await Promise.all([
    acct(companyId, 'AR'), acct(companyId, 'DEBIT_NOTE_INCOME'), acct(companyId, 'IVA_DEBIT'),
  ]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber, description: `ND · ${opts.description}`,
      entityType: 'DEBIT_NOTE', entityId: opts.entityId,
      totalDebit: total, totalCredit: total,
      lines: {
        create: [
          { accountCode: AR.code, accountName: AR.name, debit: total, credit: 0, description: `Aumento de CxC por ND · ${opts.description}` },
          { accountCode: INCOME.code, accountName: INCOME.name, debit: 0, credit: opts.subtotal, description: `Ingreso por ND · ${opts.description}` },
          ...(opts.tax > 0 ? [{ accountCode: IVAD.code, accountName: IVAD.name, debit: 0, credit: opts.tax, description: `IVA débito por ND · ${opts.description}` }] : []),
        ],
      },
    },
    include: { lines: true },
  });
}

// Cierre de impuestos (Etapa 6 del plan SRI): liquidación del IVA del período — vacía las
// cuentas "de paso" que acumularon el IVA cobrado en ventas y el crédito tributario de compras
// (y las retenciones de IVA recibidas, si las hay) contra el pasivo real a pagar al SRI.
// Solo se postea cuando hay IVA A PAGAR (> 0): si el período arroja crédito tributario a favor,
// no hay nada que liquidar — el saldo de `IVA_CREDIT` simplemente sigue acumulado para
// compensarse en períodos futuros, sin necesidad de un asiento (así es como ya funciona hoy).
export async function createTaxClosingEntry(companyId: string, opts: {
  period: string; entryDate: Date; impuestoGenerado: number; creditoAdquisiciones: number; retencionesIvaRecibidas: number; totalPagar: number;
}) {
  const totalPagar = Math.round(opts.totalPagar * 100) / 100;
  if (totalPagar <= 0) return null;
  const [IVAD, IVAC, RET, LIQ] = await Promise.all([
    acct(companyId, 'IVA_DEBIT'), acct(companyId, 'IVA_CREDIT'), acct(companyId, 'RETENTION_ASSET'), acct(companyId, 'IVA_LIQUIDACION_POR_PAGAR'),
  ]);
  const impuestoGenerado = Math.round(opts.impuestoGenerado * 100) / 100;
  const creditoAdquisiciones = Math.round(opts.creditoAdquisiciones * 100) / 100;
  const retenciones = Math.round(opts.retencionesIvaRecibidas * 100) / 100;
  const entryNumber = await nextEntryNumber(companyId, opts.entryDate);
  const description = `Cierre de impuestos · IVA ${opts.period}`;
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber, description, entryDate: opts.entryDate,
      entityType: 'TAX_CLOSING', entityId: opts.period,
      totalDebit: impuestoGenerado, totalCredit: impuestoGenerado,
      lines: {
        create: [
          { accountCode: IVAD.code, accountName: IVAD.name, debit: impuestoGenerado, credit: 0, description: `Liquidación IVA débito · ${opts.period}` },
          ...(creditoAdquisiciones > 0 ? [{ accountCode: IVAC.code, accountName: IVAC.name, debit: 0, credit: creditoAdquisiciones, description: `Uso de crédito tributario · ${opts.period}` }] : []),
          ...(retenciones > 0 ? [{ accountCode: RET.code, accountName: RET.name, debit: 0, credit: retenciones, description: `Uso de retenciones de IVA recibidas · ${opts.period}` }] : []),
          { accountCode: LIQ.code, accountName: LIQ.name, debit: 0, credit: totalPagar, description: `IVA por pagar al SRI · ${opts.period}` },
        ],
      },
    },
    include: { lines: true },
  });
}

// ─── Supplier Payment Entry (pago de factura SRI) ─────────────
// DR Cuentas por Pagar / CR Bancos
export async function createSupplierPaymentEntry(
  companyId: string,
  args: { amount: number; reference?: string; supplierName?: string; userId?: string },
) {
  const amount = Math.round(Number(args.amount) * 100) / 100;
  if (amount <= 0) return null;
  const [AP, CASH] = await Promise.all([acct(companyId, 'AP'), acct(companyId, 'CASH')]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      description: `Pago a proveedor ${args.supplierName ?? ''} ${args.reference ?? ''}`.trim(),
      entityType: 'INVOICE',
      entityId: args.reference,
      totalDebit: amount,
      totalCredit: amount,
      status: 'POSTED',
      createdBy: args.userId,
      lines: {
        create: [
          { accountCode: AP.code, accountName: AP.name, debit: amount, credit: 0, description: 'Cancelación CxP proveedor' },
          { accountCode: CASH.code, accountName: CASH.name, debit: 0, credit: amount, description: 'Salida de caja/bancos' },
        ],
      },
    },
    include: { lines: true },
  });
}

// ─── Ajuste de pago CxP (write-off) ────────────────────────────
// Cierra un saldo residual pequeño que el proveedor condona (redondeo, descuento
// negociado, diferencia de tipo de cambio) sin dejarlo perpetuamente "pendiente" en el
// aging. DR Cuentas por Pagar (cancela el pasivo) / CR Otras rentas (ganancia).
export async function createPaymentAdjustmentEntry(companyId: string, args: {
  amount: number; sriDocumentId: string; supplierName?: string; reason: string; userId?: string;
}) {
  const amount = Math.round(Number(args.amount) * 100) / 100;
  if (amount <= 0) return null;
  const [AP, GAIN] = await Promise.all([acct(companyId, 'AP'), acct(companyId, 'PAYMENT_ADJUSTMENT_GAIN')]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      description: `Ajuste de pago · ${args.supplierName ?? ''} — ${args.reason}`.trim(),
      entityType: 'SRI_DOCUMENT',
      entityId: args.sriDocumentId,
      totalDebit: amount,
      totalCredit: amount,
      status: 'POSTED',
      createdBy: args.userId,
      lines: {
        create: [
          { accountCode: AP.code, accountName: AP.name, debit: amount, credit: 0, description: `Cancelación de saldo por ajuste — ${args.reason}` },
          { accountCode: GAIN.code, accountName: GAIN.name, debit: 0, credit: amount, description: `Ajuste de pago aceptado por el proveedor — ${args.reason}` },
        ],
      },
    },
    include: { lines: true },
  });
}

// ─── Ajuste de cobro CxC (write-off) ───────────────────────────
// Simétrico a createPaymentAdjustmentEntry pero del lado de cobrar: castiga un saldo
// residual (descuento por pronto pago no facturado, diferencia irrecuperable) contra un
// gasto — no contra caja. DR Gasto deterioro CxC / CR Cuentas por cobrar (cancela el activo).
export async function createReceivableAdjustmentEntry(companyId: string, args: {
  amount: number; invoiceId: string; customerName?: string; reason: string; userId?: string;
}) {
  const amount = Math.round(Number(args.amount) * 100) / 100;
  if (amount <= 0) return null;
  const [LOSS, AR] = await Promise.all([acct(companyId, 'RECEIVABLE_ADJUSTMENT_LOSS'), acct(companyId, 'AR')]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      description: `Ajuste de cobro · ${args.customerName ?? ''} — ${args.reason}`.trim(),
      entityType: 'INVOICE',
      entityId: args.invoiceId,
      totalDebit: amount,
      totalCredit: amount,
      status: 'POSTED',
      createdBy: args.userId,
      lines: {
        create: [
          { accountCode: LOSS.code, accountName: LOSS.name, debit: amount, credit: 0, description: `Ajuste de cobro no recuperado — ${args.reason}` },
          { accountCode: AR.code, accountName: AR.name, debit: 0, credit: amount, description: `Cancelación de saldo por ajuste — ${args.reason}` },
        ],
      },
    },
    include: { lines: true },
  });
}

// ─── Reclasificación de cuenta (regularización de un mal registro) ────────────
// El proyecto NO permite editar asientos contabilizados (regla 5): documentos posteados
// se reversan, no se modifican. Pero reversar TODO un asiento porque una sola línea quedó
// en la cuenta equivocada es desproporcionado y pierde la trazabilidad. La reclasificación
// resuelve esto con un asiento correctivo de 2 líneas que mueve el saldo de la cuenta
// incorrecta a la correcta, dejando el original intacto (auditable) y el efecto neto
// correcto en el mayor: DR cuenta correcta / CR cuenta incorrecta (o viceversa, según el
// lado que tenía la línea original).
export interface ReclassifyLine { accountCode: string; accountName: string; debit: number; credit: number }

/** Puro: dada la línea original y la cuenta destino, calcula las 2 líneas del asiento correctivo. */
export function computeReclassificationLines(
  original: { accountCode: string; accountName: string; debit: number; credit: number },
  toAccount: { code: string; name: string },
): ReclassifyLine[] {
  const debit = Number(original.debit);
  const credit = Number(original.credit);
  const amount = debit > 0 ? debit : credit;
  if (amount <= 0) throw new Error('La línea original no tiene monto');
  const wasDebit = debit > 0;
  return [
    { accountCode: toAccount.code, accountName: toAccount.name, debit: wasDebit ? amount : 0, credit: wasDebit ? 0 : amount },
    { accountCode: original.accountCode, accountName: original.accountName, debit: wasDebit ? 0 : amount, credit: wasDebit ? amount : 0 },
  ];
}

export async function createReclassificationEntry(companyId: string, args: {
  originalEntryId: string; lineId: string; toAccountCode: string; reason: string; userId?: string;
}) {
  const original = await prisma.journalEntry.findFirst({ where: { id: args.originalEntryId, companyId }, include: { lines: true } });
  if (!original) throw new Error('Asiento original no encontrado');
  const line = original.lines.find((l) => l.id === args.lineId);
  if (!line) throw new Error('La línea indicada no pertenece a ese asiento');
  if (line.accountCode === args.toAccountCode) throw new Error('La cuenta destino es igual a la actual');

  const toAccount = await prisma.financeChartOfAccounts.findFirst({ where: { companyId, code: args.toAccountCode } });
  if (!toAccount) throw new Error(`ACCOUNT_NOT_FOUND:${args.toAccountCode}`);
  if (!args.reason?.trim()) throw new Error('El motivo de la reclasificación es obligatorio');

  const lines = computeReclassificationLines(
    { accountCode: line.accountCode, accountName: line.accountName, debit: Number(line.debit), credit: Number(line.credit) },
    { code: toAccount.code, name: toAccount.name },
  );
  const amount = Math.max(lines[0].debit, lines[0].credit);
  const entryNumber = await nextEntryNumber(companyId);

  return prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      description: `Reclasificación de cuenta (${original.entryNumber}: ${line.accountCode} → ${toAccount.code}) — ${args.reason}`,
      entityType: 'RECLASSIFICATION',
      entityId: original.id,
      totalDebit: amount,
      totalCredit: amount,
      status: 'POSTED',
      createdBy: args.userId,
      lines: {
        create: lines.map((l) => ({ ...l, description: args.reason })),
      },
    },
    include: { lines: true },
  });
}

// ─── Producción (transformación) ──────────────────────────────
// Al terminar una orden de producción la materia prima deja de existir como tal
// y nace producto terminado. NIIF: es un movimiento entre cuentas de inventario,
// no un gasto. Asiento:
//   DR 1010305 Inventario de productos terminados  ← costo real de los consumos
//     CR 1010301 Inventario de materia prima        ← mismo importe
export async function createProductionEntry(
  companyId: string,
  args: { amount: number; reference: string; productName: string; lotNumber?: string | null; userId?: string },
) {
  const amount = Math.round(Number(args.amount) * 100) / 100;
  if (amount <= 0) return null; // sin costo real no hay hecho económico que registrar

  const [FINISHED, RAW] = await Promise.all([
    acct(companyId, 'INVENTORY_FINISHED'),
    acct(companyId, 'INVENTORY_RAW'),
  ]);
  const entryNumber = await nextEntryNumber(companyId);
  const lote = args.lotNumber ? ` · lote ${args.lotNumber}` : '';

  return prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      description: `Producción ${args.reference} — ${args.productName}${lote}`,
      entityType: 'PRODUCTION',
      entityId: args.reference,
      totalDebit: amount,
      totalCredit: amount,
      status: 'POSTED',
      createdBy: args.userId,
      lines: {
        create: [
          { accountCode: FINISHED.code, accountName: FINISHED.name, debit: amount, credit: 0, description: `Ingreso de producto terminado${lote}` },
          { accountCode: RAW.code, accountName: RAW.name, debit: 0, credit: amount, description: 'Consumo de materia prima en producción' },
        ],
      },
    },
    include: { lines: true },
  });
}

// ─── Inventory Adjustment Entry (ajuste / merma) ──────────────
// Aumento: DR Inventario / CR Otros Ingresos (ajuste positivo)
// Disminución/merma: DR Deterioro de Inventario / CR Inventario
export async function createInventoryAdjustmentEntry(
  companyId: string,
  args: { amount: number; isIncrease: boolean; reference?: string; description?: string; userId?: string },
) {
  const amount = Math.round(Number(args.amount) * 100) / 100;
  if (amount <= 0) return null;

  const INV = await acct(companyId, 'INVENTORY');
  const COUNTER = await acct(companyId, args.isIncrease ? 'INV_ADJUST_GAIN' : 'INV_WRITEOFF');
  const entryNumber = await nextEntryNumber(companyId);

  const lines = args.isIncrease
    ? [
        { accountCode: INV.code, accountName: INV.name, debit: amount, credit: 0, description: args.description ?? 'Ajuste positivo de inventario' },
        { accountCode: COUNTER.code, accountName: COUNTER.name, debit: 0, credit: amount, description: 'Ingreso por ajuste de inventario' },
      ]
    : [
        { accountCode: COUNTER.code, accountName: COUNTER.name, debit: amount, credit: 0, description: args.description ?? 'Merma / baja de inventario' },
        { accountCode: INV.code, accountName: INV.name, debit: 0, credit: amount, description: 'Salida de inventario por ajuste' },
      ];

  return prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      description: `Ajuste de inventario${args.reference ? ' ' + args.reference : ''}`,
      entityType: 'INVENTORY',
      entityId: args.reference,
      totalDebit: amount,
      totalCredit: amount,
      status: 'POSTED',
      createdBy: args.userId,
      lines: { create: lines },
    },
    include: { lines: true },
  });
}

// ═══════════════════════════════════════════════════════════════
// NÓMINA (Sprint 8) — devengo mensual y pago de netos
// ═══════════════════════════════════════════════════════════════

// Devengo del rol de pagos:
//   DR 520201 Sueldos y remuneraciones      (sueldo + horas extras + bonos)
//   DR 520202 Aportes a la seguridad social (patronal + IECE/SECAP + fondos de reserva)
//   DR 520203 Beneficios sociales           (décimos + provisión vacaciones)
//     CR 2010703 Con el IESS                (aporte personal + patronal + fondos + préstamos IESS)
//     CR 2010701 Con la administración trib.(retenciones IR empleados)
//     CR 2010704 Por beneficios de ley      (netos por pagar + provisiones + retenciones judiciales)
export async function createPayrollAccrualEntry(companyId: string, opts: {
  periodId: string; label: string; employees: number; userId?: string;
  totals: { salaryExpense: number; iessExpense: number; benefitsExpense: number; iessPayable: number; irPayable: number; benefitsPayable: number };
}) {
  const t = opts.totals;
  const totalDebit = Math.round((t.salaryExpense + t.iessExpense + t.benefitsExpense) * 100) / 100;
  const totalCredit = Math.round((t.iessPayable + t.irPayable + t.benefitsPayable) * 100) / 100;
  if (totalDebit <= 0) throw new Error('El rol de pagos no tiene valores para contabilizar');
  if (Math.abs(totalDebit - totalCredit) > 0.05) throw new Error(`Asiento de nómina descuadrado (DR ${totalDebit} vs CR ${totalCredit})`);

  const [SAL, IESSX, BEN, IESSP, IRP, BENP] = await Promise.all([
    acct(companyId, 'PAYROLL_SALARY_EXPENSE'), acct(companyId, 'PAYROLL_IESS_EXPENSE'), acct(companyId, 'PAYROLL_BENEFITS_EXPENSE'),
    acct(companyId, 'PAYROLL_IESS_PAYABLE'), acct(companyId, 'PAYROLL_IR_PAYABLE'), acct(companyId, 'PAYROLL_BENEFITS_PAYABLE'),
  ]);
  const entryNumber = await nextEntryNumber(companyId);

  // El posible descuadre por redondeo (≤ $0.05) se absorbe en el neto por pagar.
  const benefitsPayableAdj = Math.round((t.benefitsPayable + (totalDebit - totalCredit)) * 100) / 100;

  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber,
      description: `Rol de pagos ${opts.label} (${opts.employees} empleados)`,
      entityType: 'PAYROLL', entityId: opts.periodId,
      totalDebit, totalCredit: totalDebit,
      status: 'POSTED', createdBy: opts.userId,
      lines: {
        create: [
          ...(t.salaryExpense > 0 ? [{ accountCode: SAL.code, accountName: SAL.name, debit: t.salaryExpense, credit: 0, description: 'Sueldos, horas extras y bonificaciones' }] : []),
          ...(t.iessExpense > 0 ? [{ accountCode: IESSX.code, accountName: IESSX.name, debit: t.iessExpense, credit: 0, description: 'Aporte patronal, IECE/SECAP y fondos de reserva' }] : []),
          ...(t.benefitsExpense > 0 ? [{ accountCode: BEN.code, accountName: BEN.name, debit: t.benefitsExpense, credit: 0, description: 'Décimos y provisión de vacaciones' }] : []),
          ...(t.iessPayable > 0 ? [{ accountCode: IESSP.code, accountName: IESSP.name, debit: 0, credit: t.iessPayable, description: 'Obligaciones con el IESS (aportes, fondos, préstamos)' }] : []),
          ...(t.irPayable > 0 ? [{ accountCode: IRP.code, accountName: IRP.name, debit: 0, credit: t.irPayable, description: 'Retención IR empleados por pagar al SRI' }] : []),
          ...(benefitsPayableAdj > 0 ? [{ accountCode: BENP.code, accountName: BENP.name, debit: 0, credit: benefitsPayableAdj, description: 'Netos, provisiones y retenciones judiciales por pagar' }] : []),
        ],
      },
    },
    include: { lines: true },
  });
}

// Pago de los netos del rol: DR 2010704 / CR Caja-Bancos.
export async function createPayrollPaymentEntry(companyId: string, opts: {
  periodId: string; label: string; net: number; userId?: string;
}) {
  const net = Math.round(Number(opts.net) * 100) / 100;
  if (net <= 0) throw new Error('No hay netos por pagar en este período');
  const [BENP, CASH] = await Promise.all([acct(companyId, 'PAYROLL_BENEFITS_PAYABLE'), acct(companyId, 'CASH')]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber,
      description: `Pago rol de pagos ${opts.label}`,
      entityType: 'PAYROLL', entityId: opts.periodId,
      totalDebit: net, totalCredit: net,
      status: 'POSTED', createdBy: opts.userId,
      lines: {
        create: [
          { accountCode: BENP.code, accountName: BENP.name, debit: net, credit: 0, description: 'Cancelación de sueldos netos por pagar' },
          { accountCode: CASH.code, accountName: CASH.name, debit: 0, credit: net, description: 'Transferencias de nómina' },
        ],
      },
    },
    include: { lines: true },
  });
}

// ═══════════════════════════════════════════════════════════════
// TESORERÍA (Sprint 9) — cobros de clientes y pago de impuestos
// ═══════════════════════════════════════════════════════════════

// Cobro de cliente (ingreso a bancos): DR Caja-Bancos / CR Cuentas por Cobrar.
export async function createCustomerCollectionEntry(companyId: string, opts: {
  amount: number; description: string; entityId?: string; userId?: string;
}) {
  const amount = Math.round(Number(opts.amount) * 100) / 100;
  if (amount <= 0) return null;
  const [CASH, AR] = await Promise.all([acct(companyId, 'CASH'), acct(companyId, 'AR')]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber,
      description: opts.description,
      entityType: 'TREASURY', entityId: opts.entityId,
      totalDebit: amount, totalCredit: amount,
      status: 'POSTED', createdBy: opts.userId,
      lines: {
        create: [
          { accountCode: CASH.code, accountName: CASH.name, debit: amount, credit: 0, description: 'Ingreso a caja/bancos' },
          { accountCode: AR.code, accountName: AR.name, debit: 0, credit: amount, description: `Cancelación CxC · ${opts.description}` },
        ],
      },
    },
    include: { lines: true },
  });
}

// Pago de impuestos/aportes mensuales: DR pasivo (2010701 SRI | 2010703 IESS) / CR Caja-Bancos.
export async function createTaxPaymentEntry(companyId: string, opts: {
  kind: 'SRI' | 'IESS'; amount: number; description: string; userId?: string; entityId?: string;
}) {
  const amount = Math.round(Number(opts.amount) * 100) / 100;
  if (amount <= 0) return null;
  const liabilityKey = opts.kind === 'IESS' ? 'PAYROLL_IESS_PAYABLE' : 'IVA_DEBIT'; // 2010703 | 2010701
  const [LIAB, CASH] = await Promise.all([acct(companyId, liabilityKey), acct(companyId, 'CASH')]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber,
      description: opts.description,
      entityType: 'TREASURY', entityId: opts.entityId,
      totalDebit: amount, totalCredit: amount,
      status: 'POSTED', createdBy: opts.userId,
      lines: {
        create: [
          { accountCode: LIAB.code, accountName: LIAB.name, debit: amount, credit: 0, description: `Cancelación obligación ${opts.kind}` },
          { accountCode: CASH.code, accountName: CASH.name, debit: 0, credit: amount, description: `Pago ${opts.kind}` },
        ],
      },
    },
    include: { lines: true },
  });
}

// ─── Auto-post dispatcher ─────────────────────────────────────
export async function autoPostEntry(companyId: string, entityType: string, entityId: string) {
  switch (entityType) {
    case 'PURCHASE_ORDER': return createPOReceiptEntry(companyId, entityId);
    case 'INVOICE':        return createInvoicePaymentEntry(companyId, entityId);
    case 'SALES_ORDER':    return createSalesEntry(companyId, entityId);
    case 'SRI_DOCUMENT':   return createRetentionEntry(companyId, entityId);
    default:               throw new Error(`entityType '${entityType}' no soportado`);
  }
}

// ─── Get Journal Entries ──────────────────────────────────────
export async function getJournalEntries(companyId: string, filters?: {
  entityType?: string;
  entityId?: string; // smart buttons (A4): ver los asientos de UNA entidad concreta
  from?: string;
  to?: string;
  status?: string;
}) {
  return prisma.journalEntry.findMany({
    where: {
      companyId,
      ...(filters?.entityType && { entityType: filters.entityType }),
      ...(filters?.entityId   && { entityId: filters.entityId }),
      ...(filters?.status     && { status: filters.status }),
      ...(filters?.from || filters?.to ? {
        entryDate: {
          ...(filters.from && { gte: new Date(filters.from) }),
          ...(filters.to   && { lte: new Date(filters.to) }),
        },
      } : {}),
    },
    include: { lines: true },
    orderBy: { entryDate: 'desc' },
    take:    200,
  });
}

// ─── Búsqueda avanzada del libro diario (Sprint 6) ─────────────
// Filtros combinables + paginación + totales del resultado, para que auxiliares
// y auditores encuentren cualquier asiento (por texto, cuenta, tipo, monto, fecha).
export interface JournalSearchFilters {
  q?: string;           // busca en descripción y número de asiento
  accountCode?: string; // asientos que toquen esta cuenta (o cualquier hija por prefijo)
  entityType?: string;
  status?: string;
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  pageSize?: number;
}

export async function searchJournalEntries(companyId: string, f: JournalSearchFilters) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, f.pageSize ?? 50));

  const where = {
    companyId,
    ...(f.entityType && { entityType: f.entityType }),
    ...(f.status && { status: f.status }),
    ...(f.q && {
      OR: [
        { description: { contains: f.q, mode: 'insensitive' as const } },
        { entryNumber: { contains: f.q, mode: 'insensitive' as const } },
      ],
    }),
    ...(f.accountCode && { lines: { some: { accountCode: { startsWith: f.accountCode } } } }),
    ...(f.minAmount != null || f.maxAmount != null
      ? { totalDebit: { ...(f.minAmount != null && { gte: f.minAmount }), ...(f.maxAmount != null && { lte: f.maxAmount }) } }
      : {}),
    ...(f.from || f.to
      ? { entryDate: { ...(f.from && { gte: new Date(f.from) }), ...(f.to && { lte: new Date(f.to) }) } }
      : {}),
  };

  const [total, items, sums] = await Promise.all([
    prisma.journalEntry.count({ where }),
    prisma.journalEntry.findMany({
      where,
      include: { lines: true },
      orderBy: [{ entryDate: 'desc' }, { entryNumber: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.journalEntry.aggregate({ where, _sum: { totalDebit: true, totalCredit: true } }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    totals: {
      debit: Number(sums._sum.totalDebit ?? 0),
      credit: Number(sums._sum.totalCredit ?? 0),
    },
  };
}

export async function getJournalEntryById(id: string, companyId: string) {
  const entry = await prisma.journalEntry.findFirst({
    where:   { id, companyId },
    include: { lines: true },
  });
  if (!entry) throw new Error('Asiento no encontrado');
  return entry;
}

// ─── Manual Journal Entry ─────────────────────────────────────
export interface ManualLine { accountCode: string; debit?: number; credit?: number; description?: string; }

export async function createManualEntry(
  companyId: string,
  data: { date?: string; description: string; lines: ManualLine[] },
  userId?: string,
) {
  if (!data.lines || data.lines.length < 2) throw new Error('Un asiento requiere al menos 2 líneas');

  const round = (n: number) => Math.round(n * 100) / 100;
  const totalDebit = round(data.lines.reduce((s, l) => s + Number(l.debit || 0), 0));
  const totalCredit = round(data.lines.reduce((s, l) => s + Number(l.credit || 0), 0));
  if (totalDebit !== totalCredit) throw new Error('UNBALANCED');
  if (totalDebit <= 0) throw new Error('El asiento no puede tener total cero');

  // Validar que las cuentas existan en el plan de cuentas
  const codes = [...new Set(data.lines.map((l) => l.accountCode))];
  const accounts = await prisma.financeChartOfAccounts.findMany({
    where: { companyId, code: { in: codes } },
  });
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  for (const c of codes) if (!byCode.has(c)) throw new Error(`ACCOUNT_NOT_FOUND:${c}`);

  const entryDate = data.date ? new Date(data.date) : new Date();
  const entryNumber = await nextEntryNumber(companyId, entryDate);
  return prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      entryDate,
      description: data.description || 'Asiento manual',
      entityType: 'MANUAL',
      totalDebit, totalCredit,
      status: 'POSTED',
      createdBy: userId,
      lines: {
        create: data.lines.map((l) => ({
          accountCode: l.accountCode,
          accountName: byCode.get(l.accountCode)!.name,
          debit: round(Number(l.debit || 0)),
          credit: round(Number(l.credit || 0)),
          description: l.description,
        })),
      },
    },
    include: { lines: true },
  });
}

// ─── Reverse Entry ────────────────────────────────────────────
export async function reverseEntry(id: string, companyId: string, userId?: string) {
  const original = await prisma.journalEntry.findFirst({ where: { id, companyId }, include: { lines: true } });
  if (!original) throw new Error('Asiento no encontrado');
  if (original.status === 'REVERSED') throw new Error('El asiento ya fue reversado');

  // El reverso marca el ORIGINAL como REVERSED, y los reportes (balanza, mayor) excluyen
  // los asientos REVERSED — si el original vive en un mes ya cerrado, marcarlo así
  // modificaría retroactivamente ese período "inmutable". Se exige reabrir el mes del
  // original primero (deja huella de auditoría explícita en Cierres).
  await assertPeriodOpen(companyId, original.entryDate);

  const entryNumber = await nextEntryNumber(companyId); // valida también el período de "hoy" (fecha del reverso)
  const reversal = await prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      description: `Reversa de ${original.entryNumber} — ${original.description}`,
      entityType: 'REVERSAL',
      entityId: original.id,
      totalDebit: original.totalCredit,
      totalCredit: original.totalDebit,
      status: 'POSTED',
      createdBy: userId,
      lines: {
        create: original.lines.map((l) => ({
          accountCode: l.accountCode,
          accountName: l.accountName,
          debit: l.credit, // invertido
          credit: l.debit,
          description: `Reversa: ${l.description ?? ''}`,
        })),
      },
    },
    include: { lines: true },
  });
  await prisma.journalEntry.update({ where: { id: original.id }, data: { status: 'REVERSED' } });
  return reversal;
}
