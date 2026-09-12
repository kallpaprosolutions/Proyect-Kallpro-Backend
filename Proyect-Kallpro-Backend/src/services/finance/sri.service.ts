import { prisma } from '../../lib/prisma';
export interface SRIFormSummary {
  formCode: string;
  name: string;
  period: string;
  status: 'pending' | 'ready' | 'submitted' | 'overdue';
  dueDate: string;
  amount?: number;
  currency: 'USD';
}

export interface Form104Summary {
  period: string;
  ivaRepercutido: number;    // IVA en ventas / facturas emitidas
  ivaSoportado: number;      // IVA en compras / facturas recibidas (SRI docs)
  ivaNeto: number;           // repercutido - soportado
  creditoTributario: number; // si soportado > repercutido
  tasaVigente: number;       // 0.15 desde abril 2024
  subtotal0: number;
  subtotal15: number;
  totalFacturasEmitidas: number;
  totalDocumentosCompras: number;
}

export interface Form103Summary {
  period: string;
  retentions: RetentionLine[];
  totalRetenido: number;
}

export interface RetentionLine {
  codigo: string;
  descripcion: string;
  porcentaje: number;
  baseImponible: number;
  valorRetenido: number;
  numFacturas: number;
}

export interface CalendarWarning {
  formCode: string;
  name: string;
  dueDate: Date;
  daysUntilDue: number;
  severity: 'ok' | 'warning' | 'critical';
  description: string;
}

// Tasa IVA por fecha (Ecuador: cambió de 12% a 15% en abril 2024)
function ivaRateForDate(date: Date): number {
  return date >= new Date('2024-04-01') ? 0.15 : 0.12;
}

export async function getSRIForms(companyId: string, fiscalYear?: number): Promise<SRIFormSummary[]> {
  const year = fiscalYear ?? new Date().getFullYear();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  const forms: SRIFormSummary[] = [];

  // Form 104 — IVA mensual (vence el 28 del mes siguiente según RUC)
  for (let m = 1; m <= Math.min(currentMonth, 12); m++) {
    const dueDay = 28;
    const dueDate = new Date(year, m, dueDay); // mes siguiente
    const isPast = dueDate < now;
    const status: SRIFormSummary['status'] = isPast ? 'submitted' : m === currentMonth ? 'pending' : 'ready';
    forms.push({
      formCode: '104',
      name: `Form 104 · IVA — ${year}/${String(m).padStart(2, '0')}`,
      period: `${year}-${String(m).padStart(2, '0')}`,
      status,
      dueDate: dueDate.toISOString().split('T')[0],
      currency: 'USD',
    });
  }

  // Form 103 — Retenciones fuente (mensual, vence ~10 del mes siguiente)
  for (let m = 1; m <= Math.min(currentMonth, 12); m++) {
    const dueDate = new Date(year, m, 10);
    const isPast = dueDate < now;
    forms.push({
      formCode: '103',
      name: `Form 103 · Retenciones — ${year}/${String(m).padStart(2, '0')}`,
      period: `${year}-${String(m).padStart(2, '0')}`,
      status: isPast ? 'submitted' : 'pending',
      dueDate: dueDate.toISOString().split('T')[0],
      currency: 'USD',
    });
  }

  // Form 101 — IR sociedades (anual, vence abril siguiente)
  if (year < now.getFullYear() || (year === now.getFullYear() && now.getMonth() >= 3)) {
    forms.push({
      formCode: '101',
      name: `Form 101 · IR Sociedades — ${year}`,
      period: `${year}`,
      status: now.getFullYear() > year ? 'submitted' : 'pending',
      dueDate: `${year + 1}-04-30`,
      currency: 'USD',
    });
  }

  // ATS — Anexo Transaccional (mensual, vence el 28)
  for (let m = 1; m <= Math.min(currentMonth - 1, 12); m++) {
    forms.push({
      formCode: 'ATS',
      name: `ATS — ${year}/${String(m).padStart(2, '0')}`,
      period: `${year}-${String(m).padStart(2, '0')}`,
      status: 'submitted',
      dueDate: new Date(year, m, 28).toISOString().split('T')[0],
      currency: 'USD',
    });
  }

  return forms.sort((a, b) => b.period.localeCompare(a.period)).slice(0, 24);
}

