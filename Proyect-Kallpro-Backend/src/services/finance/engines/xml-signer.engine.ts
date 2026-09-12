/**
 * Firma XAdES-BES de comprobantes electrónicos SRI. Envoltorio delgado sobre la librería
 * MIT `ec-sri-invoice-signer` (implementación pura TS/JS, sin dependencia de Java) en vez de
 * reimplementar XAdES-BES a mano: la firma digital de un comprobante tributario real es
 * exactamente el tipo de criptografía donde un error propio y no probado contra el SRI real
 * sale carísimo (comprobantes rechazados en producción). La librería ya asume
 * `id="comprobante"` como id del nodo raíz — coincide con lo que arma
 * `factura-xml.engine.ts`.
 *
 * No toca BD ni red: recibe el XML sin firmar + los bytes del .p12 ya descifrados (ver
 * `fiscal-config.service.getActiveCertificateForSigning`) y devuelve el XML firmado. El envío
 * al SRI es responsabilidad de una etapa posterior (`sri-soap-client.ts`, Etapa 3).
 */
import {
  signInvoiceXml, signCreditNoteXml, signDebitNoteXml, signDeliveryGuideXml, signWithholdingCertificateXml,
  UnsuportedPkcs12Error, XmlFormatError, UnsupportedXmlFeatureError, UnsupportedDocumentTypeError,
} from 'ec-sri-invoice-signer';

export type TipoComprobanteFirma = 'FACTURA' | 'NOTA_CREDITO' | 'NOTA_DEBITO' | 'GUIA_REMISION' | 'RETENCION';

const SIGNERS: Record<TipoComprobanteFirma, typeof signInvoiceXml> = {
  FACTURA: signInvoiceXml,
  NOTA_CREDITO: signCreditNoteXml,
  NOTA_DEBITO: signDebitNoteXml,
  GUIA_REMISION: signDeliveryGuideXml,
  RETENCION: signWithholdingCertificateXml,
};

/**
 * Traduce los errores de la firma a mensajes aptos para el usuario (regla de negocio: el
 * `AppError` con código lo arma el llamador, esto solo normaliza el motivo). La librería no
 * envuelve TODOS los fallos de lectura del .p12 en `UnsuportedPkcs12Error` — node-forge, por
 * debajo, lanza directamente "PKCS#12 MAC could not be verified..." ante una contraseña
 * incorrecta — así que además de los tipos propios se reconoce ese mensaje por contenido.
 */
export function describeSigningError(e: unknown): string {
  if (e instanceof UnsuportedPkcs12Error) return 'El certificado .p12 no es compatible o la contraseña es incorrecta';
  if (e instanceof XmlFormatError) return 'El XML del comprobante no tiene un formato válido';
  if (e instanceof UnsupportedXmlFeatureError) return `El XML usa una característica no soportada para firmar: ${e.message}`;
  if (e instanceof UnsupportedDocumentTypeError) return 'Tipo de comprobante no reconocido para firmar';
  if (e instanceof Error && /pkcs12|mac could not be verified|invalid password/i.test(e.message)) {
    return 'El certificado .p12 no es compatible o la contraseña es incorrecta';
  }
  return e instanceof Error ? e.message : 'Error desconocido al firmar el comprobante';
}

/**
 * Firma un comprobante SIN enviarlo al SRI. `xmlSinFirmar` debe venir de
 * `factura-xml.engine.ts` (o su equivalente para NC/ND/guía/retención en etapas futuras):
 * mismo elemento raíz e `id="comprobante"` que la librería espera.
 */
export function signComprobante(
  tipo: TipoComprobanteFirma,
  xmlSinFirmar: string,
  p12Buffer: Buffer,
  p12Password: string,
): string {
  const signer = SIGNERS[tipo];
  return signer(xmlSinFirmar, p12Buffer, { pkcs12Password: p12Password });
}

/** Verificación estructural liviana (no criptográfica) para tests/diagnóstico: ¿el XML resultante trae el nodo de firma? */
export function looksSigned(xml: string): boolean {
  return xml.includes('<ds:Signature') && xml.includes('<ds:SignatureValue');
}
