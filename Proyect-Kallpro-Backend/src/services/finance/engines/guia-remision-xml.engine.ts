/**
 * Arma el XML (SIN FIRMAR) de una guía de remisión electrónica según el esquema oficial del
 * SRI (`<guiaRemision version="1.0.0">`). Motor puro, mismo criterio que
 * `nota-debito-xml.engine.ts` (reutiliza el catálogo de tipo de identificación).
 *
 * Diferencia estructural con factura/NC/ND: NO tiene valores monetarios — es el sustento del
 * TRASLADO de mercadería, no una venta ni un cargo. No hay `docModificado` (no modifica ningún
 * comprobante); en su lugar lleva datos del transportista/trayecto y, opcionalmente, el
 * documento sustento de venta (factura) si existe y ya está autorizado — el SRI lo permite
 * como referencia pero no lo exige.
 */
import { TipoIdentificacionComprador } from './factura-xml.engine';

const TIPO_IDENTIFICACION_SRI: Record<TipoIdentificacionComprador, string> = {
  RUC: '04', CEDULA: '05', PASAPORTE: '06', CONSUMIDOR_FINAL: '07', EXTERIOR: '08',
};

export interface GuiaRemisionXmlItem {
  codigoInterno: string;
  descripcion: string;
  cantidad: number;
}

export interface GuiaRemisionXmlInput {
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
  dirPartida: string;
  transportista: {
    razonSocial: string;
    tipoIdentificacion: TipoIdentificacionComprador;
    identificacion: string;
    placa: string;
  };
  fechaIniTransporte: Date;
  fechaFinTransporte: Date;
  destinatario: {
    tipoIdentificacion: TipoIdentificacionComprador;
    identificacion: string;
    razonSocial: string;
    direccion?: string;
    motivoTraslado: string;
    /** Documento sustento (opcional): factura ya AUTORIZADA que originó el traslado. */
    docSustento?: {
      estab: string;
      ptoEmi: string;
      secuencial: string;
      numeroAutorizacion: string;
      fechaEmision: Date;
    };
  };
  items: GuiaRemisionXmlItem[];
  infoAdicional?: Record<string, string>;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const qty = (n: number) => n.toFixed(6);
const pad2 = (n: number) => String(n).padStart(2, '0');
const fechaDDMMAAAA = (d: Date) => `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;

export function buildGuiaRemisionXml(input: GuiaRemisionXmlInput): string {
  if (!/^\d{49}$/.test(input.claveAcceso)) {
    throw new Error('claveAcceso debe tener 49 dígitos (usar clave-acceso.engine.ts para construirla)');
  }
  if (input.items.length === 0) throw new Error('La guía de remisión debe tener al menos un ítem');
  if (!input.destinatario.motivoTraslado.trim()) throw new Error('El destinatario debe indicar un motivo de traslado');
  if (!input.transportista.placa.trim()) throw new Error('El transportista debe indicar la placa del vehículo');
  if (input.fechaFinTransporte < input.fechaIniTransporte) {
    throw new Error('La fecha de fin de transporte no puede ser anterior a la de inicio');
  }

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
    <codDoc>06</codDoc>
    <estab>${input.estab}</estab>
    <ptoEmi>${input.ptoEmi}</ptoEmi>
    <secuencial>${input.secuencial}</secuencial>
    <dirMatriz>${escapeXml(input.emisor.dirMatriz)}</dirMatriz>
  </infoTributaria>`;

  const infoGuiaRemision = `
  <infoGuiaRemision>
    ${input.emisor.dirEstablecimiento ? `<dirEstablecimiento>${escapeXml(input.emisor.dirEstablecimiento)}</dirEstablecimiento>` : ''}
    <dirPartida>${escapeXml(input.dirPartida)}</dirPartida>
    <razonSocialTransportista>${escapeXml(input.transportista.razonSocial)}</razonSocialTransportista>
    <tipoIdentificacionTransportista>${TIPO_IDENTIFICACION_SRI[input.transportista.tipoIdentificacion]}</tipoIdentificacionTransportista>
    <rucTransportista>${input.transportista.identificacion}</rucTransportista>
    ${input.emisor.contribuyenteEspecial ? `<contribuyenteEspecial>${escapeXml(input.emisor.contribuyenteEspecial)}</contribuyenteEspecial>` : ''}
    <obligadoContabilidad>${input.emisor.obligadoContabilidad ? 'SI' : 'NO'}</obligadoContabilidad>
    <fechaIniTransporte>${fechaDDMMAAAA(input.fechaIniTransporte)}</fechaIniTransporte>
    <fechaFinTransporte>${fechaDDMMAAAA(input.fechaFinTransporte)}</fechaFinTransporte>
    <placa>${escapeXml(input.transportista.placa)}</placa>
  </infoGuiaRemision>`;

  const d = input.destinatario;
  const docSustento = d.docSustento ? `
      <codDocSustento>01</codDocSustento>
      <numDocSustento>${d.docSustento.estab}-${d.docSustento.ptoEmi}-${d.docSustento.secuencial}</numDocSustento>
      <numAutDocSustento>${d.docSustento.numeroAutorizacion}</numAutDocSustento>
      <fechaEmisionDocSustento>${fechaDDMMAAAA(d.docSustento.fechaEmision)}</fechaEmisionDocSustento>` : '';

  const detalles = input.items.map((it) => `
        <detalle>
          <codigoInterno>${escapeXml(it.codigoInterno)}</codigoInterno>
          <descripcion>${escapeXml(it.descripcion)}</descripcion>
          <cantidad>${qty(it.cantidad)}</cantidad>
        </detalle>`).join('');

  const destinatarios = `
  <destinatarios>
    <destinatario>
      <identificacionDestinatario>${d.identificacion}</identificacionDestinatario>
      <razonSocialDestinatario>${escapeXml(d.razonSocial)}</razonSocialDestinatario>
      ${d.direccion ? `<dirDestinatario>${escapeXml(d.direccion)}</dirDestinatario>` : ''}
      <motivoTraslado>${escapeXml(d.motivoTraslado).slice(0, 300)}</motivoTraslado>${docSustento}
      <detalles>${detalles}
      </detalles>
    </destinatario>
  </destinatarios>`;

  const infoAdicionalEntries = Object.entries(input.infoAdicional ?? {});
  const infoAdicional = infoAdicionalEntries.length === 0 ? '' : `
  <infoAdicional>${infoAdicionalEntries.map(([nombre, valor]) => `
    <campoAdicional nombre="${escapeXml(nombre)}">${escapeXml(valor)}</campoAdicional>`).join('')}
  </infoAdicional>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<guiaRemision id="comprobante" version="1.0.0">${infoTributaria}${infoGuiaRemision}${destinatarios}${infoAdicional}
</guiaRemision>`;
}
