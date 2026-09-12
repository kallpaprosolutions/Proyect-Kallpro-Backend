/**
 * Retenciones de VENTA (el cliente nos retiene IVA y/o Renta al facturarle).
 * Reutiliza RetentionCatalog y los códigos por defecto del Customer.
 *
 * Base de Renta separada por Bienes vs. Servicios (mejora DeepSeek #1):
 *   - aplicaA = 'BIENES'    → base = subtotal de productos (Product.type != 'SERVICE')
 *   - aplicaA = 'SERVICIOS' → base = subtotal de servicios (Product.type == 'SERVICE')
 *   - aplicaA = 'AMBOS'     → base = subtotal total
 * Base de IVA = monto de IVA de la factura.
 */
import { prisma } from '../lib/prisma';

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface WithholdingLine {
  tipo: 'RENTA' | 'IVA';
  codigo: string;
  descripcion: string;
  baseImponible: number;
  porcentaje: number;
  valor: number;
}

export interface WithholdingBases {
  goodsBase: number;     // subtotal neto de bienes
  servicesBase: number;  // subtotal neto de servicios
  ivaAmount: number;     // IVA de la factura
}

/**
 * Calcula las líneas de retención para un cliente dadas las bases. Devuelve solo las que
 * tienen valor > 0. No persiste nada (sirve para preview y para el cálculo real).
 */
export async function computeWithholdings(
  companyId: string,
  customerId: string,
  bases: WithholdingBases,
): Promise<WithholdingLine[]> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: { defaultRetentionCodeRenta: true, defaultRetentionCodeIva: true },
  });
  if (!customer) return [];

  const codes = [customer.defaultRetentionCodeRenta, customer.defaultRetentionCodeIva].filter(Boolean) as string[];
  if (codes.length === 0) return [];

  const catalog = await prisma.retentionCatalog.findMany({
    where: { codigo: { in: codes }, activo: true },
  });
  const byCode = new Map(catalog.map((c) => [c.codigo, c]));
  const lines: WithholdingLine[] = [];

  // ── Retención de RENTA ──
  if (customer.defaultRetentionCodeRenta) {
    const cat = byCode.get(customer.defaultRetentionCodeRenta);
    if (cat && cat.tipo === 'RENTA') {
      const base =
        cat.aplicaA === 'BIENES' ? bases.goodsBase
        : cat.aplicaA === 'SERVICIOS' ? bases.servicesBase
        : bases.goodsBase + bases.servicesBase; // AMBOS
      const pct = Number(cat.porcentaje);
      const valor = r2(base * pct / 100);
      if (valor > 0) lines.push({ tipo: 'RENTA', codigo: cat.codigo, descripcion: cat.descripcion, baseImponible: r2(base), porcentaje: pct, valor });
    }
  }

  // ── Retención de IVA (base = IVA de la factura) ──
  if (customer.defaultRetentionCodeIva) {
    const cat = byCode.get(customer.defaultRetentionCodeIva);
    if (cat && cat.tipo === 'IVA') {
      const pct = Number(cat.porcentaje);
      const valor = r2(bases.ivaAmount * pct / 100);
      if (valor > 0) lines.push({ tipo: 'IVA', codigo: cat.codigo, descripcion: cat.descripcion, baseImponible: r2(bases.ivaAmount), porcentaje: pct, valor });
    }
  }

  return lines;
}

/**
 * Separa las bases de un conjunto de líneas (con su producto) en bienes vs. servicios.
 * `subtotalOf` debe devolver el neto (con descuento) de cada línea.
 */
export function splitBases<T>(
  lines: T[],
  productTypeOf: (l: T) => string | null | undefined,
  subtotalOf: (l: T) => number,
  taxOf: (l: T) => number,
): WithholdingBases {
  let goodsBase = 0, servicesBase = 0, ivaAmount = 0;
  for (const l of lines) {
    const sub = subtotalOf(l);
    if ((productTypeOf(l) ?? 'PRODUCT') === 'SERVICE') servicesBase += sub;
    else goodsBase += sub;
    ivaAmount += taxOf(l);
  }
  return { goodsBase: r2(goodsBase), servicesBase: r2(servicesBase), ivaAmount: r2(ivaAmount) };
}

/**
 * Preview de retenciones para un pedido (lo que se retendría al facturarlo completo).
 * Lo usa el frontend para mostrar el neto a cobrar antes de emitir.
 */
export async function previewOrderWithholdings(companyId: string, orderId: string) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: orderId, companyId },
    include: { items: { include: { product: { select: { type: true } } } }, customer: { select: { id: true } } },
  });
  if (!order) throw new Error('ORDER_NOT_FOUND');

  const bases = splitBases(
    order.items,
    (it) => it.product?.type,
    (it) => Number(it.quantity) * Number(it.unitPrice) * (1 - Number(it.discount) / 100),
    (it) => Number(it.taxAmount),
  );
  const lines = await computeWithholdings(companyId, order.customerId, bases);
  const totalWithheld = r2(lines.reduce((s, l) => s + l.valor, 0));
  const total = Number(order.total);
  return { lines, bases, totalWithheld, total, netToCollect: r2(total - totalWithheld) };
}
