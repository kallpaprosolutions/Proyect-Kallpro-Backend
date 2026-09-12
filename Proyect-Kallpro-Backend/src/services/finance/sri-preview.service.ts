/**
 * Etapa 2 del plan SRI: prueba end-to-end de "armar XML + firmar" con el certificado real de
 * la empresa, SIN enviar nada al SRI (eso es Etapa 3) y SIN tocar ningún `Invoice` real (esa
 * integración es Etapa 3 también — aquí se usa una factura de ejemplo fija a propósito, para
 * no mezclar datos de negocio reales con una prueba técnica del certificado/firma).
 */
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { getNextDocumentNumber } from '../../utils/sequence.helper';
import { buildClaveAcceso, randomCodigoNumerico } from './engines/clave-acceso.engine';
import { buildFacturaXml } from './engines/factura-xml.engine';
import { signComprobante, describeSigningError } from './engines/xml-signer.engine';
import { getActiveCertificateForSigning } from './fiscal-config.service';

export interface SignedPreviewResult {
  claveAcceso: string;
  secuencial: string;
  unsignedXml: string;
  signedXml: string;
}

export async function previewSignedTestFactura(
  companyId: string,
  establishmentId: string,
  emissionPointId: string,
): Promise<SignedPreviewResult> {
  const config = await prisma.companyFiscalConfig.findUnique({ where: { companyId } });
  if (!config) throw AppError.badRequest('Configura primero los datos fiscales de la empresa', 'FISCAL_CONFIG_MISSING');

  // Nunca se prueba (ni se consume un secuencial) contra Producción — la prueba de firma es
  // deliberadamente exclusiva del ambiente de certificación.
  if (config.ambiente !== 'PRUEBAS') {
    throw AppError.badRequest(
      'La prueba de firma solo está disponible en ambiente PRUEBAS (evita consumir secuenciales reales de Producción)',
      'PREVIEW_ONLY_IN_PRUEBAS',
    );
  }

  const point = await prisma.emissionPoint.findFirst({
    where: { id: emissionPointId, establishmentId, active: true, establishment: { fiscalConfigId: config.id, active: true } },
    include: { establishment: true },
  });
  if (!point) throw AppError.notFound('Punto de emisión no encontrado o inactivo');

  const cert = await getActiveCertificateForSigning(companyId);
  if (!cert) throw AppError.badRequest('No hay un certificado de firma electrónica activo', 'NO_ACTIVE_CERTIFICATE');

  // Mismo mecanismo atómico que el resto del ERP (regla 1): un contador propio por punto de
  // emisión, separado del que usará la emisión real (Etapa 3) para no mezclar secuenciales de
  // prueba con secuenciales que si se llegan a enviar de verdad.
  const docType = `SRI_TEST_FACTURA_${point.establishment.code}_${point.code}`;
  const secuencial = await prisma.$transaction((tx) => getNextDocumentNumber(tx, companyId, docType, '', 9));

  const fechaEmision = new Date();
  const claveAcceso = buildClaveAcceso({
    fechaEmision,
    tipoComprobante: 'FACTURA',
    ruc: config.ruc,
    ambiente: 'PRUEBAS',
    estab: point.establishment.code,
    ptoEmi: point.code,
    secuencial,
    codigoNumerico: randomCodigoNumerico(),
  });

  const unsignedXml = buildFacturaXml({
    ambiente: 'PRUEBAS',
    claveAcceso,
    emisor: {
      ruc: config.ruc,
      razonSocial: config.razonSocial,
      nombreComercial: config.nombreComercial ?? undefined,
      dirMatriz: point.establishment.address,
      dirEstablecimiento: point.establishment.address,
      obligadoContabilidad: config.obligadoContabilidad,
      contribuyenteEspecial: config.contribuyenteEspecial ?? undefined,
    },
    estab: point.establishment.code,
    ptoEmi: point.code,
    secuencial,
    fechaEmision,
    comprador: { tipoIdentificacion: 'CONSUMIDOR_FINAL', identificacion: '9999999999999', razonSocial: 'CONSUMIDOR FINAL' },
    items: [{
      codigoPrincipal: 'TEST-001',
      descripcion: 'Ítem de prueba — comprobante NO válido para presentar al SRI',
      cantidad: 1,
      precioUnitario: 1,
      ivaCodigo: '15',
    }],
    infoAdicional: { Nota: 'Comprobante de PRUEBA generado por KallpaPro para validar firma electrónica — no enviado al SRI' },
  });

  let signedXml: string;
  try {
    signedXml = signComprobante('FACTURA', unsignedXml, cert.fileBuffer, cert.password);
  } catch (e) {
    throw AppError.badRequest(describeSigningError(e), 'SIGNING_FAILED');
  }

  return { claveAcceso, secuencial, unsignedXml, signedXml };
}
