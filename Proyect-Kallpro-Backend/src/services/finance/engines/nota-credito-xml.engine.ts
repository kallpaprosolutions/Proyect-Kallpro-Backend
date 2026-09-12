/**
 * Arma el XML (SIN FIRMAR) de una nota de crédito electrónica según el esquema oficial del
 * SRI (`<notaCredito version="1.1.0">`). Motor puro, mismo criterio que `factura-xml.engine.ts`
 * (del que reutiliza el catálogo de tarifas IVA y el tipo de identificación del comprador —
 * es el mismo comprador que en la factura que se está acreditando).
 *
 * Diferencia estructural con la factura: en vez de `pagos`, la NC lleva el bloque
 * `docModificado` (el "documento sustento" que ya se imprime en el PDF interno desde
 * Sprint 4 — aquí se convierte en dato tributario real, exigido por el SRI).
 */
import { IVA_SRI_CODE, IvaCodigoInterno, TipoIdentificacionComprador } from './factura-xml.engine';

const TIPO_IDENTIFICACION_SRI: Record<TipoIdentificacionComprador, string> = {
  RUC: '04', CEDULA: '05', PASAPORTE: '06', CONSUMIDOR_FINAL: '07', EXTERIOR: '08',
};

export interface NotaCreditoXmlItem {
  codigoPrincipal: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento?: number;
  ivaCodigo: IvaCodigoInterno;
}

