/**
 * Arma el XML (SIN FIRMAR) de una factura electrónica según el esquema oficial del SRI
 * (Ficha Técnica de Comprobantes Electrónicos, comprobante <factura version="1.1.0">).
 * Motor puro: recibe un objeto plano, devuelve un string — sin Prisma, sin red, sin fechas
 * "ahora" (la fecha de emisión viene en el input). La firma XAdES-BES es responsabilidad de
 * `signer.ts` (Etapa 2, siguiente paso); el envío al SRI es de `sri-soap-client.ts` (Etapa 3).
 *
 * Catálogo de tarifas IVA (Tabla 21 del SRI) — mapea el código interno que KallpaPro ya usa
 * en `tax.service.ts` (TaxIva.codigo: '0'|'8'|'12'|'15'|'NO_OBJETO'|'EXENTO') al
 * `codigoPorcentaje` oficial que exige el XML. Si el SRI publica una tarifa nueva, se agrega
 * aquí y en `tax.service.ts` — un solo lugar, nunca un código quemado en medio del XML.
 */
export const IVA_SRI_CODE: Record<string, { codigoPorcentaje: string; tarifa: number }> = {
  '0': { codigoPorcentaje: '0', tarifa: 0 },
  '8': { codigoPorcentaje: '8', tarifa: 8 },
  '12': { codigoPorcentaje: '2', tarifa: 12 },
  '15': { codigoPorcentaje: '4', tarifa: 15 },
  NO_OBJETO: { codigoPorcentaje: '6', tarifa: 0 },
  EXENTO: { codigoPorcentaje: '7', tarifa: 0 },
};

export type IvaCodigoInterno = keyof typeof IVA_SRI_CODE;

export type TipoIdentificacionComprador = 'RUC' | 'CEDULA' | 'PASAPORTE' | 'CONSUMIDOR_FINAL' | 'EXTERIOR';

const TIPO_IDENTIFICACION_SRI: Record<TipoIdentificacionComprador, string> = {
  RUC: '04',
  CEDULA: '05',
  PASAPORTE: '06',
  CONSUMIDOR_FINAL: '07',
  EXTERIOR: '08',
};

export interface FacturaXmlItem {
  codigoPrincipal: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento?: number;
  ivaCodigo: IvaCodigoInterno;
}

