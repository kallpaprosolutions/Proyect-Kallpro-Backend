import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { DEFAULT_MAPPINGS } from './finance/accounting.service';
import { assertPeriodOpen } from './finance/fiscal-period.service';
import { getNextDocumentNumber } from '../utils/sequence.helper';
import { splitByAccount } from './inventory/engines/inventory-pro.engine';

const round2 = (n: number) => Math.round(n * 100) / 100;
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

// Cuenta de efectivo de un movimiento concreto: la subcuenta del banco usado si está
// configurada, o la cuenta CASH genérica del posting setup (backlog 05-07 §1 — antes el mayor
// no distinguía en qué banco entró o salió el dinero).
async function cashAcct(companyId: string, bankAccountId?: string | null): Promise<{ code: string; name: string }> {
  if (bankAccountId) {
    const bank = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
      select: { glAccountCode: true, glAccountName: true },
    });
    if (bank?.glAccountCode) return { code: bank.glAccountCode, name: bank.glAccountName ?? bank.glAccountCode };
  }
  return acct(companyId, 'CASH');
}

// ─── Cuenta por producto / categoría (propuesta 03 #5) ─────────
// Inventario, costo de ventas e ingresos pueden tener cuenta propia por producto o por su
// categoría; si ninguno la define, se usa la del posting setup (comportamiento previo intacto).
export type ProductAmount = { productId: string | null | undefined; amount: number };
type ProductAccountKind = 'INVENTORY' | 'COGS' | 'SALES';
const PRODUCT_ACCOUNT_FIELD = { INVENTORY: 'inventoryAccountCode', COGS: 'cogsAccountCode', SALES: 'revenueAccountCode' } as const;

