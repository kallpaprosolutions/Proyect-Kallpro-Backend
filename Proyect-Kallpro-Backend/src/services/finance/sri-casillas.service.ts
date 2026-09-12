import { prisma } from '../../lib/prisma';

// ============================================================
// DECLARACIONES SRI POR CASILLAS (Sprint 11 — patrón Odoo 18)
// ============================================================
// Renderiza los formularios 104 (IVA) y 103 (retenciones fuente) con la
// estructura de casillas del formulario oficial, como el "Informe de
// impuestos" de Odoo: secciones con filas casilla-concepto-valor, resultado
// destacado (a pagar / crédito), estado del período fiscal y avisos
// ACCIONABLES (documentos pendientes que ensucian la declaración).
//
// Motores PUROS (regla 6): buildForm104Casillas / buildForm103Casillas
// transforman números crudos en la estructura; la BD solo se toca en
// getForm104Casillas / getForm103Casillas.

export interface CasillaRow {
  casilla: string;  // número de casilla del formulario SRI ('411', '520'…)
  label: string;    // concepto en español
  value: number;
  /** 'muted' = valor cero (la UI lo atenúa); 'total' = fila de resultado parcial */
  style?: 'muted' | 'total';
}

export interface FormSection {
  title: string;
  rows: CasillaRow[];
}

export interface FormPendientes {
  /** Documentos SRI del período aún en revisión (no suman a la declaración). */
  sriDocsPendientes: number;
  /** Facturas de venta en borrador dentro del período. */
  facturasBorrador: number;
}

export interface Form104Casillas {
  period: string;
  periodStatus: 'OPEN' | 'CLOSED' | 'NONE'; // NONE = sin registro de cierre
  tasaVigente: number; // % (15)
  sections: FormSection[];
  resultado: { label: string; value: number; type: 'A_PAGAR' | 'CREDITO' };
  pendientes: FormPendientes;
}

export interface Form103CasillasRow {
  codigo: string;
  descripcion: string;
  porcentaje: number;
  baseImponible: number;
  valorRetenido: number;
  numFacturas: number;
}

