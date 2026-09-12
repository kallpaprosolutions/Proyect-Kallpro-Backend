/**
 * Transporte HTTP hacia el web service SOAP del SRI. Deliberadamente mínimo: solo POST del
 * sobre y devolución del XML crudo — armar el sobre y parsear la respuesta es de
 * `engines/sri-soap.engine.ts` (puro, testeable). Los tests de servicio mockean este módulo.
 */
import axios from 'axios';
import { AppError } from '../../utils/errors';

export type SriAmbiente = 'PRUEBAS' | 'PRODUCCION';

// URLs verificadas contra el WSDL público (2026-09-11). celcer = certificación (pruebas), cel = producción.
export const SRI_ENDPOINTS: Record<SriAmbiente, { recepcion: string; autorizacion: string }> = {
  PRUEBAS: {
    recepcion: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline',
    autorizacion: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline',
  },
  PRODUCCION: {
    recepcion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline',
    autorizacion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline',
  },
};

const TIMEOUT_MS = 30_000;

async function postSoap(url: string, envelope: string): Promise<string> {
  try {
    const res = await axios.post<string>(url, envelope, {
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
      timeout: TIMEOUT_MS,
      responseType: 'text',
      // Un 500 con SOAP Fault también trae XML útil: se deja pasar y lo interpreta el parser.
      validateStatus: (s) => s < 600,
    });
    return String(res.data ?? '');
  } catch (e: any) {
    const reason = e?.code === 'ECONNABORTED' ? 'tiempo de espera agotado' : (e?.message ?? 'error de red');
    throw AppError.badRequest(`No se pudo contactar al SRI (${reason}). El comprobante quedó firmado; reintenta más tarde.`, 'SRI_UNAVAILABLE');
  }
}

export async function sendRecepcion(ambiente: SriAmbiente, envelope: string): Promise<string> {
  return postSoap(SRI_ENDPOINTS[ambiente].recepcion, envelope);
}

export async function sendAutorizacion(ambiente: SriAmbiente, envelope: string): Promise<string> {
  return postSoap(SRI_ENDPOINTS[ambiente].autorizacion, envelope);
}