async function productAccountLines(
  companyId: string, kind: ProductAccountKind, parts: ProductAmount[] | undefined, total: number,
): Promise<{ code: string; name: string; amount: number }[]> {
  const fallback = await acct(companyId, kind);
  const t = round2(total);
  if (t <= 0) return [];
  const ids = [...new Set((parts ?? []).map((p) => p.productId).filter((x): x is string => !!x))];
  if (ids.length === 0) return [{ ...fallback, amount: t }];
  const field = PRODUCT_ACCOUNT_FIELD[kind];
  const products = (await prisma.product.findMany({
    where: { id: { in: ids }, companyId },
    select: { id: true, [field]: true, category: { select: { [field]: true } } } as any,
  })) as any[];
  const codeOf = new Map<string, string | null>(products.map((p) => [p.id, p[field] ?? p.category?.[field] ?? null]));
  const codes = [...new Set([...codeOf.values()].filter((c): c is string => !!c))];
  const chart = codes.length
    ? await prisma.financeChartOfAccounts.findMany({ where: { companyId, code: { in: codes } }, select: { code: true, name: true } })
    : [];
  const nameOf = new Map(chart.map((c) => [c.code, c.name]));
  const accountFor = (pid: string | null | undefined) => {
    const code = pid ? codeOf.get(pid) : null;
    return code ? { code, name: nameOf.get(code) ?? code } : fallback;
  };
  const rows = splitByAccount((parts ?? []).map((p) => ({ account: accountFor(p.productId), amount: p.amount })), t);
  return rows.length ? rows.map((r) => ({ code: r.account.code, name: r.account.name, amount: r.amount })) : [{ ...fallback, amount: t }];
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

  const [invLines, IVAC, AP] = await Promise.all([
    productAccountLines(companyId, 'INVENTORY', po.items.map((i) => ({ productId: i.productId, amount: Number(i.lineTotal) })), subtotalNet),
    acct(companyId, 'IVA_CREDIT'), acct(companyId, 'AP'),
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
          ...invLines.map((l) => ({
            accountCode: l.code,
            accountName: l.name,
            debit:       l.amount,
            credit:      0,
            description: `Mercadería recibida OC ${po.poNumber}`,
          })),
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
async function computeDirectPurchaseLines(companyId: string, doc: {
  id: string; numeroDoc: string | null; claveAcceso: string; total: any; iva: any;
  razonSocialEmisor: string | null; supplier?: { razonSocial: string | null; name: string | null } | null;
  items: { tipoItem: string; precioTotal: any; productId?: string | null }[];
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
  const invLines = await productAccountLines(
    companyId, 'INVENTORY',
    doc.items.filter((i) => i.tipoItem === 'PRODUCTO').map((i) => ({ productId: i.productId, amount: Number(i.precioTotal) })),
    inventoryAmount,
  );
  const exp = expenseAmount > 0 ? await acct(companyId, 'PURCHASE_EXPENSE') : null;
  const supplierName = doc.supplier?.razonSocial ?? doc.supplier?.name ?? doc.razonSocialEmisor ?? 'proveedor';
  const label = doc.numeroDoc || doc.claveAcceso;

  const lines = [
    ...invLines.map((l) => ({ accountCode: l.code, accountName: l.name, debit: l.amount, credit: 0, description: `Mercadería ${label}` })),
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

/** Solo lectura — "asiento sugerido" de reverso para el detalle antes de confirmar la NC. */
export async function previewCreditNoteReversalEntry(companyId: string, sriDocumentId: string) {
  const doc = await prisma.sriDocument.findFirst({
    where: { id: sriDocumentId, companyId },
    include: { items: true, supplier: { select: { razonSocial: true, name: true } } },
  });
  if (!doc) throw new Error('Documento SRI no encontrado');
  const { total, lines } = await computeDirectPurchaseLines(companyId, doc);
  const label = doc.numeroDoc || doc.claveAcceso;
  const supplierName = doc.supplier?.razonSocial ?? doc.supplier?.name ?? doc.razonSocialEmisor ?? 'proveedor';
  return { total, description: `Reverso NC de compra ${label} - ${supplierName}`, lines: invertLines(lines) };
}

// ─── Nota de Crédito de compra: REVERSO contable (06-contabilidad backlog) ────
// Espejo exacto de `createDirectPurchaseEntry` con débito/crédito invertidos:
//   DR Cuentas por Pagar          ← total de la NC (se debe menos al proveedor)
//     CR Inventario/Gasto         ← proporción de ítems (relev lo reconocido en la compra)
//     CR IVA Crédito Tributario   ← IVA de la NC (se reduce el crédito fiscal reclamado)
// Antes, confirmar una NC de compra ajustaba el saldo de CxP solo "virtualmente" en
// `getPayables` (neteo contra el saldo, sin asiento) — el mayor nunca reflejaba el reverso,
// violando la regla 2 (cualquier hecho económico genera asiento). Se usa el MISMO cálculo
// proporcional que la factura original (no se edita el asiento original — regla 5, se
// reversa con uno nuevo, propio de la NC).
function invertLines<T extends { debit: number; credit: number }>(lines: T[]): T[] {
  return lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit }));
}

export async function createCreditNoteReversalEntry(companyId: string, sriDocumentId: string) {
  const doc = await prisma.sriDocument.findFirst({
    where: { id: sriDocumentId, companyId },
    include: { items: true, supplier: { select: { razonSocial: true, name: true } } },
  });
  if (!doc) throw new Error('Documento SRI no encontrado');

  const { total, lines } = await computeDirectPurchaseLines(companyId, doc);
  const label = doc.numeroDoc || doc.claveAcceso;
  const supplierName = doc.supplier?.razonSocial ?? doc.supplier?.name ?? doc.razonSocialEmisor ?? 'proveedor';
  const entryNumber = await nextEntryNumber(companyId);

  return prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      description: `Reverso NC de compra ${label} - ${supplierName}`,
      entityType: 'SRI_DOCUMENT',
      entityId: sriDocumentId,
      totalDebit: total,
      totalCredit: total,
      lines: { create: invertLines(lines) },
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
  lines?: ProductAmount[]; // subtotal por producto → cuenta de ingreso por producto/categoría
}) {
  if (opts.total <= 0) return null;
  const [AR, salesLines, IVAD] = await Promise.all([
    acct(companyId, 'AR'), productAccountLines(companyId, 'SALES', opts.lines, opts.subtotal), acct(companyId, 'IVA_DEBIT'),
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
          ...salesLines.map((l) => ({ accountCode: l.code, accountName: l.name, debit: 0, credit: l.amount, description: opts.description })),
          ...(opts.tax > 0 ? [{ accountCode: IVAD.code, accountName: IVAD.name, debit: 0, credit: opts.tax, description: `IVA débito · ${opts.description}` }] : []),
        ],
      },
    },
    include: { lines: true },
  });
}

