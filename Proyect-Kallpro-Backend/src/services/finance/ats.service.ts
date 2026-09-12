/**
 * ATS (Anexo Transaccional Simplificado) — detalle mensual de compras/ventas/retenciones que
 * el SRI exige junto a la declaración de IVA (Formulario 104, mismo período). Reusa
 * `periodRange`/`ivaRateForDate` de `sri-casillas.service.ts` para quedar consistente con el
 * 104 (misma ventana de fechas, mismo criterio de tarifa vigente por fecha).
 *
 * Ventas: si la factura nació de un pedido de venta (tiene `salesOrderId`), el desglose de IVA
 * es EXACTO — se reusan las mismas líneas con tarifa real que arma la emisión electrónica
 * (`loadInvoiceForSri`, Etapa 3) vía `computeVentaBreakdownFromLines` (Etapa 7). Solo las
 * facturas manuales sin pedido (`FAC-` directas, sin líneas con IVA propio) siguen cayendo a
 * la aproximación heredada `total / (1 + tasa)` — misma limitación ya documentada y aceptada
 * para el Formulario 104, ahora acotada a un caso residual en vez de ser la regla general.
 * Las compras (`SriDocument`) SÍ traen el desglose real (vienen del XML del SRI o de captura
 * manual con IVA por ítem), así que su base imponible siempre fue exacta.
 */
import { prisma } from '../../lib/prisma';
import { periodRange, ivaRateForDate } from './sri-casillas.service';
import { loadInvoiceForSri } from './electronic-invoice.service';
import {
  classifyIdentificacion, tipoComprobanteAts, approximateNetFromTotal, computeVentaBreakdownFromLines,
  buildAtsSummary, AtsComprasRow, AtsVentasRow, AtsSummary,
} from './engines/ats.engine';

export async function getAtsReport(companyId: string, period: string): Promise<AtsSummary> {
  const { start, end } = periodRange(period);
  const rate = ivaRateForDate(start);

  const [sriDocs, invoices, company] = await Promise.all([
    prisma.sriDocument.findMany({
      where: { companyId, status: 'CONFIRMED', fechaEmision: { gte: start, lte: end } },
      include: { retentions: true },
    }),
    prisma.invoice.findMany({
      where: { companyId, type: 'SALES', status: { notIn: ['DRAFT', 'CANCELLED'] }, issueDate: { gte: start, lte: end } },
      include: {
        withholdings: true,
        salesOrder: { select: { customer: { select: { name: true, ruc: true } } } },
      },
    }),
    prisma.company.findFirst({ where: { id: companyId }, select: { name: true } }),
  ]);

  const comprasRows: AtsComprasRow[] = sriDocs.map((doc) => {
    const retIva = doc.retentions.filter((r) => r.tipo === 'IVA').reduce((s, r) => s + Number(r.valor), 0);
    const retRenta = doc.retentions.filter((r) => r.tipo === 'RENTA').reduce((s, r) => s + Number(r.valor), 0);
    return {
      tipoIdProveedor: classifyIdentificacion(doc.rucEmisor),
      identificacionProveedor: doc.rucEmisor,
      razonSocialProveedor: doc.razonSocialEmisor,
      tipoComprobante: tipoComprobanteAts(doc.tipoDocumento),
      fechaEmision: doc.fechaEmision.toISOString().slice(0, 10),
      establecimiento: doc.estab || '001',
      puntoEmision: doc.ptoEmi || '001',
      secuencial: doc.secuencial || '000000001',
      autorizacion: doc.numeroAutorizacion || doc.claveAcceso,
      baseImpGrav0: Number(doc.subtotal0) + Number(doc.subtotalExento) + Number(doc.subtotalNoObj),
      baseImponible: Number(doc.subtotal15) + Number(doc.subtotal8) + Number(doc.subtotal12),
      montoIva: Number(doc.iva),
      valorRetIva: retIva,
      valorRetRenta: retRenta,
    };
  });

  const ventasRows: AtsVentasRow[] = await Promise.all(invoices.map(async (inv) => {
    let baseImpGrav0 = 0;
    let baseImponible: number;
    let montoIva: number;
    if (inv.salesOrderId) {
      try {
        const { forSri } = await loadInvoiceForSri(companyId, inv.id);
        const desglose = computeVentaBreakdownFromLines(forSri.lines);
        baseImpGrav0 = desglose.baseImpGrav0;
        baseImponible = desglose.baseImponible;
        montoIva = desglose.montoIva;
      } catch {
        // pedido sin líneas usables (dato corrupto/orfandad) — cae al mismo fallback que una manual
        ({ net: baseImponible, iva: montoIva } = approximateNetFromTotal(Number(inv.totalAmount), rate));
      }
    } else {
      // factura manual sin pedido: no tiene líneas con tarifa de IVA propia
      ({ net: baseImponible, iva: montoIva } = approximateNetFromTotal(Number(inv.totalAmount), rate));
    }
    const retIva = inv.withholdings.filter((w) => w.tipo === 'IVA').reduce((s, w) => s + Number(w.valor), 0);
    const retRenta = inv.withholdings.filter((w) => w.tipo === 'RENTA').reduce((s, w) => s + Number(w.valor), 0);
    const customer = inv.salesOrder?.customer;
    return {
      tipoIdComprador: classifyIdentificacion(customer?.ruc),
      identificacionComprador: customer?.ruc || '',
      razonSocialComprador: customer?.name || 'Consumidor Final',
      tipoComprobante: '01',
      fechaEmision: inv.issueDate.toISOString().slice(0, 10),
      numeroComprobante: inv.number,
      baseImpGrav0,
      baseImponible,
      montoIva,
      valorRetIva: retIva,
      valorRetRenta: retRenta,
    };
  }));

  const summary = buildAtsSummary(period, comprasRows, ventasRows);
  return summary;
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, '0');
}