export interface Form103Casillas {
  period: string;
  periodStatus: 'OPEN' | 'CLOSED' | 'NONE';
  rows: Form103CasillasRow[];
  totalBase: number;
  totalRetenido: number;
  pendientes: FormPendientes;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface Raw104Data {
  ventasNetas15: number;     // base gravada de ventas (neto, sin IVA)
  ivaVentas: number;         // IVA generado en ventas
  ncSubtotal: number;        // base de notas de crédito emitidas (resta ventas)
  ncIva: number;             // IVA de notas de crédito emitidas
  comprasNetas15: number;    // adquisiciones gravadas (neto)
  comprasNetas0: number;     // adquisiciones tarifa 0%
  ivaCompras: number;        // IVA pagado en adquisiciones (crédito tributario)
  retencionesIvaRecibidas: number; // retenciones de IVA que NOS efectuaron (crédito)
}

/**
 * Motor PURO: arma las casillas del Formulario 104.
 * Numeración basada en el formulario oficial SRI (casillas principales).
 */
export function buildForm104Casillas(
  period: string,
  periodStatus: Form104Casillas['periodStatus'],
  tasaVigente: number,
  raw: Raw104Data,
  pendientes: FormPendientes,
): Form104Casillas {
  const ventasNetas = r2(Math.max(raw.ventasNetas15 - raw.ncSubtotal, 0));
  const impuestoGenerado = r2(Math.max(raw.ivaVentas - raw.ncIva, 0));
  const creditoAdquisiciones = r2(raw.ivaCompras);

  const impuestoCausado = r2(Math.max(impuestoGenerado - creditoAdquisiciones, 0));
  const creditoMes = r2(Math.max(creditoAdquisiciones - impuestoGenerado, 0));
  const totalPagar = r2(Math.max(impuestoCausado - raw.retencionesIvaRecibidas, 0));
  const creditoRetenciones = r2(Math.max(raw.retencionesIvaRecibidas - impuestoCausado, 0));

  const row = (casilla: string, label: string, value: number, style?: CasillaRow['style']): CasillaRow => ({
    casilla, label, value: r2(value), style: style ?? (r2(value) === 0 ? 'muted' : undefined),
  });

  const sections: FormSection[] = [
    {
      title: 'Resumen de ventas y otras operaciones del período que declara',
      rows: [
        row('411', `Ventas locales gravadas tarifa ${tasaVigente}% (valor neto)`, raw.ventasNetas15),
        row('415', 'Notas de crédito emitidas (valor neto, resta)', raw.ncSubtotal),
        row('419', 'Ventas netas gravadas del período', ventasNetas, 'total'),
        row('421', 'Impuesto generado en ventas', raw.ivaVentas),
        row('425', 'IVA de notas de crédito (resta)', raw.ncIva),
        row('429', 'Total impuesto generado', impuestoGenerado, 'total'),
      ],
    },
    {
      title: 'Resumen de adquisiciones y pagos del período que declara',
      rows: [
        row('500', `Adquisiciones gravadas tarifa ${tasaVigente}% (valor neto)`, raw.comprasNetas15),
        row('507', 'Adquisiciones tarifa 0%', raw.comprasNetas0),
        row('520', 'Impuesto pagado en adquisiciones (crédito tributario)', creditoAdquisiciones, 'total'),
      ],
    },
    {
      title: 'Liquidación del IVA del período',
      rows: [
        row('601', 'Impuesto causado (si 429 > 520)', impuestoCausado),
        row('602', 'Crédito tributario del período (si 520 > 429)', creditoMes),
        row('609', 'Retenciones de IVA que le han efectuado', raw.retencionesIvaRecibidas),
        row('902', 'Total impuesto a pagar por percepción', totalPagar, 'total'),
      ],
    },
  ];

  const type: Form104Casillas['resultado']['type'] =
    totalPagar > 0 ? 'A_PAGAR' : 'CREDITO';
  const creditoTotal = r2(creditoMes + creditoRetenciones);

  return {
    period,
    periodStatus,
    tasaVigente,
    sections,
    resultado: type === 'A_PAGAR'
      ? { label: 'IVA a pagar del período', value: totalPagar, type }
      : { label: 'Crédito tributario a favor', value: creditoTotal, type },
    pendientes,
  };
}

/** Motor PURO: arma el Formulario 103 a partir de las líneas agrupadas. */
export function buildForm103Casillas(
  period: string,
  periodStatus: Form103Casillas['periodStatus'],
  rows: Form103CasillasRow[],
  pendientes: FormPendientes,
): Form103Casillas {
  const sorted = [...rows].sort((a, b) => b.valorRetenido - a.valorRetenido);
  return {
    period,
    periodStatus,
    rows: sorted,
    totalBase: r2(sorted.reduce((s, r) => s + r.baseImponible, 0)),
    totalRetenido: r2(sorted.reduce((s, r) => s + r.valorRetenido, 0)),
    pendientes,
  };
}

// ─── Acceso a datos ───────────────────────────────────────────

export function periodRange(period: string): { start: Date; end: Date; year: number; month: number } {
  const [year, month] = period.split('-').map(Number);
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 0, 23, 59, 59), year, month };
}

export function ivaRateForDate(date: Date): number {
  return date >= new Date('2024-04-01') ? 15 : 12;
}

async function getPeriodStatus(companyId: string, year: number, month: number): Promise<Form104Casillas['periodStatus']> {
  const fp = await prisma.fiscalPeriod.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
  });
  if (!fp) return 'NONE';
  return fp.status === 'CLOSED' ? 'CLOSED' : 'OPEN';
}

async function getPendientes(companyId: string, start: Date, end: Date): Promise<FormPendientes> {
  const [sriDocsPendientes, facturasBorrador] = await Promise.all([
    prisma.sriDocument.count({
      where: { companyId, status: 'PENDING_REVIEW', fechaEmision: { gte: start, lte: end } },
    }),
    prisma.invoice.count({
      where: { companyId, type: 'SALES', status: 'DRAFT', issueDate: { gte: start, lte: end } },
    }),
  ]);
  return { sriDocsPendientes, facturasBorrador };
}