export async function createCOGSEntryAmount(companyId: string, opts: {
  description: string; entityType: string; entityId: string; cogs: number;
  lines?: ProductAmount[]; // costo por producto → cuentas de costo e inventario por producto/categoría
}) {
  if (opts.cogs <= 0) return null;
  const [cogsLines, invLines] = await Promise.all([
    productAccountLines(companyId, 'COGS', opts.lines, opts.cogs),
    productAccountLines(companyId, 'INVENTORY', opts.lines, opts.cogs),
  ]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber, description: opts.description,
      entityType: opts.entityType, entityId: opts.entityId,
      totalDebit: opts.cogs, totalCredit: opts.cogs,
      lines: {
        create: [
          ...cogsLines.map((l) => ({ accountCode: l.code, accountName: l.name, debit: l.amount, credit: 0, description: opts.description })),
          ...invLines.map((l) => ({ accountCode: l.code, accountName: l.name, debit: 0, credit: l.amount, description: opts.description })),
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
  assetId: string; assetNumber: string; assetName: string; period: string; fromPeriod?: string; amount: number; entryDate?: Date;
}) {
  if (opts.amount <= 0) return null;
  const [EXP, ACCUM] = await Promise.all([
    acct(companyId, 'FIXED_ASSET_DEPRECIATION_EXPENSE'), acct(companyId, 'FIXED_ASSET_ACCUM_DEPRECIATION'),
  ]);
  // El regex de reverso (`journal.service.reverseEntry`) captura el primer "AAAA-MM" después de
  // "Depreciación " — por eso `opts.period` (el que se guarda en `lastDepreciatedPeriod`) va
  // SIEMPRE primero, y la nota de catch-up (si recupera >1 mes salteado) va aparte, después.
  const description = opts.fromPeriod
    ? `Depreciación ${opts.period} (recupera ${opts.fromPeriod}→${opts.period}) · ${opts.assetNumber} · ${opts.assetName}`
    : `Depreciación ${opts.period} · ${opts.assetNumber} · ${opts.assetName}`;
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

// ─── Diferidos (06-contabilidad backlog) ───────────────────────
// GASTO:   DR cuenta de gasto (reconocimiento) / CR cuenta de activo diferido (relev el anticipo)
// INGRESO: DR cuenta de pasivo diferido (relev el anticipo) / CR cuenta de ingreso (reconocimiento)
// A diferencia de la depreciación (posting setup fijo), las cuentas vienen del propio
// `DeferredItem` — el usuario las eligió del plan de cuentas real al crearlo, porque la
// naturaleza de un diferido varía mucho (seguros, arriendos, publicidad, suscripciones...).
export async function createDeferredRecognitionEntry(companyId: string, opts: {
  itemId: string; itemNumber: string; description: string; kind: 'GASTO' | 'INGRESO'; period: string; fromPeriod?: string; amount: number;
  deferredAccountCode: string; deferredAccountName: string; recognitionAccountCode: string; recognitionAccountName: string;
  entryDate?: Date;
}) {
  if (opts.amount <= 0) return null;
  // Mismo criterio que `createDepreciationEntry`: `opts.period` va primero para que el regex de
  // reverso lo siga capturando sin cambios.
  const description = opts.fromPeriod
    ? `Diferido ${opts.period} (recupera ${opts.fromPeriod}→${opts.period}) · ${opts.itemNumber} · ${opts.description}`
    : `Diferido ${opts.period} · ${opts.itemNumber} · ${opts.description}`;
  const entryDate = opts.entryDate ?? new Date();
  const entryNumber = await nextEntryNumber(companyId, entryDate);
  const debitAccount = opts.kind === 'GASTO'
    ? { code: opts.recognitionAccountCode, name: opts.recognitionAccountName }
    : { code: opts.deferredAccountCode, name: opts.deferredAccountName };
  const creditAccount = opts.kind === 'GASTO'
    ? { code: opts.deferredAccountCode, name: opts.deferredAccountName }
    : { code: opts.recognitionAccountCode, name: opts.recognitionAccountName };
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber, entryDate, description,
      entityType: 'DEFERRED_ITEM', entityId: opts.itemId,
      totalDebit: opts.amount, totalCredit: opts.amount,
      lines: {
        create: [
          { accountCode: debitAccount.code, accountName: debitAccount.name, debit: opts.amount, credit: 0, description },
          { accountCode: creditAccount.code, accountName: creditAccount.name, debit: 0, credit: opts.amount, description },
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
  lines?: ProductAmount[];
}) {
  const total = Math.round(Number(opts.total) * 100) / 100;
  if (total <= 0) return null;
  const [AR, salesLines, IVAD] = await Promise.all([
    acct(companyId, 'AR'), productAccountLines(companyId, 'SALES', opts.lines, opts.subtotal), acct(companyId, 'IVA_DEBIT'),
  ]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber, description: `NC · ${opts.description}`,
      entityType: 'CREDIT_NOTE', entityId: opts.entityId,
      totalDebit: total, totalCredit: total,
      lines: {
        create: [
          ...salesLines.map((l) => ({ accountCode: l.code, accountName: l.name, debit: l.amount, credit: 0, description: `Reverso de ingreso · ${opts.description}` })),
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
  lines?: ProductAmount[];
}) {
  const cogs = Math.round(Number(opts.cogs) * 100) / 100;
  if (cogs <= 0) return null;
  const [cogsLines, invLines] = await Promise.all([
    productAccountLines(companyId, 'COGS', opts.lines, cogs),
    productAccountLines(companyId, 'INVENTORY', opts.lines, cogs),
  ]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber, description: `NC costo · ${opts.description}`,
      entityType: 'CREDIT_NOTE', entityId: opts.entityId,
      totalDebit: cogs, totalCredit: cogs,
      lines: {
        create: [
          ...invLines.map((l) => ({ accountCode: l.code, accountName: l.name, debit: l.amount, credit: 0, description: `Reingreso a inventario · ${opts.description}` })),
          ...cogsLines.map((l) => ({ accountCode: l.code, accountName: l.name, debit: 0, credit: l.amount, description: `Reverso de costo de ventas · ${opts.description}` })),
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
  args: { amount: number; reference?: string; supplierName?: string; userId?: string; bankAccountId?: string },
) {
  const amount = Math.round(Number(args.amount) * 100) / 100;
  if (amount <= 0) return null;
  const [AP, CASH] = await Promise.all([acct(companyId, 'AP'), cashAcct(companyId, args.bankAccountId)]);
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
  args: {
    amount: number; reference: string; productName: string; lotNumber?: string | null; userId?: string;
    // Con ruta de operaciones (propuesta 03b #3) el asiento va en dos tramos por PRODUCTO EN
    // PROCESO: al entregar materiales (DR WIP / CR RAW) y al cerrar (DR FINISHED / CR WIP).
    debitKey?: 'INVENTORY_FINISHED' | 'INVENTORY_WIP';
    creditKey?: 'INVENTORY_RAW' | 'INVENTORY_WIP';
    entityType?: string;
  },
) {
  const amount = Math.round(Number(args.amount) * 100) / 100;
  if (amount <= 0) return null; // sin costo real no hay hecho económico que registrar

  const [FINISHED, RAW] = await Promise.all([
    acct(companyId, args.debitKey ?? 'INVENTORY_FINISHED'),
    acct(companyId, args.creditKey ?? 'INVENTORY_RAW'),
  ]);
  const toWip = args.debitKey === 'INVENTORY_WIP';
  const entryNumber = await nextEntryNumber(companyId);
  const lote = args.lotNumber ? ` · lote ${args.lotNumber}` : '';

  return prisma.journalEntry.create({
    data: {
      companyId,
      entryNumber,
      description: `${toWip ? 'Entrega a proceso' : 'Producción'} ${args.reference} — ${args.productName}${lote}`,
      entityType: args.entityType ?? 'PRODUCTION',
      entityId: args.reference,
      totalDebit: amount,
      totalCredit: amount,
      status: 'POSTED',
      createdBy: args.userId,
      lines: {
        create: [
          { accountCode: FINISHED.code, accountName: FINISHED.name, debit: amount, credit: 0, description: toWip ? 'Materia prima entregada a producción en proceso' : `Ingreso de producto terminado${lote}` },
          { accountCode: RAW.code, accountName: RAW.name, debit: 0, credit: amount, description: args.creditKey === 'INVENTORY_WIP' ? 'Salida de producto en proceso a terminado' : 'Consumo de materia prima en producción' },
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
  args: { amount: number; isIncrease: boolean; reference?: string; description?: string; userId?: string; productId?: string },
) {
  const amount = Math.round(Number(args.amount) * 100) / 100;
  if (amount <= 0) return null;

  const [invLine] = await productAccountLines(companyId, 'INVENTORY', [{ productId: args.productId, amount }], amount);
  const INV = { code: invLine.code, name: invLine.name };
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
  periodId: string; label: string; net: number; userId?: string; bankAccountId?: string;
}) {
  const net = Math.round(Number(opts.net) * 100) / 100;
  if (net <= 0) throw new Error('No hay netos por pagar en este período');
  const [BENP, CASH] = await Promise.all([acct(companyId, 'PAYROLL_BENEFITS_PAYABLE'), cashAcct(companyId, opts.bankAccountId)]);
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

// Liquidación de décimo tercero/cuarto ACUMULADO (05-07 backlog §6): relev la provisión que se
// venía acumulando mes a mes en PAYROLL_BENEFITS_PAYABLE (líneas EMPLOYER `PROV_DECIMO_TERCERO`/
// `PROV_DECIMO_CUARTO` de cada rol) contra caja. NO se debita PAYROLL_BENEFITS_EXPENSE aquí — el
// gasto YA se reconoció mes a mes al provisionar; volver a debitarlo lo duplicaría.
export async function createDecimoLiquidationEntry(companyId: string, opts: {
  liquidationId: string; label: string; amount: number; userId?: string; bankAccountId?: string;
}) {
  const amount = Math.round(Number(opts.amount) * 100) / 100;
  if (amount <= 0) throw new Error('No hay monto para liquidar');
  const [BENP, CASH] = await Promise.all([acct(companyId, 'PAYROLL_BENEFITS_PAYABLE'), cashAcct(companyId, opts.bankAccountId)]);
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber,
      description: opts.label,
      entityType: 'PAYROLL_DECIMO', entityId: opts.liquidationId,
      totalDebit: amount, totalCredit: amount,
      status: 'POSTED', createdBy: opts.userId,
      lines: {
        create: [
          { accountCode: BENP.code, accountName: BENP.name, debit: amount, credit: 0, description: 'Cancelación de provisión de décimo acumulado' },
          { accountCode: CASH.code, accountName: CASH.name, debit: 0, credit: amount, description: 'Pago de décimo por transferencia' },
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
  amount: number; description: string; entityId?: string; userId?: string; bankAccountId?: string;
}) {
  const amount = Math.round(Number(opts.amount) * 100) / 100;
  if (amount <= 0) return null;
  const [CASH, AR] = await Promise.all([cashAcct(companyId, opts.bankAccountId), acct(companyId, 'AR')]);
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
  kind: 'SRI' | 'IESS'; amount: number; description: string; userId?: string; entityId?: string; bankAccountId?: string;
}) {
  const amount = Math.round(Number(opts.amount) * 100) / 100;
  if (amount <= 0) return null;
  const liabilityKey = opts.kind === 'IESS' ? 'PAYROLL_IESS_PAYABLE' : 'IVA_DEBIT'; // 2010703 | 2010701
  const [LIAB, CASH] = await Promise.all([acct(companyId, liabilityKey), cashAcct(companyId, opts.bankAccountId)]);
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

/** Saldo (crédito − débito) de una cuenta EXACTA — para neteo de cuentas puente/transitorias. */
export async function accountBalance(companyId: string, accountCode: string): Promise<number> {
  const lines = await prisma.journalEntryLine.findMany({
    where: { accountCode, entry: { companyId, status: { not: 'REVERSED' } } },
    select: { debit: true, credit: true },
  });
  return Math.round(lines.reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0) * 100) / 100;
}

// Pago de retenciones en la fuente PRACTICADAS a proveedores (Formulario 103): el pasivo se
// acumula en `RETENTION_PAYABLE_RENTA`/`RETENTION_PAYABLE_IVA` cada vez que se registra una
// compra con retención (`createRetentionEntry`), pero hasta ahora no existía ningún asiento que
// lo liquidara — la cuenta puente acumulaba saldo indefinidamente en vez de netearse al pagar al
// SRI (hallazgo 2026-09-28: pedido explícito de que toda cuenta transitoria se netee). Debita
// cada cuenta configurada por su saldo REAL (neteo exacto, no un monto libre), no dos veces si
// ambas comparten el mismo código (el mapeo por defecto las combina con IVA_DEBIT en "2010701 ·
// Con la administración tributaria" — solo aparece como obligación separada en Tesorería cuando
// el contador las reconfigura a una cuenta propia, ver `treasury.service.ts::getObligations`).
export async function createRetentionPaymentEntry(companyId: string, opts: { bankAccountId?: string; userId?: string }) {
  const [RENTA, IVA] = await Promise.all([acct(companyId, 'RETENTION_PAYABLE_RENTA'), acct(companyId, 'RETENTION_PAYABLE_IVA')]);
  const CASH = await cashAcct(companyId, opts.bankAccountId);
  const byCode = new Map<string, { name: string; amount: number }>();
  for (const account of [RENTA, IVA]) {
    if (byCode.has(account.code)) continue;
    const balance = await accountBalance(companyId, account.code);
    if (balance > 0.005) byCode.set(account.code, { name: account.name, amount: balance });
  }
  const total = Math.round([...byCode.values()].reduce((s, v) => s + v.amount, 0) * 100) / 100;
  if (total <= 0) return null;
  const entryNumber = await nextEntryNumber(companyId);
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber,
      description: 'Pago de retenciones en la fuente por pagar (Formulario 103)',
      entityType: 'TREASURY',
      totalDebit: total, totalCredit: total,
      status: 'POSTED', createdBy: opts.userId,
      lines: {
        create: [
          ...[...byCode.entries()].map(([code, v]) => ({
            accountCode: code, accountName: v.name, debit: v.amount, credit: 0,
            description: 'Cancelación de retenciones por pagar',
          })),
          { accountCode: CASH.code, accountName: CASH.name, debit: 0, credit: total, description: 'Pago retenciones SRI' },
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

// ─── Movimiento bancario creado desde el extracto (comisión, interés, ND/NC bancaria) ──
// Antes se registraba el BankTransaction sin asiento (violaba la regla 2). Egreso:
// DR cuenta elegida (gasto financiero por defecto) / CR banco. Ingreso: DR banco / CR cuenta.
export async function createBankStatementEntry(companyId: string, opts: {
  bankTransactionId: string; bankAccountId: string; amount: number; isIncome: boolean; date: Date;
  account: { code: string; name: string }; description: string; userId?: string;
}) {
  const amount = round2(opts.amount);
  if (amount <= 0) return null;
  const bank = await cashAcct(companyId, opts.bankAccountId);
  const entryNumber = await nextEntryNumber(companyId, opts.date);
  const debit = opts.isIncome ? bank : opts.account;
  const credit = opts.isIncome ? opts.account : bank;
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber, entryDate: opts.date, description: `Extracto bancario — ${opts.description}`,
      entityType: 'BANK_TRANSACTION', entityId: opts.bankTransactionId,
      totalDebit: amount, totalCredit: amount, status: 'POSTED', createdBy: opts.userId,
      lines: {
        create: [
          { accountCode: debit.code, accountName: debit.name, debit: amount, credit: 0, description: opts.description },
          { accountCode: credit.code, accountName: credit.name, debit: 0, credit: amount, description: opts.description },
        ],
      },
    },
    include: { lines: true },
  });
}

// ─── Pago/cobro recurrente (propuesta 07): contra la cuenta de la plantilla ──
export async function createRecurringCashEntry(companyId: string, opts: {
  itemId: string; period: string; description: string; isIncome: boolean; amount: number;
  account: { code: string; name: string }; bankAccountId: string; userId?: string;
}) {
  const amount = round2(opts.amount);
  if (amount <= 0) return null;
  const bank = await cashAcct(companyId, opts.bankAccountId);
  const entryNumber = await nextEntryNumber(companyId);
  const debit = opts.isIncome ? bank : opts.account;
  const credit = opts.isIncome ? opts.account : bank;
  const description = `${opts.isIncome ? 'Cobro' : 'Pago'} recurrente ${opts.period} — ${opts.description}`;
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber, description, entityType: 'RECURRING_CASH', entityId: opts.itemId,
      totalDebit: amount, totalCredit: amount, status: 'POSTED', createdBy: opts.userId,
      lines: { create: [
        { accountCode: debit.code, accountName: debit.name, debit: amount, credit: 0, description },
        { accountCode: credit.code, accountName: credit.name, debit: 0, credit: amount, description },
      ] },
    },
    include: { lines: true },
  });
}

// ─── Revalorización cambiaria (NIC 21): ajusta la subcuenta del banco en moneda extranjera ──
// Ganancia: DR banco / CR diferencia en cambio (ingreso). Pérdida: DR diferencia en cambio / CR banco.
export async function createFxRevaluationEntry(companyId: string, opts: {
  bankAccountId: string; period: string; currency: string; adjustment: number; entryDate: Date;
  bankAccount: { code: string; name: string };
}) {
  const amount = round2(Math.abs(opts.adjustment));
  if (amount <= 0) return null;
  const gain = opts.adjustment > 0;
  const fx = await acct(companyId, gain ? 'FX_GAIN' : 'FX_LOSS');
  const debit = gain ? opts.bankAccount : fx;
  const credit = gain ? fx : opts.bankAccount;
  const description = `Revalorización cambiaria ${opts.currency} ${opts.period} — ${gain ? 'ganancia' : 'pérdida'}`;
  const entryNumber = await nextEntryNumber(companyId, opts.entryDate);
  return prisma.journalEntry.create({
    data: {
      companyId, entryNumber, entryDate: opts.entryDate, description, entityType: 'FX_REVALUATION', entityId: opts.bankAccountId,
      totalDebit: amount, totalCredit: amount, status: 'POSTED',
      lines: { create: [
        { accountCode: debit.code, accountName: debit.name, debit: amount, credit: 0, description },
        { accountCode: credit.code, accountName: credit.name, debit: 0, credit: amount, description },
      ] },
    },
    include: { lines: true },
  });
}

/** Resolver público del posting setup (para servicios que eligen cuenta por defecto). */
export async function mappedAccount(companyId: string, key: string) {
  return acct(companyId, key);
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

  // ── Resincronización del documento origen ──
  // Este endpoint es genérico (cualquier CONTADOR puede reversar CUALQUIER asiento desde
  // Contabilidad, sin pasar por la acción propia del módulo que lo generó). Antes, reversar
  // dejaba el documento origen sin enterarse: un rol de pagos pagado quedaba "PAID" para
  // siempre (sin forma de volver a pagarlo), un `BankTransaction` seguía apuntando a un
  // asiento REVERSED sin poder anularse nunca (`voidTransaction` exige `journalEntryId=null`),
  // y una liquidación de décimos bloqueaba el año/tipo para siempre aunque su pago se hubiera
  // revertido. La validación que puede FALLAR se hace antes de crear el reverso (para no dejar
  // un reverso a medias); la resincronización en sí se aplica después, ya con el reverso posteado.
  let payrollPeriod: { id: string; status: string; paymentEntryId: string | null; journalEntryId: string | null } | null = null;
  if (original.entityType === 'PAYROLL' && original.entityId) {
    payrollPeriod = await prisma.payrollPeriod.findFirst({ where: { id: original.entityId, companyId } });
    if (payrollPeriod?.journalEntryId === original.id && payrollPeriod.status === 'PAID') {
      throw new Error('VALIDATION: este período ya tiene un pago posteado — reversa primero el asiento de pago del rol');
    }
  }

  if (original.entityType === 'SRI_DOCUMENT' && original.entityId) {
    // `SriDocument` no guarda `journalEntryId` (puede tener más de un asiento — compra directa
    // + retención — así que no hay un único link que resincronizar sin ambigüedad). Lo que SÍ
    // se puede y debe bloquear: reversar el asiento de una compra que YA tiene pagos aplicados
    // dejaría un pasivo "pagado" sin haber sido nunca reconocido contablemente — inconsistencia
    // real, no solo de trazabilidad.
    const doc = await prisma.sriDocument.findFirst({ where: { id: original.entityId, companyId }, select: { paidAmount: true } });
    if (doc && Number(doc.paidAmount) > 0.005) {
      throw new Error('VALIDATION: este documento ya tiene pagos aplicados — reversa o ajusta esos pagos primero');
    }
  }

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

  if (payrollPeriod?.paymentEntryId === original.id) {
    // Reversa el PAGO del rol: vuelve a POSTED (el devengo sigue en pie, solo se deshace el pago).
    await prisma.payrollPeriod.update({ where: { id: payrollPeriod.id }, data: { status: 'POSTED', paymentEntryId: null, paidAt: null } });
  } else if (payrollPeriod?.journalEntryId === original.id) {
    // Reversa el DEVENGO (ya se validó arriba que no esté PAID todavía).
    await prisma.payrollPeriod.update({ where: { id: payrollPeriod.id }, data: { status: 'PROCESSED', journalEntryId: null, postedAt: null } });
  }

  if (original.entityType === 'PAYROLL_DECIMO' && original.entityId) {
    // `@@unique([companyId,kind,year])` es un constraint duro — no se puede dejar la fila
    // marcada "REVERSED" y permitir una nueva liquidación bajo la misma clave, así que se
    // borra (cascada a sus items). El reverso mismo (este asiento + el original REVERSED)
    // queda como trazabilidad permanente en el Diario vía entityType/entityId, aunque la fila
    // de origen ya no exista — mismo patrón de referencia "blanda" que usa el resto del ERP.
    await prisma.decimoLiquidation.deleteMany({ where: { id: original.entityId, companyId, journalEntryId: original.id } });
  }

  if (original.entityType === 'RECURRING_CASH' && original.entityId) {
    // El período pagado solo vive en la descripción del asiento ("Pago recurrente 2026-03 — ...").
    // Solo se reabre `lastPaidPeriod` si TODAVÍA apunta a este mismo período — si ya se pagó un
    // período más nuevo después, no hay que tocarlo (protege contra reabrir un mes viejo por error).
    const period = original.description.match(/recurrente (\d{4}-\d{2})/)?.[1];
    if (period) {
      await prisma.recurringCashItem.updateMany({ where: { id: original.entityId, companyId, lastPaidPeriod: period }, data: { lastPaidPeriod: null } });
    }
  }

  if (original.entityType === 'FX_REVALUATION' && original.entityId) {
    // `FxRevaluation.@@unique([companyId,bankAccountId,period])` — mismo problema que
    // `PAYROLL_DECIMO`: no se puede dejar la fila y permitir recalcular la revalorización de
    // ese banco/período bajo la misma clave, así que se borra (nunca contabilizó de más: el
    // registro solo GUARDA el resultado del cálculo, `runFxRevaluation` es quien decide si
    // hace falta asiento según `fx.adjustment !== 0`).
    const period = original.description.match(/cambiaria \w+ (\d{4}-\d{2})/)?.[1];
    if (period) {
      await prisma.fxRevaluation.deleteMany({ where: { companyId, bankAccountId: original.entityId, period, journalEntryId: original.id } });
    }
  }

  if (original.entityType === 'FIXED_ASSET' && original.entityId) {
    // `accumulatedDepreciation`/`lastDepreciatedPeriod` se persisten en `FixedAsset` (no se
    // recalculan desde el Mayor) — sin este resync quedarían inflados para siempre y
    // `isDepreciationDue` seguiría bloqueando ese mismo período. Solo se toca si el activo
    // TODAVÍA está en ese período exacto (si ya corrió un mes más nuevo, no se toca — mismo
    // guard que RECURRING_CASH). `disposeFixedAsset` documenta explícitamente que dar de baja
    // NO revierte la depreciación ya contabilizada (regla 5); este es el camino correcto:
    // reversar el asiento SÍ debe revertir el efecto en el activo, porque el asiento mismo dejó
    // de existir contablemente.
    const period = original.description.match(/Depreciación (\d{4}-\d{2})/)?.[1];
    const asset = await prisma.fixedAsset.findFirst({ where: { id: original.entityId, companyId } });
    if (period && asset?.lastDepreciatedPeriod === period) {
      const newAccumulated = Math.max(0, Number(asset.accumulatedDepreciation) - Number(original.totalDebit));
      await prisma.fixedAsset.update({
        where: { id: asset.id },
        data: {
          accumulatedDepreciation: new Prisma.Decimal(newAccumulated),
          lastDepreciatedPeriod: null,
          status: asset.status === 'FULLY_DEPRECIATED' ? 'ACTIVE' : asset.status,
        },
      });
    }
  }

  if (original.entityType === 'DEFERRED_ITEM' && original.entityId) {
    // Mismo patrón exacto que FIXED_ASSET: `recognizedAmount`/`lastRecognizedPeriod` en
    // `DeferredItem` no se recalculan desde el Mayor.
    const period = original.description.match(/Diferido (\d{4}-\d{2})/)?.[1];
    const item = await prisma.deferredItem.findFirst({ where: { id: original.entityId, companyId } });
    if (period && item?.lastRecognizedPeriod === period) {
      const newRecognized = Math.max(0, Number(item.recognizedAmount) - Number(original.totalDebit));
      await prisma.deferredItem.update({
        where: { id: item.id },
        data: {
          recognizedAmount: new Prisma.Decimal(newRecognized),
          lastRecognizedPeriod: null,
          status: item.status === 'COMPLETED' ? 'ACTIVE' : item.status,
        },
      });
    }
  }

  // Cualquier `BankTransaction` que citaba este asiento (pago/cobro de CxP/CxC, impuestos,
  // recurrentes) queda con la referencia colgando de un asiento REVERSED — `voidTransaction`
  // exige `journalEntryId=null` para anular, así que sin esto el movimiento bancario queda
  // "zombie": no se puede ni anular ni conciliar contra nada real. Genérico por diseño: cubre
  // TODOS los orígenes (AP/AR/impuestos/recurrentes), no solo `entityType==='TREASURY'`.
  await prisma.bankTransaction.updateMany({ where: { companyId, journalEntryId: original.id }, data: { journalEntryId: null } });

  // `InventoryAdjustment.journalEntryId` (entityId de este asiento es el `adjNumber`, no el id
  // — así se guardó siempre, ver `createInventoryAdjustmentEntry`) también queda apuntando a un
  // asiento REVERSED si no se limpia. Sin gate de negocio detrás (a diferencia de
  // `voidTransaction`), pero rompe la trazabilidad asiento↔ajuste (regla 4) si se deja colgando.
  if (original.entityType === 'INVENTORY' && original.entityId) {
    await prisma.inventoryAdjustment.updateMany({ where: { companyId, adjNumber: original.entityId, journalEntryId: original.id }, data: { journalEntryId: null } });
  }

  return reversal;
}