/**
 * XML del ATS siguiendo la estructura pública de la Ficha Técnica del SRI (sección IVA:
 * compras/ventas). Es un BORRADOR para validar en DIMM Formularios antes de presentar — el
 * validador oficial del SRI es la fuente de verdad final, no este export (mismo criterio que
 * cualquier software contable: reduce la carga de tipeo manual, no reemplaza la validación).
 */
export async function buildAtsXml(companyId: string, period: string): Promise<string> {
  const [year, month] = period.split('-').map(Number);
  const company = await prisma.company.findFirst({ where: { id: companyId } });
  const settings: any = company?.settings ?? {};
  const ruc = settings?.company?.ruc || '';
  const report = await getAtsReport(companyId, period);

  const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const totalVentas = report.ventas.totalBaseImponible + report.ventas.totalIva;

  const comprasXml = report.compras.rows.map((r) => `
    <detalleCompra>
      <codSustento>01</codSustento>
      <tpIdProv>${r.tipoIdProveedor}</tpIdProv>
      <idProv>${esc(r.identificacionProveedor)}</idProv>
      <tipoComprobante>${r.tipoComprobante}</tipoComprobante>
      <parteRel>NO</parteRel>
      <fechaRegistro>${r.fechaEmision}</fechaRegistro>
      <establecimiento>${r.establecimiento}</establecimiento>
      <puntoEmision>${r.puntoEmision}</puntoEmision>
      <secuencial>${r.secuencial}</secuencial>
      <fechaEmision>${r.fechaEmision}</fechaEmision>
      <autorizacion>${esc(r.autorizacion)}</autorizacion>
      <baseNoGraIva>0.00</baseNoGraIva>
      <baseImponible>${r.baseImponible.toFixed(2)}</baseImponible>
      <baseImpGrav0>${r.baseImpGrav0.toFixed(2)}</baseImpGrav0>
      <montoIva>${r.montoIva.toFixed(2)}</montoIva>
      <valorRetIva>${r.valorRetIva.toFixed(2)}</valorRetIva>
      <valorRetRenta>${r.valorRetRenta.toFixed(2)}</valorRetRenta>
    </detalleCompra>`).join('');

  const ventasXml = report.ventas.rows.map((r) => `
    <detalleVenta>
      <tpIdCliente>${r.tipoIdComprador}</tpIdCliente>
      <idCliente>${esc(r.identificacionComprador)}</idCliente>
      <parteRelVtas>NO</parteRelVtas>
      <tipoComprobante>${r.tipoComprobante}</tipoComprobante>
      <numeroComprobantes>${esc(r.numeroComprobante)}</numeroComprobantes>
      <baseNoGraIva>0.00</baseNoGraIva>
      <baseImponible>${r.baseImponible.toFixed(2)}</baseImponible>
      <baseImpGrav0>${r.baseImpGrav0.toFixed(2)}</baseImpGrav0>
      <montoIva>${r.montoIva.toFixed(2)}</montoIva>
      <valorRetIva>${r.valorRetIva.toFixed(2)}</valorRetIva>
      <valorRetRenta>${r.valorRetRenta.toFixed(2)}</valorRetRenta>
    </detalleVenta>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- BORRADOR generado por KallpaPro — validar en DIMM Formularios (SRI) antes de presentar -->
<iva>
  <TipoIDInformante>R</TipoIDInformante>
  <IdInformante>${esc(ruc)}</IdInformante>
  <razonSocial>${esc(company?.name || '')}</razonSocial>
  <Anio>${year}</Anio>
  <Mes>${pad(month, 2)}</Mes>
  <numEstabRuc>${pad(1, 3)}</numEstabRuc>
  <totalVentas>${totalVentas.toFixed(2)}</totalVentas>
  <codigoOperativo>IVA</codigoOperativo>
  <compras>${comprasXml}
  </compras>
  <ventas>${ventasXml}
  </ventas>
</iva>
`;
}
