// Motor PURO (sin BD) — ATS (Anexo Transaccional Simplificado), el detalle mensual de
// compras/ventas/retenciones que el SRI exige subir junto al Formulario 104 (mismo período,
// mismo criterio de "neto = total/(1+tasa)" ya aceptado en `sri-casillas.service.ts` para
// ventas, que no guardan el desglose IVA por línea). Los catálogos de códigos (identificación,
// tipo de comprobante, sustento tributario) son estables y públicos — Ficha Técnica ATS del SRI.

export type TipoIdentificacion = '04' | '05' | '06' | '07'; // RUC | CÉDULA | PASAPORTE | CONSUMIDOR FINAL

/** Clasifica un número de identificación según la regla oficial: 13 dígitos terminados en
 * 001 = RUC, 10 dígitos = cédula, cualquier otra cosa (o vacío) = pasaporte/consumidor final. */
export function classifyIdentificacion(id: string | null | undefined): TipoIdentificacion {
  const clean = (id ?? '').trim();
  if (!clean) return '07';
  if (/^\d{10}001$/.test(clean)) return '04'; // 13 dígitos en total (10 + establecimiento "001")
  if (/^\d{10}$/.test(clean)) return '05';
  return '06';
}

// Tipo de comprobante ATS (catálogo SRI): 01 factura, 03 liquidación de compra, 04 nota de
// crédito, 05 nota de débito, 06 guía de remisión, 07 comprobante de retención.
const TIPO_COMPROBANTE_MAP: Record<string, string> = {
  FACTURA: '01',
  LIQUIDACION_COMPRA: '03',
  NOTA_CREDITO: '04',
  NOTA_DEBITO: '05',
  RETENCION: '07',
};

export function tipoComprobanteAts(tipoDocumento: string): string {
  return TIPO_COMPROBANTE_MAP[tipoDocumento] ?? '01';
}

/** Neto (base imponible) aproximado a partir de un total con IVA incluido — fallback para
 * facturas SIN pedido de venta asociado (manuales, `FAC-` directas), que no tienen líneas con
 * tarifa de IVA propia. Mismo criterio que `getForm104Casillas`. */
export function approximateNetFromTotal(total: number, ratePct: number): { net: number; iva: number } {
  const rate = ratePct / 100;
  const net = rate > 0 ? total / (1 + rate) : total;
  return { net: Math.round(net * 100) / 100, iva: Math.round((total - net) * 100) / 100 };
}

export interface VentaLineForAts {
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxRate: number; // % IVA de la línea (SalesOrderItem.taxRate)
}

/** Desglose EXACTO de una venta a partir de sus líneas reales (mismo cálculo que
 * `factura-xml.engine.computeItem`: neto = cantidad*precio - descuento). Reemplaza la
 * aproximación `total/(1+tasa)` cuando la factura nació de un pedido de venta (tiene tarifa
 * de IVA por línea) — el desglose real que antes solo vivía embebido en el XML del SRI. */
export function computeVentaBreakdownFromLines(lines: VentaLineForAts[]): { baseImpGrav0: number; baseImponible: number; montoIva: number } {
  let baseImpGrav0 = 0;
  let baseImponible = 0;
  let montoIva = 0;
  for (const l of lines) {
    const bruto = l.quantity * l.unitPrice;
    const descuento = Math.round(bruto * (l.discountPct / 100) * 100) / 100;
    const neto = Math.round((bruto - descuento) * 100) / 100;
    if (l.taxRate > 0) {
      baseImponible += neto;
      montoIva += Math.round(neto * (l.taxRate / 100) * 100) / 100;
    } else {
      baseImpGrav0 += neto;
    }
  }
  return {
    baseImpGrav0: Math.round(baseImpGrav0 * 100) / 100,
    baseImponible: Math.round(baseImponible * 100) / 100,
    montoIva: Math.round(montoIva * 100) / 100,
  };
}

export interface AtsComprasRow {
  tipoIdProveedor: TipoIdentificacion;
  identificacionProveedor: string;
  razonSocialProveedor: string;
  tipoComprobante: string;
  fechaEmision: string; // AAAA-MM-DD
  establecimiento: string;
  puntoEmision: string;
  secuencial: string;
  autorizacion: string; // clave de acceso / número de autorización
  baseImpGrav0: number; // tarifa 0%
  baseImponible: number; // gravado tarifa vigente (neto)
  montoIva: number;
  valorRetIva: number;
  valorRetRenta: number;
}

export interface AtsVentasRow {
  tipoIdComprador: TipoIdentificacion;
  identificacionComprador: string;
  razonSocialComprador: string;
  tipoComprobante: string;
  fechaEmision: string;
  numeroComprobante: string; // PPP-EEE-SSSSSSSSS si está disponible
  baseImpGrav0: number;
  baseImponible: number;
  montoIva: number;
  valorRetIva: number; // retención que el cliente nos practicó (informativo en la fila)
  valorRetRenta: number;
}

export interface AtsSummary {
  period: string; // AAAA-MM
  compras: { rows: AtsComprasRow[]; totalBaseImponible: number; totalIva: number; totalRetIva: number; totalRetRenta: number };
  ventas: { rows: AtsVentasRow[]; totalBaseImponible: number; totalIva: number; totalRetIva: number; totalRetRenta: number };
}

function sum(arr: number[]): number {
  return Math.round(arr.reduce((s, n) => s + n, 0) * 100) / 100;
}

export function buildAtsSummary(period: string, compras: AtsComprasRow[], ventas: AtsVentasRow[]): AtsSummary {
  return {
    period,
    compras: {
      rows: compras,
      totalBaseImponible: sum(compras.map((r) => r.baseImponible)),
      totalIva: sum(compras.map((r) => r.montoIva)),
      totalRetIva: sum(compras.map((r) => r.valorRetIva)),
      totalRetRenta: sum(compras.map((r) => r.valorRetRenta)),
    },
    ventas: {
      rows: ventas,
      totalBaseImponible: sum(ventas.map((r) => r.baseImponible)),
      totalIva: sum(ventas.map((r) => r.montoIva)),
      totalRetIva: sum(ventas.map((r) => r.valorRetIva)),
      totalRetRenta: sum(ventas.map((r) => r.valorRetRenta)),
    },
  };
}
