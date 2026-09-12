import { prisma } from '../lib/prisma';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';
import { Response } from 'express';
import { getErpConfig } from './erp-config.service';
// ─── Helpers ──────────────────────────────────────────────────────────────────

function styleHeaderRow(ws: ExcelJS.Worksheet, row: number, cols: number) {
  const headerRow = ws.getRow(row);
  for (let i = 1; i <= cols; i++) {
    headerRow.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    headerRow.getCell(i).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.getCell(i).alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.getCell(i).border = {
      bottom: { style: 'thin', color: { argb: 'FF93C5FD' } },
    };
  }
  headerRow.height = 22;
}

function addPDFHeader(doc: PDFKit.PDFDocument, title: string) {
  doc.rect(0, 0, doc.page.width, 80).fill('#1E40AF');
  doc.fillColor('white').fontSize(22).font('Helvetica-Bold').text('KallpaPro ERP', 40, 20);
  doc.fontSize(12).font('Helvetica').text(title, 40, 50);
  doc.fillColor('#111827').moveDown(2);
}

// ─── Excel: Inventario ────────────────────────────────────────────────────────

export async function exportInventoryExcel(companyId: string, res: Response) {
  const products = await prisma.product.findMany({
    where: { companyId, isActive: true },
    include: {
      category: { select: { name: true } },
      stocks: { include: { warehouse: { select: { name: true } } } },
    },
    orderBy: { name: 'asc' },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'KallpaPro';
  const ws = wb.addWorksheet('Inventario');

  ws.columns = [
    { header: 'Código', key: 'sku', width: 14 },
    { header: 'Producto', key: 'name', width: 30 },
    { header: 'Categoría', key: 'category', width: 18 },
    { header: 'Unidad', key: 'unit', width: 10 },
    { header: 'Stock Total', key: 'stock', width: 13 },
    { header: 'Costo Prom.', key: 'avgCost', width: 14 },
    { header: 'Precio Venta', key: 'salePrice', width: 14 },
    { header: 'Valor Stock', key: 'valor', width: 15 },
    { header: 'Método Val.', key: 'valuation', width: 14 },
    { header: 'Stock Mínimo', key: 'minStock', width: 13 },
    { header: 'Alerta', key: 'alert', width: 10 },
    { header: 'Bodega(s)', key: 'warehouses', width: 24 },
  ];

  styleHeaderRow(ws, 1, 12);

  products.forEach((p) => {
    const totalStock = p.stocks.reduce((s, st) => s + Number(st.quantity), 0);
    const valor = totalStock * Number(p.avgCost);
    const bodegas = p.stocks.map((st) => `${st.warehouse.name}: ${Number(st.quantity)}`).join(', ');

    ws.addRow({
      sku: p.sku || '',
      name: p.name,
      category: p.category?.name || '',
      unit: p.unit,
      stock: totalStock,
      avgCost: Number(p.avgCost),
      salePrice: Number(p.salePrice),
      valor,
      valuation: p.valuationMethod,
      minStock: Number(p.minStock),
      alert: totalStock <= Number(p.minStock) ? '⚠️ Bajo' : 'OK',
      warehouses: bodegas,
    });
  });

  // Format numbers
  ws.getColumn('avgCost').numFmt = '"$"#,##0.0000';
  ws.getColumn('salePrice').numFmt = '"$"#,##0.00';
  ws.getColumn('valor').numFmt = '"$"#,##0.00';

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="inventario.xlsx"');
  await wb.xlsx.write(res);
}

// ─── Excel: Compras ───────────────────────────────────────────────────────────

export async function exportPurchasesExcel(companyId: string, from: string | undefined, to: string | undefined, res: Response) {
  const where: any = { companyId };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to + 'T23:59:59Z');
  }

  const orders = await prisma.purchaseOrder.findMany({
    where,
    include: {
      supplier: { select: { name: true, ruc: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Órdenes de Compra');

  ws.columns = [
    { header: 'N° OC', key: 'poNumber', width: 14 },
    { header: 'Proveedor', key: 'supplier', width: 28 },
    { header: 'RUC', key: 'ruc', width: 14 },
    { header: 'Fecha', key: 'date', width: 13 },
    { header: 'Total', key: 'total', width: 14 },
    { header: 'Estado', key: 'status', width: 14 },
    { header: 'Fecha Entrega', key: 'delivery', width: 15 },
  ];

  styleHeaderRow(ws, 1, 7);

  orders.forEach((o) => {
    ws.addRow({
      poNumber: o.poNumber,
      supplier: o.supplier.name,
      ruc: o.supplier.ruc || '',
      date: new Date(o.createdAt).toLocaleDateString('es'),
      total: Number(o.totalAmount),
      status: o.status,
      delivery: o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString('es') : '',
    });
  });

  ws.getColumn('total').numFmt = '"$"#,##0.00';

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="compras.xlsx"');
  await wb.xlsx.write(res);
}

// ─── Excel: Ventas ────────────────────────────────────────────────────────────

export async function exportSalesExcel(companyId: string, from: string | undefined, to: string | undefined, res: Response) {
  const where: any = { companyId };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to + 'T23:59:59Z');
  }

  const orders = await prisma.salesOrder.findMany({
    where,
    include: {
      customer: { select: { name: true, ruc: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Ventas');

  ws.columns = [
    { header: 'N° OV', key: 'orderNumber', width: 14 },
    { header: 'Cliente', key: 'customer', width: 28 },
    { header: 'RUC/ID', key: 'ruc', width: 14 },
    { header: 'Fecha', key: 'date', width: 13 },
    { header: 'Total', key: 'total', width: 14 },
    { header: 'Estado', key: 'status', width: 14 },
  ];

  styleHeaderRow(ws, 1, 6);

  orders.forEach((o) => {
    ws.addRow({
      orderNumber: o.orderNumber,
      customer: o.customer.name,
      ruc: o.customer.ruc || '',
      date: new Date(o.createdAt).toLocaleDateString('es'),
      total: Number(o.total),
      status: o.status,
    });
  });

  ws.getColumn('total').numFmt = '"$"#,##0.00';

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="ventas.xlsx"');
  await wb.xlsx.write(res);
}

// ─── Excel: Proveedores ───────────────────────────────────────────────────────

export async function exportSuppliersExcel(companyId: string, res: Response) {
  const suppliers: any[] = await prisma.supplier.findMany({
    where: { companyId },
    include: {
      score: { select: { totalScore: true, qualityScore: true, deliveryScore: true, priceScore: true, complianceScore: true } },
      purchaseOrders: { select: { id: true, totalAmount: true } },
    },
    orderBy: { name: 'asc' },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Proveedores');

  ws.columns = [
    { header: 'Proveedor', key: 'name', width: 28 },
    { header: 'RUC', key: 'ruc', width: 14 },
    { header: 'Email', key: 'email', width: 26 },
    { header: 'Teléfono', key: 'phone', width: 14 },
    { header: 'OCs Totales', key: 'totalOC', width: 13 },
    { header: 'Monto Total', key: 'totalAmount', width: 15 },
    { header: 'Score Total', key: 'score', width: 12 },
    { header: 'Calidad', key: 'quality', width: 10 },
    { header: 'Entrega', key: 'delivery', width: 10 },
    { header: 'Precio', key: 'price', width: 10 },
    { header: 'Estado', key: 'status', width: 10 },
  ];

  styleHeaderRow(ws, 1, 11);

  suppliers.forEach((s: any) => {
    const totalAmount = (s.purchaseOrders || []).reduce((sum: number, o: any) => sum + Number(o.totalAmount), 0);
    ws.addRow({
      name: s.name,
      ruc: s.ruc || '',
      email: s.email || '',
      phone: s.phone || '',
      totalOC: (s.purchaseOrders || []).length,
      totalAmount,
      score: s.score ? Number(s.score.totalScore) : '',
      quality: s.score ? Number(s.score.qualityScore) : '',
      delivery: s.score ? Number(s.score.deliveryScore) : '',
      price: s.score ? Number(s.score.priceScore) : '',
      status: s.isActive ? 'Activo' : 'Inactivo',
    });
  });

  ws.getColumn('totalAmount').numFmt = '"$"#,##0.00';

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="proveedores.xlsx"');
  await wb.xlsx.write(res);
}

// ─── Excel: GL ────────────────────────────────────────────────────────────────

export async function exportGLExcel(companyId: string, from: string | undefined, to: string | undefined, res: Response) {
  const where: any = { companyId };
  if (from || to) {
    where.entryDate = {};
    if (from) where.entryDate.gte = new Date(from);
    if (to) where.entryDate.lte = new Date(to + 'T23:59:59Z');
  }

  const entries = await prisma.journalEntry.findMany({
    where,
    include: { lines: true },
    orderBy: { entryDate: 'asc' },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Asientos GL');

  ws.columns = [
    { header: 'N° Asiento', key: 'number', width: 14 },
    { header: 'Fecha', key: 'date', width: 13 },
    { header: 'Descripción', key: 'desc', width: 30 },
    { header: 'Cuenta', key: 'account', width: 12 },
    { header: 'Nombre Cuenta', key: 'accountName', width: 24 },
    { header: 'Débito', key: 'debit', width: 14 },
    { header: 'Crédito', key: 'credit', width: 14 },
    { header: 'Estado', key: 'status', width: 10 },
  ];

  styleHeaderRow(ws, 1, 8);

  entries.forEach((e) => {
    e.lines.forEach((line, idx) => {
      ws.addRow({
        number: idx === 0 ? e.entryNumber : '',
        date: idx === 0 ? new Date(e.entryDate).toLocaleDateString('es') : '',
        desc: idx === 0 ? e.description : '',
        account: line.accountCode,
        accountName: line.accountName,
        debit: Number(line.debit),
        credit: Number(line.credit),
        status: idx === 0 ? e.status : '',
      });
    });
  });

  ws.getColumn('debit').numFmt = '"$"#,##0.00';
  ws.getColumn('credit').numFmt = '"$"#,##0.00';

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="asientos-gl.xlsx"');
  await wb.xlsx.write(res);
}

// ─── PDF: Orden de Compra ─────────────────────────────────────────────────────

export async function exportPOPdf(id: string, companyId: string, res: Response) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, companyId },
    include: {
      supplier: true,
      items: { include: { product: { select: { name: true, sku: true, unit: true } } } },
    },
  });
  if (!po) throw new Error('PO_NOT_FOUND');

  const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="OC-${po.poNumber}.pdf"`);
  doc.pipe(res);

  addPDFHeader(doc, `Orden de Compra ${po.poNumber}`);

  // Supplier info
  doc.fontSize(10).font('Helvetica-Bold').text('Proveedor:', { continued: true });
  doc.font('Helvetica').text(` ${po.supplier.name}`);
  if (po.supplier.ruc) { doc.font('Helvetica-Bold').text('RUC:', { continued: true }); doc.font('Helvetica').text(` ${po.supplier.ruc}`); }
  if (po.supplier.email) { doc.font('Helvetica-Bold').text('Email:', { continued: true }); doc.font('Helvetica').text(` ${po.supplier.email}`); }
  doc.moveDown();

  // Items table header
  doc.font('Helvetica-Bold').fontSize(10);
  const cols = [40, 260, 60, 80, 90];
  const colX = [40, 90, 350, 410, 490];
  const headerY = doc.y;
  doc.rect(35, headerY - 2, 540, 18).fill('#1E40AF');
  doc.fillColor('white');
  ['#', 'Producto', 'Cant.', 'Precio Unit.', 'Total'].forEach((h, i) => {
    doc.text(h, colX[i], headerY + 1, { width: cols[i], align: i >= 2 ? 'right' : 'left' });
  });
  doc.fillColor('#111827').font('Helvetica').fontSize(9);

  let y = headerY + 22;
  let grandTotal = 0;
  po.items.forEach((item, idx) => {
    const subtotal = Number(item.quantity) * Number(item.unitPrice);
    grandTotal += subtotal;
    if (idx % 2 === 0) doc.rect(35, y - 2, 540, 16).fill('#F9FAFB').fillColor('#111827');
    doc.text(String(idx + 1), colX[0], y, { width: cols[0] });
    doc.text(item.product?.name ?? '', colX[1], y, { width: cols[1] });
    doc.text(`${Number(item.quantity)} ${item.product?.unit ?? ''}`, colX[2], y, { width: cols[2], align: 'right' });
    doc.text(`$${Number(item.unitPrice).toFixed(2)}`, colX[3], y, { width: cols[3], align: 'right' });
    doc.text(`$${subtotal.toFixed(2)}`, colX[4], y, { width: cols[4], align: 'right' });
    y += 18;
  });

  doc.moveDown(2);
  doc.font('Helvetica-Bold').fontSize(12).text(`Total: $${grandTotal.toFixed(2)}`, { align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('#6B7280').text(`Estado: ${po.status}  |  Fecha: ${new Date(po.createdAt).toLocaleDateString('es')}`, { align: 'right' });

  doc.end();
}

// ─── PDF: Requisición ─────────────────────────────────────────────────────────

export async function exportRequisitionPdf(id: string, companyId: string, res: Response) {
  const req = await prisma.requisition.findFirst({
    where: { id, companyId },
    include: {
      items: { include: { product: { select: { name: true, sku: true, unit: true } } } },
      department: { select: { name: true } },
    },
  });
  if (!req) throw new Error('REQUISITION_NOT_FOUND');

  const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="REQ-${req.reqNumber}.pdf"`);
  doc.pipe(res);

  addPDFHeader(doc, `Requisición ${req.reqNumber}`);

  doc.fontSize(10).font('Helvetica-Bold').text('Título:', { continued: true });
  doc.font('Helvetica').text(` ${req.title}`);
  if (req.department) { doc.font('Helvetica-Bold').text('Departamento:', { continued: true }); doc.font('Helvetica').text(` ${req.department.name}`); }
  doc.font('Helvetica-Bold').text('Estado:', { continued: true });
  doc.font('Helvetica').text(` ${req.status}`);
  doc.font('Helvetica-Bold').text('Prioridad:', { continued: true });
  doc.font('Helvetica').text(` ${req.priority}`);
  doc.moveDown();

  const colX = [40, 90, 330, 390, 470];
  const cols = [40, 240, 60, 80, 90];
  const headerY = doc.y;
  doc.rect(35, headerY - 2, 540, 18).fill('#1E40AF');
  doc.fillColor('white').font('Helvetica-Bold').fontSize(10);
  ['#', 'Descripción', 'Cant.', 'Unidad', 'Costo Est.'].forEach((h, i) => {
    doc.text(h, colX[i], headerY + 1, { width: cols[i], align: i >= 2 ? 'right' : 'left' });
  });
  doc.fillColor('#111827').font('Helvetica').fontSize(9);

  let y = headerY + 22;
  req.items.forEach((item, idx) => {
    if (idx % 2 === 0) doc.rect(35, y - 2, 540, 16).fill('#F9FAFB').fillColor('#111827');
    doc.text(String(idx + 1), colX[0], y, { width: cols[0] });
    doc.text(item.description, colX[1], y, { width: cols[1] });
    doc.text(String(Number(item.quantity)), colX[2], y, { width: cols[2], align: 'right' });
    doc.text(item.unit, colX[3], y, { width: cols[3], align: 'right' });
    doc.text(`$${Number(item.estimatedCost).toFixed(2)}`, colX[4], y, { width: cols[4], align: 'right' });
    y += 18;
  });

  doc.moveDown(2);
  doc.font('Helvetica-Bold').fontSize(12).text(`Total Estimado: $${Number(req.totalEstimated).toFixed(2)}`, { align: 'right' });

  doc.end();
}

// ─── Excel: Producción ────────────────────────────────────────────────────────

export async function exportProductionExcel(companyId: string, from: string | undefined, to: string | undefined, res: Response) {
  const where: any = { companyId };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to + 'T23:59:59Z');
  }

  const orders = await prisma.productionOrder.findMany({
    where,
    include: {
      product: { select: { name: true, sku: true, unit: true } },
      warehouse: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Producción');

  ws.columns = [
    { header: 'N° Orden', key: 'number', width: 14 },
    { header: 'Producto', key: 'product', width: 28 },
    { header: 'Bodega', key: 'warehouse', width: 18 },
    { header: 'Cantidad', key: 'qty', width: 12 },
    { header: 'Producido', key: 'done', width: 12 },
    { header: 'Estado', key: 'status', width: 14 },
    { header: 'Inicio Plan.', key: 'plannedStart', width: 14 },
    { header: 'Fin Plan.', key: 'plannedEnd', width: 14 },
    { header: 'Inicio Real', key: 'actualStart', width: 14 },
    { header: 'Fin Real', key: 'actualEnd', width: 14 },
    { header: 'Eficiencia %', key: 'efficiency', width: 13 },
  ];

  styleHeaderRow(ws, 1, 11);

  orders.forEach((o) => {
    const efficiency = Number(o.quantity) > 0 ? (Number(o.quantityDone) / Number(o.quantity)) * 100 : 0;
    ws.addRow({
      number: o.poNumber,
      product: o.product.name,
      warehouse: o.warehouse.name,
      qty: Number(o.quantity),
      done: Number(o.quantityDone),
      status: o.status,
      plannedStart: o.plannedStart ? new Date(o.plannedStart).toLocaleDateString('es') : '',
      plannedEnd: o.plannedEnd ? new Date(o.plannedEnd).toLocaleDateString('es') : '',
      actualStart: o.actualStart ? new Date(o.actualStart).toLocaleDateString('es') : '',
      actualEnd: o.actualEnd ? new Date(o.actualEnd).toLocaleDateString('es') : '',
      efficiency: efficiency.toFixed(1),
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="produccion.xlsx"');
  await wb.xlsx.write(res);
}

// ─── PDF: Factura de Venta (FAC-V) ──────────────────────────────────────────────

/** Renderiza la cabecera emisor (empresa) + cliente. Reutilizado por factura y NC. */
function addPartiesBlock(
  doc: PDFKit.PDFDocument,
  issuer: { name: string; ruc?: string; address?: string; city?: string },
  customer: { name: string; ruc?: string | null; address?: string | null } | null,
  rightInfo: string,
) {
  const top = doc.y;
  // Emisor (izquierda)
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text(issuer.name, 40, top, { width: 280 });
  doc.font('Helvetica').fontSize(8).fillColor('#6B7280');
  if (issuer.ruc) doc.text(`RUC: ${issuer.ruc}`, { width: 280 });
  if (issuer.address) doc.text(`${issuer.address}${issuer.city ? ', ' + issuer.city : ''}`, { width: 280 });
  // Cliente (derecha)
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text('Cliente', 320, top, { width: 255, align: 'right' });
  doc.font('Helvetica').fontSize(8).fillColor('#374151');
  doc.text(customer?.name ?? '—', 320, doc.y, { width: 255, align: 'right' });
  if (customer?.ruc) doc.text(`RUC/CI: ${customer.ruc}`, 320, doc.y, { width: 255, align: 'right' });
  doc.fillColor('#6B7280').fontSize(8).text(rightInfo, 320, doc.y, { width: 255, align: 'right' });
  doc.fillColor('#111827').moveDown(1.5);
}

/** Tabla estándar de ítems (#, Descripción, Cant., P.Unit., Total). Devuelve la Y final. */
function renderItemsTable(doc: PDFKit.PDFDocument, rows: Array<{ desc: string; qty: number; unitPrice: number; total: number }>) {
  const cols = [30, 260, 60, 90, 90];
  const colX = [40, 75, 345, 405, 495];
  const headerY = doc.y;
  doc.font('Helvetica-Bold').fontSize(9);
  doc.rect(35, headerY - 2, 540, 18).fill('#1E40AF').fillColor('white');
  ['#', 'Descripción', 'Cant.', 'P. Unit.', 'Total'].forEach((h, i) => {
    doc.text(h, colX[i], headerY + 1, { width: cols[i], align: i >= 2 ? 'right' : 'left' });
  });
  doc.fillColor('#111827').font('Helvetica').fontSize(9);
  let y = headerY + 22;
  rows.forEach((r, idx) => {
    if (y > 700) { doc.addPage(); y = 50; }
    if (idx % 2 === 0) { doc.rect(35, y - 2, 540, 16).fill('#F9FAFB'); doc.fillColor('#111827'); }
    doc.text(String(idx + 1), colX[0], y, { width: cols[0] });
    doc.text(r.desc, colX[1], y, { width: cols[1] });
    doc.text(String(r.qty), colX[2], y, { width: cols[2], align: 'right' });
    doc.text(`$${r.unitPrice.toFixed(2)}`, colX[3], y, { width: cols[3], align: 'right' });
    doc.text(`$${r.total.toFixed(2)}`, colX[4], y, { width: cols[4], align: 'right' });
    y += 18;
  });
  doc.y = y + 6;
}

// ─── RIDE: bloque de información tributaria del comprobante electrónico ────────
// Se imprime SOLO si el comprobante fue AUTORIZADO por el SRI (`claveAcceso` presente);
// para uno que no se emitió electrónicamente, el PDF sigue siendo la factura/NC interna de
// siempre (sin este bloque) — no se inventa una autorización que no existe.
interface SriRideInfo {
  ambiente: string | null;
  claveAcceso: string | null;
  numeroAutorizacion: string | null;
  fechaAutorizacion: Date | null;
}

async function addSriRideBlock(doc: PDFKit.PDFDocument, info: SriRideInfo) {
  if (!info.claveAcceso) return;
  const boxY = doc.y;
  const boxHeight = 92;
  doc.rect(35, boxY, 540, boxHeight).fill('#F0FDF4').stroke('#BBF7D0');
  doc.fillColor('#166534').font('Helvetica-Bold').fontSize(9)
    .text(info.ambiente === 'PRODUCCION' ? 'COMPROBANTE ELECTRÓNICO — AUTORIZADO SRI' : 'COMPROBANTE ELECTRÓNICO — AMBIENTE DE PRUEBAS (SIN VALIDEZ TRIBUTARIA)', 45, boxY + 8, { width: 380 });
  doc.font('Helvetica').fontSize(8).fillColor('#111827');
  doc.text(`Nº Autorización: ${info.numeroAutorizacion ?? '—'}`, 45, boxY + 24, { width: 380 });
  doc.text(`Fecha autorización: ${info.fechaAutorizacion ? new Date(info.fechaAutorizacion).toLocaleString('es-EC') : '—'}`, 45, boxY + 38, { width: 380 });
  doc.text(`Clave de acceso:`, 45, boxY + 52, { width: 380 });
  doc.font('Helvetica').fontSize(7).text(info.claveAcceso, 45, boxY + 64, { width: 380 });

  try {
    const png = await bwipjs.toBuffer({ bcid: 'code128', text: info.claveAcceso, scale: 2, height: 10, includetext: false, backgroundcolor: 'FFFFFF' });
    doc.image(png, 440, boxY + 10, { fit: [125, 40] });
  } catch {
    // Si el barcode falla (entorno sin fuentes, etc.) el RIDE sigue siendo válido con la
    // clave de acceso en texto — el código de barras es una comodidad de lectura, no el dato legal.
  }
  doc.y = boxY + boxHeight + 10;
}

export async function exportSalesInvoicePdf(id: string, companyId: string, res: Response) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId, type: 'SALES' },
    include: { items: true, withholdings: true, salesOrder: { include: { customer: true } } },
  });
  if (!invoice) throw new Error('INVOICE_NOT_FOUND');

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const cfg = await getErpConfig(companyId);
  const customer = invoice.salesOrder?.customer ?? null;

  const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${invoice.number}.pdf"`);
  doc.pipe(res);

  addPDFHeader(doc, `Factura de Venta ${invoice.number}`);
  addPartiesBlock(
    doc,
    { name: company?.name ?? 'Empresa', ruc: cfg.company?.ruc, address: cfg.company?.address, city: cfg.company?.city },
    customer ? { name: customer.razonSocial || customer.name, ruc: customer.ruc, address: customer.address } : null,
    `Emisión: ${new Date(invoice.issueDate).toLocaleDateString('es')}   ·   Estado: ${invoice.status}`,
  );

  renderItemsTable(doc, invoice.items.map((it) => ({
    desc: it.description, qty: Number(it.quantity), unitPrice: Number(it.unitPrice), total: Number(it.lineTotal),
  })));

  // Totales + retenciones
  const total = Number(invoice.totalAmount);
  const totalWithheld = invoice.withholdings.reduce((s, w) => s + Number(w.valor), 0);
  doc.moveDown(0.5).font('Helvetica-Bold').fontSize(11).text(`Total: $${total.toFixed(2)}`, { align: 'right' });

  if (invoice.withholdings.length > 0) {
    doc.moveDown(0.5).font('Helvetica-Bold').fontSize(9).fillColor('#374151').text('Retenciones del cliente:', { align: 'left' });
    doc.font('Helvetica').fontSize(8).fillColor('#6B7280');
    invoice.withholdings.forEach((w) => {
      doc.text(`${w.tipo} ${w.codigo} · base $${Number(w.baseImponible).toFixed(2)} · ${Number(w.porcentaje).toFixed(2)}%   →   -$${Number(w.valor).toFixed(2)}`, { align: 'right' });
    });
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(`Neto a cobrar: $${(total - totalWithheld).toFixed(2)}`, { align: 'right' });
  }

  doc.moveDown(1);
  await addSriRideBlock(doc, { ambiente: invoice.sriAmbiente, claveAcceso: invoice.claveAcceso, numeroAutorizacion: invoice.numeroAutorizacion, fechaAutorizacion: invoice.fechaAutorizacion });

  doc.end();
}

// ─── PDF: Nota de Crédito (NC) ──────────────────────────────────────────────────

export async function exportCreditNotePdf(id: string, companyId: string, res: Response) {
  const cn = await prisma.creditNote.findFirst({
    where: { id, companyId },
    include: { items: true, invoice: { include: { salesOrder: { include: { customer: true } } } } },
  });
  if (!cn) throw new Error('CREDIT_NOTE_NOT_FOUND');

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const cfg = await getErpConfig(companyId);
  const customer = cn.invoice?.salesOrder?.customer ?? null;

  const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${cn.number}.pdf"`);
  doc.pipe(res);

  const invoiceIssueDate = cn.invoice?.issueDate ? new Date(cn.invoice.issueDate) : null;

  addPDFHeader(doc, `Nota de Crédito ${cn.number}`);
  addPartiesBlock(
    doc,
    { name: company?.name ?? 'Empresa', ruc: cfg.company?.ruc, address: cfg.company?.address, city: cfg.company?.city },
    customer ? { name: customer.razonSocial || customer.name, ruc: customer.ruc, address: customer.address } : null,
    `Emisión NC: ${new Date(cn.createdAt).toLocaleDateString('es')}`,
  );

  renderItemsTable(doc, cn.items.map((it) => {
    const sub = Number(it.quantity) * Number(it.unitPrice) * (1 - Number(it.discount) / 100);
    const lineTotal = sub * (1 + Number(it.taxRate) / 100);
    return { desc: it.description, qty: Number(it.quantity), unitPrice: Number(it.unitPrice), total: lineTotal };
  }));

  // Totales (almacenados en la NC)
  doc.moveDown(0.5).font('Helvetica').fontSize(9).fillColor('#6B7280');
  doc.text(`Subtotal: $${Number(cn.subtotal).toFixed(2)}`, { align: 'right' });
  doc.text(`IVA: $${Number(cn.taxAmount).toFixed(2)}`, { align: 'right' });
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(`Total acreditado: $${Number(cn.total).toFixed(2)}`, { align: 'right' });

  // ── Documento sustento (modificado) ─────────────────────────────────────────
  // Bloque estructurado: tipo + número + fecha de emisión del documento que esta NC
  // modifica, más el motivo. Es la información que el SRI exige en el XML de una nota
  // de crédito electrónica (docModificado/numDocModificado/fechaEmisionDocSustento/
  // motivo); se imprime aquí aunque hoy el PDF sea interno, para dejar el dato completo
  // y auditable en el propio comprobante (patrón de referencia: RIDE de Odoo).
  doc.moveDown(1);
  const boxY = doc.y;
  doc.rect(35, boxY, 540, 70).fill('#F9FAFB').stroke('#E5E7EB');
  doc.fillColor('#374151').font('Helvetica-Bold').fontSize(9).text('DOCUMENTO SUSTENTO (MODIFICADO)', 45, boxY + 8);
  doc.font('Helvetica').fontSize(9).fillColor('#111827');
  doc.text(`Tipo: Factura de Venta   ·   Nº: ${cn.invoice?.number ?? '—'}   ·   Fecha de emisión: ${invoiceIssueDate ? invoiceIssueDate.toLocaleDateString('es') : '—'}`, 45, boxY + 24);
  doc.font('Helvetica-Bold').fillColor('#374151').text('Motivo:', 45, boxY + 42, { continued: true });
  doc.font('Helvetica').fillColor('#6B7280').text(` ${cn.reason}${cn.restock ? '' : ' (sin reingreso a stock — merma)'}`, { width: 480 });
  doc.y = boxY + 80;

  await addSriRideBlock(doc, { ambiente: cn.sriAmbiente, claveAcceso: cn.claveAcceso, numeroAutorizacion: cn.numeroAutorizacion, fechaAutorizacion: cn.fechaAutorizacion });

  doc.end();
}

// ─── PDF: Nota de Débito (ND) ───────────────────────────────────────────────────
// Sin `detalles` (a diferencia de factura/NC, ver nota-debito-xml.engine.ts): tabla de
// motivos (razón + valor) en vez de la tabla de ítems con cantidad/precio unitario.
function renderMotivosTable(doc: PDFKit.PDFDocument, rows: Array<{ desc: string; amount: number }>) {
  const cols = [420, 120];
  const colX = [40, 460];
  const headerY = doc.y;
  doc.font('Helvetica-Bold').fontSize(9);
  doc.rect(35, headerY - 2, 540, 18).fill('#1E40AF').fillColor('white');
  ['Motivo', 'Valor'].forEach((h, i) => doc.text(h, colX[i], headerY + 1, { width: cols[i], align: i === 1 ? 'right' : 'left' }));
  doc.fillColor('#111827').font('Helvetica').fontSize(9);
  let y = headerY + 22;
  rows.forEach((r, idx) => {
    if (y > 700) { doc.addPage(); y = 50; }
    if (idx % 2 === 0) { doc.rect(35, y - 2, 540, 16).fill('#F9FAFB'); doc.fillColor('#111827'); }
    doc.text(r.desc, colX[0], y, { width: cols[0] });
    doc.text(`$${r.amount.toFixed(2)}`, colX[1], y, { width: cols[1], align: 'right' });
    y += 18;
  });
  doc.y = y + 6;
}

export async function exportDebitNotePdf(id: string, companyId: string, res: Response) {
  const dn = await prisma.debitNote.findFirst({
    where: { id, companyId },
    include: { concepts: true, invoice: { include: { salesOrder: { include: { customer: true } } } } },
  });
  if (!dn) throw new Error('DEBIT_NOTE_NOT_FOUND');

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const cfg = await getErpConfig(companyId);
  const customer = dn.invoice?.salesOrder?.customer ?? null;

  const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${dn.number}.pdf"`);
  doc.pipe(res);

  const invoiceIssueDate = dn.invoice?.issueDate ? new Date(dn.invoice.issueDate) : null;

  addPDFHeader(doc, `Nota de Débito ${dn.number}`);
  addPartiesBlock(
    doc,
    { name: company?.name ?? 'Empresa', ruc: cfg.company?.ruc, address: cfg.company?.address, city: cfg.company?.city },
    customer ? { name: customer.razonSocial || customer.name, ruc: customer.ruc, address: customer.address } : null,
    `Emisión ND: ${new Date(dn.createdAt).toLocaleDateString('es')}`,
  );

  renderMotivosTable(doc, dn.concepts.map((c) => ({ desc: c.description, amount: Number(c.amount) })));

  doc.moveDown(0.5).font('Helvetica').fontSize(9).fillColor('#6B7280');
  doc.text(`Subtotal: $${Number(dn.subtotal).toFixed(2)}`, { align: 'right' });
  doc.text(`IVA (${Number(dn.taxRate).toFixed(2)}%): $${Number(dn.taxAmount).toFixed(2)}`, { align: 'right' });
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(`Total: $${Number(dn.total).toFixed(2)}`, { align: 'right' });

  doc.moveDown(1);
  const boxY = doc.y;
  doc.rect(35, boxY, 540, 70).fill('#F9FAFB').stroke('#E5E7EB');
  doc.fillColor('#374151').font('Helvetica-Bold').fontSize(9).text('DOCUMENTO SUSTENTO (MODIFICADO)', 45, boxY + 8);
  doc.font('Helvetica').fontSize(9).fillColor('#111827');
  doc.text(`Tipo: Factura de Venta   ·   Nº: ${dn.invoice?.number ?? '—'}   ·   Fecha de emisión: ${invoiceIssueDate ? invoiceIssueDate.toLocaleDateString('es') : '—'}`, 45, boxY + 24);
  doc.font('Helvetica-Bold').fillColor('#374151').text('Motivo general:', 45, boxY + 42, { continued: true });
  doc.font('Helvetica').fillColor('#6B7280').text(` ${dn.reason}`, { width: 480 });
  doc.y = boxY + 80;

  await addSriRideBlock(doc, { ambiente: dn.sriAmbiente, claveAcceso: dn.claveAcceso, numeroAutorizacion: dn.numeroAutorizacion, fechaAutorizacion: dn.fechaAutorizacion });

  doc.end();
}

// ─── PDF: Guía de Remisión (GR) ─────────────────────────────────────────────────
// Sin valores monetarios (a diferencia de factura/NC/ND): tabla de ítems con cantidad
// únicamente, más un bloque propio de datos del transportista/trayecto.
function renderQuantityTable(doc: PDFKit.PDFDocument, rows: Array<{ desc: string; qty: number }>) {
  const cols = [420, 120];
  const colX = [40, 460];
  const headerY = doc.y;
  doc.font('Helvetica-Bold').fontSize(9);
  doc.rect(35, headerY - 2, 540, 18).fill('#1E40AF').fillColor('white');
  ['Descripción', 'Cantidad'].forEach((h, i) => doc.text(h, colX[i], headerY + 1, { width: cols[i], align: i === 1 ? 'right' : 'left' }));
  doc.fillColor('#111827').font('Helvetica').fontSize(9);
  let y = headerY + 22;
  rows.forEach((r, idx) => {
    if (y > 700) { doc.addPage(); y = 50; }
    if (idx % 2 === 0) { doc.rect(35, y - 2, 540, 16).fill('#F9FAFB'); doc.fillColor('#111827'); }
    doc.text(r.desc, colX[0], y, { width: cols[0] });
    doc.text(String(r.qty), colX[1], y, { width: cols[1], align: 'right' });
    y += 18;
  });
  doc.y = y + 6;
}

export async function exportDeliveryGuidePdf(id: string, companyId: string, res: Response) {
  const guide = await prisma.deliveryGuide.findFirst({
    where: { id, companyId },
    include: { items: true, shipment: true },
  });
  if (!guide) throw new Error('DELIVERY_GUIDE_NOT_FOUND');

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const cfg = await getErpConfig(companyId);
  const order = guide.shipment.orderType === 'SALES'
    ? await prisma.salesOrder.findFirst({ where: { id: guide.shipment.orderId, companyId }, include: { customer: true } })
    : null;
  const customer = order?.customer ?? null;

  const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${guide.number}.pdf"`);
  doc.pipe(res);

  addPDFHeader(doc, `Guía de Remisión ${guide.number}`);
  addPartiesBlock(
    doc,
    { name: company?.name ?? 'Empresa', ruc: cfg.company?.ruc, address: cfg.company?.address, city: cfg.company?.city },
    customer ? { name: customer.razonSocial || customer.name, ruc: customer.ruc, address: customer.address } : null,
    `Envío: ${guide.shipment.trackingNumber}   ·   Emisión: ${new Date(guide.createdAt).toLocaleDateString('es')}`,
  );

  renderQuantityTable(doc, guide.items.map((it) => ({ desc: it.description, qty: Number(it.quantity) })));

  doc.moveDown(1);
  const boxY = doc.y;
  doc.rect(35, boxY, 540, 90).fill('#F9FAFB').stroke('#E5E7EB');
  doc.fillColor('#374151').font('Helvetica-Bold').fontSize(9).text('TRANSPORTE', 45, boxY + 8);
  doc.font('Helvetica').fontSize(9).fillColor('#111827');
  doc.text(`Transportista: ${guide.transportistaRazonSocial}   ·   ${guide.transportistaTipoIdentificacion} ${guide.transportistaIdentificacion}   ·   Placa: ${guide.placa}`, 45, boxY + 24, { width: 500 });
  doc.text(`Traslado: ${new Date(guide.fechaIniTransporte).toLocaleDateString('es')} — ${new Date(guide.fechaFinTransporte).toLocaleDateString('es')}`, 45, boxY + 42);
  doc.text(`Dirección de partida: ${guide.dirPartida}`, 45, boxY + 58, { width: 500 });
  doc.font('Helvetica-Bold').fillColor('#374151').text('Motivo del traslado:', 45, boxY + 74, { continued: true });
  doc.font('Helvetica').fillColor('#6B7280').text(` ${guide.motivoTraslado}`, { width: 450 });
  doc.y = boxY + 100;

  await addSriRideBlock(doc, { ambiente: guide.sriAmbiente, claveAcceso: guide.claveAcceso, numeroAutorizacion: guide.numeroAutorizacion, fechaAutorizacion: guide.fechaAutorizacion });

  doc.end();
}

// ─── Paquete NIIF/Supercías (Etapa 8) ──────────────────────────────────────────
// Balance General + Estado de Resultados + Estado de Cambios en el Patrimonio + Flujo de
// Efectivo + Notas, en un solo PDF. NO es el formato de carga del portal de Supercías (no hay
// API pública confirmada para automatizar esa presentación — plan-contabilidad-tributaria-sri.md
// §3): es el paquete que el contador imprime/adjunta para armar esa presentación a mano, igual
// que cualquier software contable.

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  if (doc.y > 680) doc.addPage();
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#1E40AF').text(title);
  doc.moveDown(0.3);
  doc.fillColor('#111827');
}

/** Tabla de 2 columnas (etiqueta / monto), con soporte de negrita para subtotales. */
function renderAmountRows(doc: PDFKit.PDFDocument, rows: Array<{ label: string; amount: number | null; bold?: boolean; indent?: boolean }>) {
  for (const r of rows) {
    if (doc.y > 720) doc.addPage();
    doc.font(r.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
    doc.text(r.indent ? `   ${r.label}` : r.label, 40, doc.y, { width: 380, continued: true });
    doc.text(r.amount === null ? '' : `$${r.amount.toFixed(2)}`, { width: 140, align: 'right' });
  }
}

export async function exportSuperciasPackagePdf(companyId: string, period: string, res: Response) {
  const acc = await import('./finance/accounting.service');
  const { periodRange } = await import('./finance/sri-casillas.service');
  const notesSvc = await import('./finance/financial-notes.service');

  const isAnnual = /^\d{4}$/.test(period);
  const from = isAnnual ? new Date(Number(period), 0, 1) : periodRange(period).start;
  const to = isAnnual ? new Date(Number(period), 11, 31, 23, 59, 59) : periodRange(period).end;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const cfg = await getErpConfig(companyId);

  const [balance, income, equity, cashFlow, notes] = await Promise.all([
    acc.getBalanceSheet(companyId, to),
    acc.getIncomeStatement(companyId, { from, to }),
    acc.getEquityStatement(companyId, { from, to }),
    acc.getCashFlowStatement(companyId, { from, to }),
    notesSvc.listNotes(companyId, period),
  ]);

  const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="estados-financieros-${period}.pdf"`);
  doc.pipe(res);

  addPDFHeader(doc, `Estados Financieros NIIF — ${period}`);
  doc.font('Helvetica').fontSize(9).fillColor('#6B7280');
  doc.text(`${company?.name ?? 'Empresa'}   ·   RUC: ${cfg.company?.ruc ?? '—'}   ·   Corte: ${to.toLocaleDateString('es')}`);
  doc.fillColor('#111827').moveDown(1);
  doc.fontSize(8).fillColor('#9CA3AF').text(
    'Borrador para uso interno y presentación a Supercías — el portal oficial no ofrece un API de carga automatizada; validar antes de presentar.',
    { width: 520 },
  );
  doc.fillColor('#111827');

  sectionTitle(doc, 'Balance General');
  renderAmountRows(doc, [
    { label: 'ACTIVOS', amount: null, bold: true },
    ...balance.activos.map((a) => ({ label: `${a.code} ${a.name}`, amount: a.balance, indent: true })),
    { label: 'TOTAL ACTIVOS', amount: balance.totalActivos, bold: true },
    { label: 'PASIVOS', amount: null, bold: true },
    ...balance.pasivos.map((a) => ({ label: `${a.code} ${a.name}`, amount: a.balance, indent: true })),
    { label: 'TOTAL PASIVOS', amount: balance.totalPasivos, bold: true },
    { label: 'PATRIMONIO', amount: null, bold: true },
    ...balance.patrimonio.map((a) => ({ label: `${a.code} ${a.name}`, amount: a.balance, indent: true })),
    { label: 'Resultado del ejercicio (acumulado no cerrado)', amount: balance.utilidadEjercicio, indent: true },
    { label: 'TOTAL PATRIMONIO', amount: balance.totalPatrimonio, bold: true },
    { label: 'Cuadre (Activos - Pasivos - Patrimonio)', amount: balance.cuadre },
  ]);

  sectionTitle(doc, 'Estado de Resultados');
  renderAmountRows(doc, [
    ...income.ingresos.map((a) => ({ label: `${a.code} ${a.name}`, amount: a.balance, indent: true })),
    { label: 'Total Ingresos', amount: income.totalIngresos, bold: true },
    ...income.costos.map((a) => ({ label: `${a.code} ${a.name}`, amount: a.balance, indent: true })),
    { label: 'Total Costos', amount: income.totalCostos, bold: true },
    { label: 'Utilidad Bruta', amount: income.utilidadBruta, bold: true },
    ...income.gastos.map((a) => ({ label: `${a.code} ${a.name}`, amount: a.balance, indent: true })),
    { label: 'Total Gastos', amount: income.totalGastos, bold: true },
    { label: 'UTILIDAD NETA DEL PERÍODO', amount: income.utilidadNeta, bold: true },
  ]);

  sectionTitle(doc, 'Estado de Cambios en el Patrimonio (NIC 1)');
  const catLabel: Record<string, string> = {
    CAPITAL: 'Capital', RESERVAS: 'Reservas', RESULTADOS_ACUMULADOS: 'Resultados acumulados', OTROS_PATRIMONIO: 'Otros',
  };
  renderAmountRows(doc, [
    { label: 'Saldo inicial (incluye utilidad acumulada no cerrada al mayor)', amount: equity.totalInicial, bold: true },
    ...equity.categories.map((c) => ({
      label: `${catLabel[c.category]}: inicial $${c.opening.toFixed(2)} + aumentos $${c.increases.toFixed(2)} - disminuciones $${c.decreases.toFixed(2)}`,
      amount: c.closing, indent: true,
    })),
    { label: 'Resultado del ejercicio actual', amount: equity.utilidadEjercicio, indent: true },
    { label: 'SALDO FINAL', amount: equity.totalFinal, bold: true },
  ]);

  sectionTitle(doc, 'Estado de Flujo de Efectivo (NIC 7, método directo)');
  renderAmountRows(doc, [
    { label: 'Caja inicial', amount: cashFlow.openingCash, bold: true },
    { label: 'Actividades de operación', amount: cashFlow.operating.net, indent: true },
    { label: 'Actividades de inversión', amount: cashFlow.investing.net, indent: true },
    { label: 'Actividades de financiamiento', amount: cashFlow.financing.net, indent: true },
    { label: 'Variación neta de caja', amount: cashFlow.netChange, bold: true },
    { label: 'Caja final', amount: cashFlow.closingCash, bold: true },
  ]);

  if (notes.length > 0) {
    sectionTitle(doc, 'Notas a los Estados Financieros');
    for (const n of notes) {
      if (doc.y > 680) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(10).text(n.title);
      doc.font('Helvetica').fontSize(9).fillColor('#374151').text(n.content, { width: 520 });
      doc.fillColor('#111827').moveDown(0.6);
    }
  }

  doc.end();
}

// ─── Reportes individuales (Balance / Resultados / Flujo) en PDF y Excel ───────
// A diferencia del paquete Supercías (los 4 estados juntos, por período de declaración), estos
// exportan UN solo estado con el rango de fechas que el usuario tiene seleccionado en la
// pestaña "Reporte" de Contabilidad — mismo patrón de `addPDFHeader`/`sectionTitle`/
// `renderAmountRows` que el resto de PDFs de este archivo, y `styleHeaderRow` para Excel.

async function reportHeaderInfo(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const cfg = await getErpConfig(companyId);
  return { companyName: company?.name ?? 'Empresa', ruc: cfg.company?.ruc ?? '—' };
}

export async function exportBalanceSheetPdf(companyId: string, asOf: string | undefined, res: Response) {
  const acc = await import('./finance/accounting.service');
  const cutoff = asOf ? new Date(asOf) : new Date();
  const [data, info] = await Promise.all([acc.getBalanceSheet(companyId, cutoff), reportHeaderInfo(companyId)]);

  const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="balance-general-${cutoff.toISOString().slice(0, 10)}.pdf"`);
  doc.pipe(res);

  addPDFHeader(doc, 'Balance General');
  doc.font('Helvetica').fontSize(9).fillColor('#6B7280')
    .text(`${info.companyName}   ·   RUC: ${info.ruc}   ·   Corte: ${new Date(data.asOf).toLocaleDateString('es')}`);
  doc.fillColor('#111827').moveDown(1);

  renderAmountRows(doc, [
    { label: 'ACTIVOS', amount: null, bold: true },
    ...data.activos.map((a) => ({ label: `${a.code} ${a.name}`, amount: a.balance, indent: true })),
    { label: 'TOTAL ACTIVOS', amount: data.totalActivos, bold: true },
    { label: 'PASIVOS', amount: null, bold: true },
    ...data.pasivos.map((a) => ({ label: `${a.code} ${a.name}`, amount: a.balance, indent: true })),
    { label: 'TOTAL PASIVOS', amount: data.totalPasivos, bold: true },
    { label: 'PATRIMONIO', amount: null, bold: true },
    ...data.patrimonio.map((a) => ({ label: `${a.code} ${a.name}`, amount: a.balance, indent: true })),
    { label: 'Resultado del ejercicio (acumulado no cerrado)', amount: data.utilidadEjercicio, indent: true },
    { label: 'TOTAL PATRIMONIO', amount: data.totalPatrimonio, bold: true },
    { label: 'Cuadre (Activos - Pasivos - Patrimonio)', amount: data.cuadre },
  ]);

  doc.end();
}

export async function exportBalanceSheetExcel(companyId: string, asOf: string | undefined, res: Response) {
  const acc = await import('./finance/accounting.service');
  const cutoff = asOf ? new Date(asOf) : new Date();
  const data = await acc.getBalanceSheet(companyId, cutoff);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Balance General');
  ws.columns = [
    { header: 'Sección', key: 'section', width: 14 },
    { header: 'Cuenta', key: 'code', width: 14 },
    { header: 'Nombre', key: 'name', width: 40 },
    { header: 'Saldo', key: 'amount', width: 16 },
  ];
  styleHeaderRow(ws, 1, 4);

  const addRows = (section: string, rows: Array<{ code: string; name: string; balance: number }>) =>
    rows.forEach((a) => ws.addRow({ section, code: a.code, name: a.name, amount: a.balance }));

  addRows('ACTIVO', data.activos);
  ws.addRow({ section: 'ACTIVO', code: '', name: 'TOTAL ACTIVOS', amount: data.totalActivos });
  addRows('PASIVO', data.pasivos);
  ws.addRow({ section: 'PASIVO', code: '', name: 'TOTAL PASIVOS', amount: data.totalPasivos });
  addRows('PATRIMONIO', data.patrimonio);
  ws.addRow({ section: 'PATRIMONIO', code: '', name: 'Resultado del ejercicio', amount: data.utilidadEjercicio });
  ws.addRow({ section: 'PATRIMONIO', code: '', name: 'TOTAL PATRIMONIO', amount: data.totalPatrimonio });

  ws.getColumn('amount').numFmt = '"$"#,##0.00';

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="balance-general-${cutoff.toISOString().slice(0, 10)}.xlsx"`);
  await wb.xlsx.write(res);
}

export async function exportIncomeStatementPdf(companyId: string, from: string | undefined, to: string | undefined, res: Response) {
  const acc = await import('./finance/accounting.service');
  const [data, info] = await Promise.all([
    acc.getIncomeStatement(companyId, { from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined }),
    reportHeaderInfo(companyId),
  ]);

  const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="estado-resultados.pdf"');
  doc.pipe(res);

  addPDFHeader(doc, 'Estado de Resultados');
  const rango = `${from ? new Date(from).toLocaleDateString('es') : '—'} a ${to ? new Date(to).toLocaleDateString('es') : '—'}`;
  doc.font('Helvetica').fontSize(9).fillColor('#6B7280').text(`${info.companyName}   ·   RUC: ${info.ruc}   ·   Período: ${rango}`);
  doc.fillColor('#111827').moveDown(1);

  renderAmountRows(doc, [
    ...data.ingresos.map((a) => ({ label: `${a.code} ${a.name}`, amount: a.balance, indent: true })),
    { label: 'Total Ingresos', amount: data.totalIngresos, bold: true },
    ...data.costos.map((a) => ({ label: `${a.code} ${a.name}`, amount: a.balance, indent: true })),
    { label: 'Total Costos', amount: data.totalCostos, bold: true },
    { label: 'Utilidad Bruta', amount: data.utilidadBruta, bold: true },
    ...data.gastos.map((a) => ({ label: `${a.code} ${a.name}`, amount: a.balance, indent: true })),
    { label: 'Total Gastos', amount: data.totalGastos, bold: true },
    { label: 'UTILIDAD NETA', amount: data.utilidadNeta, bold: true },
  ]);

  doc.end();
}

export async function exportIncomeStatementExcel(companyId: string, from: string | undefined, to: string | undefined, res: Response) {
  const acc = await import('./finance/accounting.service');
  const data = await acc.getIncomeStatement(companyId, { from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Estado de Resultados');
  ws.columns = [
    { header: 'Sección', key: 'section', width: 14 },
    { header: 'Cuenta', key: 'code', width: 14 },
    { header: 'Nombre', key: 'name', width: 40 },
    { header: 'Valor', key: 'amount', width: 16 },
  ];
  styleHeaderRow(ws, 1, 4);

  const addRows = (section: string, rows: Array<{ code: string; name: string; balance: number }>) =>
    rows.forEach((a) => ws.addRow({ section, code: a.code, name: a.name, amount: a.balance }));

  addRows('INGRESOS', data.ingresos);
  ws.addRow({ section: 'INGRESOS', code: '', name: 'TOTAL INGRESOS', amount: data.totalIngresos });
  addRows('COSTOS', data.costos);
  ws.addRow({ section: '', code: '', name: 'UTILIDAD BRUTA', amount: data.utilidadBruta });
  addRows('GASTOS', data.gastos);
  ws.addRow({ section: '', code: '', name: 'UTILIDAD OPERATIVA', amount: data.utilidadOperativa });
  ws.addRow({ section: '', code: '', name: 'UTILIDAD NETA', amount: data.utilidadNeta });

  ws.getColumn('amount').numFmt = '"$"#,##0.00';

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="estado-resultados.xlsx"');
  await wb.xlsx.write(res);
}

/** Filas de la sección "Actividades de operación" según el método (directo: lista de
 * cobros/pagos; indirecto: conciliación desde la utilidad neta — ver `getCashFlowStatement`). */
function cashFlowOperatingRows(cf: any): Array<{ label: string; amount: number | null; bold?: boolean; indent?: boolean }> {
  if (cf.method === 'indirect') {
    return [
      { label: 'Utilidad neta del ejercicio', amount: cf.operating.netIncome, indent: true },
      { label: '(+) Depreciación y otros no monetarios', amount: cf.operating.depreciation, indent: true },
      { label: '(+/-) Variación en capital de trabajo', amount: cf.operating.workingCapitalChange, indent: true },
      { label: 'Efectivo neto de actividades de operación', amount: cf.operating.net, bold: true },
    ];
  }
  return [
    ...cf.operating.inflows.map((f: any) => ({ label: `(+) ${f.description}`, amount: f.amount, indent: true })),
    ...cf.operating.outflows.map((f: any) => ({ label: `(−) ${f.description}`, amount: f.amount, indent: true })),
    { label: 'Efectivo neto de actividades de operación', amount: cf.operating.net, bold: true },
  ];
}

export async function exportCashFlowPdf(
  companyId: string, from: string | undefined, to: string | undefined, method: 'direct' | 'indirect', res: Response,
) {
  const acc = await import('./finance/accounting.service');
  const [data, info] = await Promise.all([
    acc.getCashFlowStatement(companyId, { from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined, method }),
    reportHeaderInfo(companyId),
  ]);

  const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="flujo-de-efectivo.pdf"');
  doc.pipe(res);

  const metodoLabel = data.method === 'indirect' ? 'método indirecto' : 'método directo';
  addPDFHeader(doc, `Estado de Flujo de Efectivo (NIC 7, ${metodoLabel})`);
  const rango = `${from ? new Date(from).toLocaleDateString('es') : '—'} a ${to ? new Date(to).toLocaleDateString('es') : '—'}`;
  doc.font('Helvetica').fontSize(9).fillColor('#6B7280').text(`${info.companyName}   ·   RUC: ${info.ruc}   ·   Período: ${rango}`);
  doc.fillColor('#111827').moveDown(1);

  renderAmountRows(doc, [
    { label: 'Caja inicial', amount: data.openingCash, bold: true },
    { label: 'ACTIVIDADES DE OPERACIÓN', amount: null, bold: true },
    ...cashFlowOperatingRows(data),
    { label: 'ACTIVIDADES DE INVERSIÓN', amount: null, bold: true },
    ...data.investing.inflows.map((f) => ({ label: `(+) ${f.description}`, amount: f.amount, indent: true })),
    ...data.investing.outflows.map((f) => ({ label: `(−) ${f.description}`, amount: f.amount, indent: true })),
    { label: 'Efectivo neto de actividades de inversión', amount: data.investing.net, bold: true },
    { label: 'ACTIVIDADES DE FINANCIAMIENTO', amount: null, bold: true },
    ...data.financing.inflows.map((f) => ({ label: `(+) ${f.description}`, amount: f.amount, indent: true })),
    ...data.financing.outflows.map((f) => ({ label: `(−) ${f.description}`, amount: f.amount, indent: true })),
    { label: 'Efectivo neto de actividades de financiamiento', amount: data.financing.net, bold: true },
    { label: 'Variación neta de caja', amount: data.netChange, bold: true },
    { label: 'Caja final', amount: data.closingCash, bold: true },
  ]);

  doc.end();
}

export async function exportCashFlowExcel(
  companyId: string, from: string | undefined, to: string | undefined, method: 'direct' | 'indirect', res: Response,
) {
  const acc = await import('./finance/accounting.service');
  const data = await acc.getCashFlowStatement(companyId, {
    from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined, method,
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Flujo de Efectivo');
  ws.columns = [
    { header: 'Sección', key: 'section', width: 24 },
    { header: 'Detalle', key: 'detail', width: 44 },
    { header: 'Monto', key: 'amount', width: 16 },
  ];
  styleHeaderRow(ws, 1, 3);

  ws.addRow({ section: '', detail: 'Caja inicial', amount: data.openingCash });
  if (data.method === 'indirect') {
    ws.addRow({ section: 'OPERACIÓN', detail: 'Utilidad neta del ejercicio', amount: data.operating.netIncome });
    ws.addRow({ section: 'OPERACIÓN', detail: 'Depreciación y otros no monetarios', amount: data.operating.depreciation });
    ws.addRow({ section: 'OPERACIÓN', detail: 'Variación en capital de trabajo', amount: data.operating.workingCapitalChange });
  } else {
    data.operating.inflows.forEach((f) => ws.addRow({ section: 'OPERACIÓN (+)', detail: f.description, amount: f.amount }));
    data.operating.outflows.forEach((f) => ws.addRow({ section: 'OPERACIÓN (−)', detail: f.description, amount: -f.amount }));
  }
  ws.addRow({ section: 'OPERACIÓN', detail: 'Efectivo neto de operación', amount: data.operating.net });
  data.investing.inflows.forEach((f) => ws.addRow({ section: 'INVERSIÓN (+)', detail: f.description, amount: f.amount }));
  data.investing.outflows.forEach((f) => ws.addRow({ section: 'INVERSIÓN (−)', detail: f.description, amount: -f.amount }));
  ws.addRow({ section: 'INVERSIÓN', detail: 'Efectivo neto de inversión', amount: data.investing.net });
  data.financing.inflows.forEach((f) => ws.addRow({ section: 'FINANCIAMIENTO (+)', detail: f.description, amount: f.amount }));
  data.financing.outflows.forEach((f) => ws.addRow({ section: 'FINANCIAMIENTO (−)', detail: f.description, amount: -f.amount }));
  ws.addRow({ section: 'FINANCIAMIENTO', detail: 'Efectivo neto de financiamiento', amount: data.financing.net });
  ws.addRow({ section: '', detail: 'Variación neta de caja', amount: data.netChange });
  ws.addRow({ section: '', detail: 'Caja final', amount: data.closingCash });

  ws.getColumn('amount').numFmt = '"$"#,##0.00';

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="flujo-de-efectivo-${data.method}.xlsx"`);
  await wb.xlsx.write(res);
}
