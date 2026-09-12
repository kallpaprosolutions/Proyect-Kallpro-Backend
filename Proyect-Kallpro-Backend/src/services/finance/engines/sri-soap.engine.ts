/**
 * Sobres SOAP y parseo de respuestas del web service de comprobantes electrónicos del SRI
 * (RecepcionComprobantesOffline / AutorizacionComprobantesOffline). Motor puro: arma strings
 * y parsea strings — la red vive en `sri-soap-client.ts`, así que esto se prueba con
 * respuestas reales capturadas como fixtures, sin tocar al SRI.
 *
 * Namespaces y nombres de elementos verificados contra el WSDL público (2026-09-11):
 *   recepción   → http://ec.gob.sri.ws.recepcion   · validarComprobante/xml (base64)
 *   autorización→ http://ec.gob.sri.ws.autorizacion · autorizacionComprobante/claveAccesoComprobante
 * Los hijos son `elementFormDefault="unqualified"` → van SIN prefijo dentro de la operación.
 */
import { XMLParser } from 'fast-xml-parser';

export interface SriMensaje {
  identificador: string;
  mensaje: string;
  informacionAdicional?: string;
  tipo?: string; // ERROR | ADVERTENCIA
}

export interface RecepcionResult {
  estado: 'RECIBIDA' | 'DEVUELTA';
  mensajes: SriMensaje[];
}

export interface AutorizacionResult {
  /** SIN_RESPUESTA = el SRI aún no tiene el comprobante (numeroComprobantes 0) — reintentar luego. */
  estado: 'AUTORIZADO' | 'NO AUTORIZADO' | 'EN PROCESO' | 'SIN_RESPUESTA';
  numeroAutorizacion?: string;
  fechaAutorizacion?: Date;
  ambiente?: string;
  comprobante?: string; // XML del comprobante tal como lo devuelve el SRI (para el RIDE)
  mensajes: SriMensaje[];
}

/** Código con el que el SRI responde cuando la clave de acceso ya fue recibida antes: no es un error, hay que pasar a consultar la autorización. */
export const SRI_CLAVE_YA_REGISTRADA = '43';

export function buildRecepcionEnvelope(signedXml: string): string {
  const base64 = Buffer.from(signedXml, 'utf8').toString('base64');
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:validarComprobante>
      <xml>${base64}</xml>
    </ec:validarComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;
}

export function buildAutorizacionEnvelope(claveAcceso: string): string {
  if (!/^\d{49}$/.test(claveAcceso)) throw new Error('La clave de acceso debe tener 49 dígitos');
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:autorizacionComprobante>
      <claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>
    </ec:autorizacionComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// `removeNSPrefix`: el SRI responde con prefijos variables (ns2:, soap:, S:) según el nodo
// que atienda; `parseTagValue: false` conserva claves/números de autorización como texto (un
// número de 49 dígitos desborda un Number y perdería dígitos).
const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false, trimValues: true });

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function parseMensajes(node: any): SriMensaje[] {
  return asArray<any>(node?.mensaje).map((m) => ({
    identificador: String(m?.identificador ?? ''),
    mensaje: String(m?.mensaje ?? ''),
    informacionAdicional: m?.informacionAdicional != null ? String(m.informacionAdicional) : undefined,
    tipo: m?.tipo != null ? String(m.tipo) : undefined,
  }));
}

/** Busca un nodo por nombre en cualquier profundidad (el Body puede venir envuelto en Envelope/Body/validarComprobanteResponse…). */
function findDeep(obj: any, name: string): any {
  if (obj == null || typeof obj !== 'object') return undefined;
  if (name in obj) return obj[name];
  for (const key of Object.keys(obj)) {
    const found = findDeep(obj[key], name);
    if (found !== undefined) return found;
  }
  return undefined;
}

function parseSoapFault(root: any): string | null {
  const fault = findDeep(root, 'Fault');
  if (!fault) return null;
  return String(fault.faultstring ?? fault.Reason?.Text ?? 'SOAP Fault del SRI');
}

export function parseRecepcionResponse(xml: string): RecepcionResult {
  const root = parser.parse(xml);
  const fault = parseSoapFault(root);
  if (fault) throw new Error(`El SRI devolvió un error SOAP: ${fault}`);
  const resp = findDeep(root, 'RespuestaRecepcionComprobante');
  if (!resp) throw new Error('Respuesta de recepción del SRI sin RespuestaRecepcionComprobante');
  const estado = String(resp.estado ?? '').toUpperCase() === 'RECIBIDA' ? 'RECIBIDA' : 'DEVUELTA';
  const mensajes = asArray<any>(resp.comprobantes?.comprobante).flatMap((c) => parseMensajes(c?.mensajes));
  return { estado, mensajes };
}

export function parseAutorizacionResponse(xml: string): AutorizacionResult {
  const root = parser.parse(xml);
  const fault = parseSoapFault(root);
  if (fault) throw new Error(`El SRI devolvió un error SOAP: ${fault}`);
  const resp = findDeep(root, 'RespuestaAutorizacionComprobante');
  if (!resp) throw new Error('Respuesta de autorización del SRI sin RespuestaAutorizacionComprobante');
  const autorizaciones = asArray<any>(resp.autorizaciones?.autorizacion);
  if (autorizaciones.length === 0) return { estado: 'SIN_RESPUESTA', mensajes: [] };
  // El SRI puede devolver más de una autorización para la misma clave (reintentos); la
  // AUTORIZADA manda si existe, si no la última registrada.
  const chosen = autorizaciones.find((a) => String(a?.estado).toUpperCase() === 'AUTORIZADO') ?? autorizaciones[autorizaciones.length - 1];
  const rawEstado = String(chosen?.estado ?? '').toUpperCase();
  const estado: AutorizacionResult['estado'] =
    rawEstado === 'AUTORIZADO' ? 'AUTORIZADO' : rawEstado === 'NO AUTORIZADO' ? 'NO AUTORIZADO' : 'EN PROCESO';
  const fecha = chosen?.fechaAutorizacion ? new Date(String(chosen.fechaAutorizacion)) : undefined;
  return {
    estado,
    numeroAutorizacion: chosen?.numeroAutorizacion != null ? String(chosen.numeroAutorizacion) : undefined,
    fechaAutorizacion: fecha && !Number.isNaN(fecha.getTime()) ? fecha : undefined,
    ambiente: chosen?.ambiente != null ? String(chosen.ambiente) : undefined,
    comprobante: chosen?.comprobante != null ? String(chosen.comprobante) : undefined,
    mensajes: parseMensajes(chosen?.mensajes),
  };
}
