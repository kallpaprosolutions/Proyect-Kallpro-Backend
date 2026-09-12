/**
 * Arma el XML (SIN FIRMAR) de una nota de débito electrónica según el esquema oficial del
 * SRI (`<notaDebito version="1.0.0">`). Motor puro, mismo criterio que
 * `nota-credito-xml.engine.ts` (del que reutiliza el catálogo de tarifas IVA y el tipo de
 * identificación del comprador — es el mismo comprador que en la factura que se está debitando).
 *
 * Diferencia estructural con la NC: la ND no tiene `detalles` (líneas con cantidad/producto) —
 * lleva `motivos` (razón + valor, sin cantidad ni producto: es un cargo adicional — interés por
 * mora, gasto no facturado, servicio complementario — no una devolución de mercancía). El IVA se
 * calcula una sola vez sobre el total de los motivos con una tarifa única (no por motivo, la
 * Ficha Técnica del SRI no lo permite).
 */
import { IVA_SRI_CODE, IvaCodigoInterno, TipoIdentificacionComprador } from './factura-xml.engine';

const TIPO_IDENTIFICACION_SRI: Record<TipoIdentificacionComprador, string> = {
  RUC: '04', CEDULA: '05', PASAPORTE: '06', CONSUMIDOR_FINAL: '07', EXTERIOR: '08',
};

export interface NotaDebitoMotivo {
  razon: string;
  valor: number;
}

export interface NotaDebitoXmlInput {
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
  /** El "documento sustento": la factura que esta ND debita. */
  docModificado: {
    tipo: 'FACTURA';
    estab: string;
    ptoEmi: string;
    secuencial: string;
    fechaEmision: Date;
  };
  /** Tarifa única de IVA aplicada sobre el total de los motivos (no por motivo). */
  ivaCodigo: IvaCodigoInterno;
  motivos: NotaDebitoMotivo[];
  infoAdicional?: Record<string, string>;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const money = (n: number) => n.toFixed(2);
const pad2 = (n: number) => String(n).padStart(2, '0');
const fechaDDMMAAAA = (d: Date) => `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;

const COD_DOC_MODIFICADO: Record<NotaDebitoXmlInput['docModificado']['tipo'], string> = { FACTURA: '01' };

export function buildNotaDebitoXml(input: NotaDebitoXmlInput): string {
  if (!/^\d{49}$/.test(input.claveAcceso)) {
    throw new Error('claveAcceso debe tener 49 dígitos (usar clave-acceso.engine.ts para construirla)');
  }
  if (input.motivos.length === 0) throw new Error('La nota de débito debe tener al menos un motivo');
  if (input.motivos.some((m) => !m.razon.trim())) throw new Error('Todo motivo debe indicar una razón');
  if (input.motivos.some((m) => !(m.valor > 0))) throw new Error('El valor de cada motivo debe ser mayor a cero');

  const totalSinImpuestos = Math.round(input.motivos.reduce((s, m) => s + m.valor, 0) * 100) / 100;
  const { tarifa, codigoPorcentaje } = IVA_SRI_CODE[input.ivaCodigo];
  const valorImpuesto = Math.round(totalSinImpuestos * (tarifa / 100) * 100) / 100;
  const valorTotal = Math.round((totalSinImpuestos + valorImpuesto) * 100) / 100;
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
    <codDoc>05</codDoc>
    <estab>${input.estab}</estab>
    <ptoEmi>${input.ptoEmi}</ptoEmi>
    <secuencial>${input.secuencial}</secuencial>
    <dirMatriz>${escapeXml(input.emisor.dirMatriz)}</dirMatriz>
  </infoTributaria>`;

  const infoNotaDebito = `
  <infoNotaDebito>
    <fechaEmision>${fechaDDMMAAAA(input.fechaEmision)}</fechaEmision>
    ${input.emisor.dirEstablecimiento ? `<dirEstablecimiento>${escapeXml(input.emisor.dirEstablecimiento)}</dirEstablecimiento>` : ''}
    <tipoIdentificacionComprador>${TIPO_IDENTIFICACION_SRI[input.comprador.tipoIdentificacion]}</tipoIdentificacionComprador>
    <razonSocialComprador>${escapeXml(input.comprador.razonSocial)}</razonSocialComprador>
    <identificacionComprador>${input.comprador.identificacion}</identificacionComprador>
    ${input.emisor.contribuyenteEspecial ? `<contribuyenteEspecial>${escapeXml(input.emisor.contribuyenteEspecial)}</contribuyenteEspecial>` : ''}
    <obligadoContabilidad>${input.emisor.obligadoContabilidad ? 'SI' : 'NO'}</obligadoContabilidad>
    <codDocModificado>${COD_DOC_MODIFICADO[input.docModificado.tipo]}</codDocModificado>
    <numDocModificado>${input.docModificado.estab}-${input.docModificado.ptoEmi}-${input.docModificado.secuencial}</numDocModificado>
    <fechaEmisionDocSustento>${fechaDDMMAAAA(input.docModificado.fechaEmision)}</fechaEmisionDocSustento>
    <totalSinImpuestos>${money(totalSinImpuestos)}</totalSinImpuestos>
    <impuestos>
      <impuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${codigoPorcentaje}</codigoPorcentaje>
        <tarifa>${tarifa.toFixed(2)}</tarifa>
        <valor>${money(valorImpuesto)}</valor>
      </impuesto>
    </impuestos>
    <valorTotal>${money(valorTotal)}</valorTotal>
  </infoNotaDebito>`;

  const motivos = input.motivos.map((m) => `
    <motivo>
      <razon>${escapeXml(m.razon).slice(0, 300)}</razon>
      <valor>${money(m.valor)}</valor>
    </motivo>`).join('');

  const infoAdicionalEntries = Object.entries(input.infoAdicional ?? {});
  const infoAdicional = infoAdicionalEntries.length === 0 ? '' : `
  <infoAdicional>${infoAdicionalEntries.map(([nombre, valor]) => `
    <campoAdicional nombre="${escapeXml(nombre)}">${escapeXml(valor)}</campoAdicional>`).join('')}
  </infoAdicional>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<notaDebito id="comprobante" version="1.0.0">${infoTributaria}${infoNotaDebito}
  <motivos>${motivos}
  </motivos>${infoAdicional}
</notaDebito>`;
}