export interface NotaCreditoXmlInput {
  ambiente: 'PRUEBAS' | 'PRODUCCION';
  tipoEmision?: 'NORMAL' | 'CONTINGENCIA';
  claveAcceso: string; // 49 dígitos
  emisor: {
    ruc: string;
    razonSocial: string;
    nombreComercial?: string;
    dirMatriz: string;
    dirEstablecimiento?: string;
    obligadoContabilidad: boolean;
    contribuyenteEspecial?: string;
  };
  estab: string;
  ptoEmi: string;
  secuencial: string;
  fechaEmision: Date;
  comprador: {
    tipoIdentificacion: TipoIdentificacionComprador;
    identificacion: string;
    razonSocial: string;
    direccion?: string;
  };
  /** El "documento sustento": la factura que esta NC modifica. */
  docModificado: {
    tipo: 'FACTURA'; // única fuente hoy; LIQUIDACION_COMPRA no aplica a NC de venta
    estab: string;
    ptoEmi: string;
    secuencial: string;
    fechaEmision: Date;
  };
  motivo: string;
  items: NotaCreditoXmlItem[];
  infoAdicional?: Record<string, string>;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const money = (n: number) => n.toFixed(2);
const qty = (n: number) => n.toFixed(6);
const pad2 = (n: number) => String(n).padStart(2, '0');
const fechaDDMMAAAA = (d: Date) => `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;

const COD_DOC_MODIFICADO: Record<NotaCreditoXmlInput['docModificado']['tipo'], string> = { FACTURA: '01' };

interface ItemComputed extends NotaCreditoXmlItem {
  descuentoValor: number;
  precioTotalSinImpuesto: number;
  valorIva: number;
}

function computeItem(item: NotaCreditoXmlItem): ItemComputed {
  const descuentoValor = item.descuento ?? 0;
  const precioTotalSinImpuesto = Math.round((item.cantidad * item.precioUnitario - descuentoValor) * 100) / 100;
  const { tarifa } = IVA_SRI_CODE[item.ivaCodigo];
  const valorIva = Math.round(precioTotalSinImpuesto * (tarifa / 100) * 100) / 100;
  return { ...item, descuentoValor, precioTotalSinImpuesto, valorIva };
}

export function buildNotaCreditoXml(input: NotaCreditoXmlInput): string {
  if (!/^\d{49}$/.test(input.claveAcceso)) {
    throw new Error('claveAcceso debe tener 49 dígitos (usar clave-acceso.engine.ts para construirla)');
  }
  if (input.items.length === 0) throw new Error('La nota de crédito debe tener al menos un ítem');
  if (!input.motivo.trim()) throw new Error('La nota de crédito debe indicar un motivo');

  const items = input.items.map(computeItem);
  const totalSinImpuestos = Math.round(items.reduce((s, i) => s + i.precioTotalSinImpuesto, 0) * 100) / 100;

  const porIva = new Map<IvaCodigoInterno, { baseImponible: number; valor: number }>();
  for (const it of items) {
    const acc = porIva.get(it.ivaCodigo) ?? { baseImponible: 0, valor: 0 };
    acc.baseImponible += it.precioTotalSinImpuesto;
    acc.valor += it.valorIva;
    porIva.set(it.ivaCodigo, acc);
  }
  const totalIva = Math.round([...porIva.values()].reduce((s, v) => s + v.valor, 0) * 100) / 100;
  const valorModificacion = Math.round((totalSinImpuestos + totalIva) * 100) / 100;
  const ambiente = input.ambiente === 'PRODUCCION' ? '2' : '1';
  const tipoEmision = input.tipoEmision === 'CONTINGENCIA' ? '2' : '1';

  const infoTributaria = `
  <infoTributaria>
    <ambiente>${ambiente}</ambiente>
    <tipoEmision>${tipoEmision}</tipoEmision>
    <razonSocial>${escapeXml(input.emisor.razonSocial)}</razonSocial>
    ${input.emisor.nombreComercial ? `<nombreComercial>${escapeXml(input.emisor.nombreComercial)}</nombreComercial>` : ''}
    <ruc>${input.emisor.ruc}</ruc>
    <claveAcceso>${input.claveAcceso}</claveAcceso>
    <codDoc>04</codDoc>
    <estab>${input.estab}</estab>
    <ptoEmi>${input.ptoEmi}</ptoEmi>
    <secuencial>${input.secuencial}</secuencial>
    <dirMatriz>${escapeXml(input.emisor.dirMatriz)}</dirMatriz>
  </infoTributaria>`;

  const totalConImpuestos = [...porIva.entries()].map(([codigo, v]) => `
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${IVA_SRI_CODE[codigo].codigoPorcentaje}</codigoPorcentaje>
        <baseImponible>${money(v.baseImponible)}</baseImponible>
        <valor>${money(v.valor)}</valor>
      </totalImpuesto>`).join('');

  const infoNotaCredito = `
  <infoNotaCredito>
    <fechaEmision>${fechaDDMMAAAA(input.fechaEmision)}</fechaEmision>
    ${input.emisor.dirEstablecimiento ? `<dirEstablecimiento>${escapeXml(input.emisor.dirEstablecimiento)}</dirEstablecimiento>` : ''}
    <tipoIdentificacionComprador>${TIPO_IDENTIFICACION_SRI[input.comprador.tipoIdentificacion]}</tipoIdentificacionComprador>
    ${input.emisor.contribuyenteEspecial ? `<contribuyenteEspecial>${escapeXml(input.emisor.contribuyenteEspecial)}</contribuyenteEspecial>` : ''}
    <obligadoContabilidad>${input.emisor.obligadoContabilidad ? 'SI' : 'NO'}</obligadoContabilidad>
    <razonSocialComprador>${escapeXml(input.comprador.razonSocial)}</razonSocialComprador>
    <identificacionComprador>${input.comprador.identificacion}</identificacionComprador>
    <codDocModificado>${COD_DOC_MODIFICADO[input.docModificado.tipo]}</codDocModificado>
    <numDocModificado>${input.docModificado.estab}-${input.docModificado.ptoEmi}-${input.docModificado.secuencial}</numDocModificado>
    <fechaEmisionDocSustento>${fechaDDMMAAAA(input.docModificado.fechaEmision)}</fechaEmisionDocSustento>
    <totalSinImpuestos>${money(totalSinImpuestos)}</totalSinImpuestos>
    <valorModificacion>${money(valorModificacion)}</valorModificacion>
    <moneda>DOLAR</moneda>
    <totalConImpuestos>${totalConImpuestos}
    </totalConImpuestos>
    <motivo>${escapeXml(input.motivo).slice(0, 300)}</motivo>
  </infoNotaCredito>`;

  const detalles = items.map((it) => `
    <detalle>
      <codigoInterno>${escapeXml(it.codigoPrincipal)}</codigoInterno>
      <descripcion>${escapeXml(it.descripcion)}</descripcion>
      <cantidad>${qty(it.cantidad)}</cantidad>
      <precioUnitario>${qty(it.precioUnitario)}</precioUnitario>
      <descuento>${money(it.descuentoValor)}</descuento>
      <precioTotalSinImpuesto>${money(it.precioTotalSinImpuesto)}</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${IVA_SRI_CODE[it.ivaCodigo].codigoPorcentaje}</codigoPorcentaje>
          <tarifa>${IVA_SRI_CODE[it.ivaCodigo].tarifa.toFixed(2)}</tarifa>
          <baseImponible>${money(it.precioTotalSinImpuesto)}</baseImponible>
          <valor>${money(it.valorIva)}</valor>
        </impuesto>
      </impuestos>
    </detalle>`).join('');

  const infoAdicionalEntries = Object.entries(input.infoAdicional ?? {});
  const infoAdicional = infoAdicionalEntries.length === 0 ? '' : `
  <infoAdicional>${infoAdicionalEntries.map(([nombre, valor]) => `
    <campoAdicional nombre="${escapeXml(nombre)}">${escapeXml(valor)}</campoAdicional>`).join('')}
  </infoAdicional>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<notaCredito id="comprobante" version="1.1.0">${infoTributaria}${infoNotaCredito}
  <detalles>${detalles}
  </detalles>${infoAdicional}
</notaCredito>`;
}