export async function getForm104Summary(companyId: string, period: string): Promise<Form104Summary> {
  const [year, month] = period.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);
  const tasaVigente = ivaRateForDate(start);

  // IVA soportado: desde documentos SRI (facturas de proveedores)
  const sriDocs = await prisma.sriDocument.findMany({
    where: {
      companyId,
      tipoDocumento: 'FACTURA',
      fechaEmision: { gte: start, lte: end },
      status: 'CONFIRMED',
    },
  });

  const ivaSoportado = sriDocs.reduce((s, d) => s + Number(d.iva), 0);
  const subtotal15Compras = sriDocs.reduce((s, d) => s + Number(d.subtotal15), 0);
  const subtotal0Compras = sriDocs.reduce((s, d) => s + Number(d.subtotal0), 0);
  const totalDocumentosCompras = sriDocs.length;

  // IVA repercutido: desde facturas de venta internas
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      issueDate: { gte: start, lte: end },
      status: { in: ['PAID', 'CONFIRMED', 'SENT'] },
    },
  });
  const totalVentas = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  const subtotalVentas = totalVentas / (1 + tasaVigente);
  const ivaRepercutido = subtotalVentas * tasaVigente;
  const totalFacturasEmitidas = invoices.length;

  const ivaNeto = ivaRepercutido - ivaSoportado;
  const creditoTributario = ivaNeto < 0 ? Math.abs(ivaNeto) : 0;

  return {
    period,
    ivaRepercutido: Math.round(ivaRepercutido * 100) / 100,
    ivaSoportado: Math.round(ivaSoportado * 100) / 100,
    ivaNeto: Math.round(Math.max(ivaNeto, 0) * 100) / 100,
    creditoTributario: Math.round(creditoTributario * 100) / 100,
    tasaVigente: tasaVigente * 100,
    subtotal0: subtotal0Compras,
    subtotal15: subtotal15Compras,
    totalFacturasEmitidas,
    totalDocumentosCompras,
  };
}

export async function getForm103Summary(companyId: string, period: string): Promise<Form103Summary> {
  const [year, month] = period.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const retentions = await prisma.sriRetention.findMany({
    where: {
      document: {
        companyId,
        fechaEmision: { gte: start, lte: end },
        status: 'CONFIRMED',
      },
    },
    include: { document: true },
  });

  // Agrupar por código de retención
  const grouped: Record<string, RetentionLine> = {};
  for (const ret of retentions) {
    const key = `${ret.tipo}-${ret.codigo}`;
    if (!grouped[key]) {
      grouped[key] = {
        codigo: ret.codigo,
        descripcion: ret.descripcion,
        porcentaje: Number(ret.porcentaje),
        baseImponible: 0,
        valorRetenido: 0,
        numFacturas: 0,
      };
    }
    grouped[key].baseImponible += Number(ret.baseImponible);
    grouped[key].valorRetenido += Number(ret.valor);
    grouped[key].numFacturas += 1;
  }

  const retentionLines = Object.values(grouped).sort((a, b) => b.valorRetenido - a.valorRetenido);
  const totalRetenido = retentionLines.reduce((s, r) => s + r.valorRetenido, 0);

  return {
    period,
    retentions: retentionLines,
    totalRetenido: Math.round(totalRetenido * 100) / 100,
  };
}

export async function getCalendarWarnings(companyId: string): Promise<CalendarWarning[]> {
  const now = new Date();
  const warnings: CalendarWarning[] = [];

  // Form 104 — vence el 28 del mes siguiente
  const nextMonthDue = new Date(now.getFullYear(), now.getMonth() + 1, 28);
  const daysTo104 = Math.ceil((nextMonthDue.getTime() - now.getTime()) / 86400000);
  warnings.push({
    formCode: '104',
    name: 'Form 104 · IVA mensual',
    dueDate: nextMonthDue,
    daysUntilDue: daysTo104,
    severity: daysTo104 <= 3 ? 'critical' : daysTo104 <= 7 ? 'warning' : 'ok',
    description: `IVA del mes ${now.toLocaleString('es-EC', { month: 'long' })} vence el 28/${now.getMonth() + 2}/${now.getFullYear()}`,
  });

  // Form 103 — vence el 10 del mes siguiente
  const ret103Due = new Date(now.getFullYear(), now.getMonth() + 1, 10);
  const daysTo103 = Math.ceil((ret103Due.getTime() - now.getTime()) / 86400000);
  warnings.push({
    formCode: '103',
    name: 'Form 103 · Retenciones',
    dueDate: ret103Due,
    daysUntilDue: daysTo103,
    severity: daysTo103 <= 3 ? 'critical' : daysTo103 <= 7 ? 'warning' : 'ok',
    description: `Retenciones del mes vencen el 10/${now.getMonth() + 2}/${now.getFullYear()}`,
  });

  // Form 101 — vence 30 de abril del año siguiente (anual)
  const ats101Due = new Date(now.getFullYear() + 1, 3, 30);
  const daysTo101 = Math.ceil((ats101Due.getTime() - now.getTime()) / 86400000);
  if (daysTo101 <= 60) {
    warnings.push({
      formCode: '101',
      name: 'Form 101 · IR Anual',
      dueDate: ats101Due,
      daysUntilDue: daysTo101,
      severity: daysTo101 <= 15 ? 'critical' : daysTo101 <= 30 ? 'warning' : 'ok',
      description: `Impuesto a la Renta ${now.getFullYear()} vence el 30/04/${now.getFullYear() + 1}`,
    });
  }

  return warnings.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

export default { getSRIForms, getForm104Summary, getForm103Summary, getCalendarWarnings };