export interface FacturaXmlInput {
  ambiente: 'PRUEBAS' | 'PRODUCCION';
  tipoEmision?: 'NORMAL' | 'CONTINGENCIA';
  claveAcceso: string; // 49 dígitos — la construye clave-acceso.engine.ts antes de llamar aquí
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
  items: FacturaXmlItem[];
  /** Código de forma de pago (Tabla SRI): '01' sin sistema financiero, '20' otros con sistema financiero (default). */
  formaPago?: string;
  propina?: number;
  infoAdicional?: Record<string, string>;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const money = (n: number) => n.toFixed(2);
const qty = (n: number) => n.toFixed(6);
const pad2 = (n: number) => String(n).padStart(2, '0');
const fechaDDMMAAAA = (d: Date) => `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;

interface ItemComputed extends FacturaXmlItem {
  descuentoValor: number;
  precioTotalSinImpuesto: number;
  baseImponible: number;
  valorIva: number;
}

function computeItem(item: FacturaXmlItem): ItemComputed {
  const descuentoValor = item.descuento ?? 0;
  const precioTotalSinImpuesto = Math.round((item.cantidad * item.precioUnitario - descuentoValor) * 100) / 100;
  const { tarifa } = IVA_SRI_CODE[item.ivaCodigo];
  const valorIva = Math.round(precioTotalSinImpuesto * (tarifa / 100) * 100) / 100;
  return { ...item, descuentoValor, precioTotalSinImpuesto, baseImponible: precioTotalSinImpuesto, valorIva };
}

export function buildFacturaXml(input: FacturaXmlInput): string {
  if (!/^\d{49}$/.test(input.claveAcceso)) {
    throw new Error('claveAcceso debe tener 49 dígitos (usar clave-acceso.engine.ts para construirla)');
  }
  if (input.items.length === 0) {
    throw new Error('La factura debe tener al menos un ítem');
  }

  const items = input.items.map(computeItem);
  const totalSinImpuestos = Math.round(items.reduce((s, i) => s + i.precioTotalSinImpuesto, 0) * 100) / 100;
  const totalDescuento = Math.round(items.reduce((s, i) => s + i.descuentoValor, 0) * 100) / 100;
  const propina = input.propina ?? 0;

  // Agrupa por tarifa de IVA para el resumen `totalConImpuestos` (una línea por tarifa, no por ítem)
  const porIva = new Map<IvaCodigoInterno, { baseImponible: number; valor: number }>();
  for (const it of items) {
    const acc = porIva.get(it.ivaCodigo) ?? { baseImponible: 0, valor: 0 };
    acc.baseImponible += it.baseImponible;
    acc.valor += it.valorIva;
    porIva.set(it.ivaCodigo, acc);
  }
  const totalIva = Math.round([...porIva.values()].reduce((s, v) => s + v.valor, 0) * 100) / 100;
  const importeTotal = Math.round((totalSinImpuestos + totalIva + propina) * 100) / 100;
  const ambiente = input.ambiente === 'PRODUCCION' ? '2' : '1';
  const tipoEmision = input.tipoEmision === 'CONTINGENCIA' ? '2' : '1';
  const formaPago = input.formaPago ?? '20';

  const infoTributaria = `
  <infoTributaria>
    <ambiente>${ambiente}</ambiente>
    <tipoEmision>${tipoEmision}</tipoEmision>
    <razonSocial>${escapeXml(input.emisor.razonSocial)}</razonSocial>
    ${input.emisor.nombreComercial ? `<nombreComercial>${escapeXml(input.emisor.nombreComercial)}</nombreComercial>` : ''}
    <ruc>${input.emisor.ruc}</ruc>
    <claveAcceso>${input.claveAcceso}</claveAcceso>
    <codDoc>01</codDoc>
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

  const infoFactura = `
  <infoFactura>
    <fechaEmision>${fechaDDMMAAAA(input.fechaEmision)}</fechaEmision>
    ${input.emisor.dirEstablecimiento ? `<dirEstablecimiento>${escapeXml(input.emisor.dirEstablecimiento)}</dirEstablecimiento>` : ''}
    ${input.emisor.contribuyenteEspecial ? `<contribuyenteEspecial>${escapeXml(input.emisor.contribuyenteEspecial)}</contribuyenteEspecial>` : ''}
    <obligadoContabilidad>${input.emisor.obligadoContabilidad ? 'SI' : 'NO'}</obligadoContabilidad>
    <tipoIdentificacionComprador>${TIPO_IDENTIFICACION_SRI[input.comprador.tipoIdentificacion]}</tipoIdentificacionComprador>
    <razonSocialComprador>${escapeXml(input.comprador.razonSocial)}</razonSocialComprador>
    <identificacionComprador>${input.comprador.identificacion}</identificacionComprador>
    ${input.comprador.direccion ? `<direccionComprador>${escapeXml(input.comprador.direccion)}</direccionComprador>` : ''}
    <totalSinImpuestos>${money(totalSinImpuestos)}</totalSinImpuestos>
    <totalDescuento>${money(totalDescuento)}</totalDescuento>
    <totalConImpuestos>${totalConImpuestos}
    </totalConImpuestos>
    <propina>${money(propina)}</propina>
    <importeTotal>${money(importeTotal)}</importeTotal>
    <moneda>DOLAR</moneda>
    <pagos>
      <pago>
        <formaPago>${formaPago}</formaPago>
        <total>${money(importeTotal)}</total>
      </pago>
    </pagos>
  </infoFactura>`;

  const detalles = items.map((it) => `
    <detalle>
      <codigoPrincipal>${escapeXml(it.codigoPrincipal)}</codigoPrincipal>
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
          <baseImponible>${money(it.baseImponible)}</baseImponible>
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
<factura id="comprobante" version="1.1.0">${infoTributaria}${infoFactura}
  <detalles>${detalles}
  </detalles>${infoAdicional}
</factura>`;
}