/** Formulario 104 con casillas para el período YYYY-MM. */
export async function getForm104Casillas(companyId: string, period: string): Promise<Form104Casillas> {
  const { start, end, year, month } = periodRange(period);
  const tasa = ivaRateForDate(start);
  const rate = tasa / 100;

  const [invoices, creditNotes, sriDocs, retIva, periodStatus, pendientes] = await Promise.all([
    // Ventas del período (emitidas, no borrador ni anuladas)
    prisma.invoice.findMany({
      where: {
        companyId, type: 'SALES',
        issueDate: { gte: start, lte: end },
        status: { notIn: ['DRAFT', 'CANCELLED'] },
      },
      select: { totalAmount: true },
    }),
    // Notas de crédito de venta emitidas en el período
    prisma.creditNote.findMany({
      where: { companyId, status: 'ISSUED', createdAt: { gte: start, lte: end } },
      select: { subtotal: true, taxAmount: true },
    }),
    // Compras confirmadas (documentos SRI)
    prisma.sriDocument.findMany({
      where: { companyId, tipoDocumento: 'FACTURA', status: 'CONFIRMED', fechaEmision: { gte: start, lte: end } },
      select: { iva: true, subtotal15: true, subtotal0: true },
    }),
    // Retenciones de IVA que los clientes NOS practicaron (crédito, casilla 609)
    prisma.invoiceWithholding.findMany({
      where: { tipo: 'IVA', invoice: { companyId, issueDate: { gte: start, lte: end } } },
      select: { valor: true },
    }),
    getPeriodStatus(companyId, year, month),
    getPendientes(companyId, start, end),
  ]);

  const totalVentas = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  // Aproximación (las facturas guardan el total con IVA): neto = total / (1 + tasa).
  const ventasNetas15 = totalVentas / (1 + rate);
  const ivaVentas = ventasNetas15 * rate;

  return buildForm104Casillas(period, periodStatus, tasa, {
    ventasNetas15,
    ivaVentas,
    ncSubtotal: creditNotes.reduce((s, n) => s + Number(n.subtotal), 0),
    ncIva: creditNotes.reduce((s, n) => s + Number(n.taxAmount), 0),
    comprasNetas15: sriDocs.reduce((s, d) => s + Number(d.subtotal15), 0),
    comprasNetas0: sriDocs.reduce((s, d) => s + Number(d.subtotal0), 0),
    ivaCompras: sriDocs.reduce((s, d) => s + Number(d.iva), 0),
    retencionesIvaRecibidas: retIva.reduce((s, w) => s + Number(w.valor), 0),
  }, pendientes);
}

/** Formulario 103 con estructura para el período YYYY-MM (retenciones que efectuamos en compras). */
export async function getForm103Casillas(companyId: string, period: string): Promise<Form103Casillas> {
  const { start, end, year, month } = periodRange(period);

  const [retentions, periodStatus, pendientes] = await Promise.all([
    prisma.sriRetention.findMany({
      where: { document: { companyId, fechaEmision: { gte: start, lte: end }, status: 'CONFIRMED' } },
    }),
    getPeriodStatus(companyId, year, month),
    getPendientes(companyId, start, end),
  ]);

  const grouped: Record<string, Form103CasillasRow> = {};
  for (const ret of retentions) {
    const key = `${ret.tipo}-${ret.codigo}`;
    grouped[key] ??= {
      codigo: ret.codigo, descripcion: ret.descripcion,
      porcentaje: Number(ret.porcentaje), baseImponible: 0, valorRetenido: 0, numFacturas: 0,
    };
    grouped[key].baseImponible = r2(grouped[key].baseImponible + Number(ret.baseImponible));
    grouped[key].valorRetenido = r2(grouped[key].valorRetenido + Number(ret.valor));
    grouped[key].numFacturas += 1;
  }

  return buildForm103Casillas(period, periodStatus, Object.values(grouped), pendientes);
}
