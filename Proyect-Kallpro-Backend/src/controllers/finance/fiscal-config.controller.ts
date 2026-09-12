import { AuthRequest } from '../../types/index';
import * as svc from '../../services/finance/fiscal-config.service';
import { previewSignedTestFactura } from '../../services/finance/sri-preview.service';
import { asyncHandler } from '../../middleware/error-handler';
import { AppError } from '../../utils/errors';

export const getFiscalConfig = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await svc.getFiscalConfig(req.user!.companyId));
});

export const upsertFiscalConfig = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await svc.upsertFiscalConfig(req.user!.companyId, req.body));
});

export const setAmbiente = asyncHandler(async (req: AuthRequest, res) => {
  const { ambiente } = req.body as { ambiente: 'PRUEBAS' | 'PRODUCCION' };
  res.json(await svc.setAmbiente(req.user!.companyId, ambiente));
});

export const getProductionChecklist = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await svc.getProductionChecklist(req.user!.companyId));
});

export const setTipoEmision = asyncHandler(async (req: AuthRequest, res) => {
  const { tipoEmision } = req.body as { tipoEmision: 'NORMAL' | 'CONTINGENCIA' };
  res.json(await svc.setTipoEmision(req.user!.companyId, tipoEmision));
});

export const createEstablishment = asyncHandler(async (req: AuthRequest, res) => {
  res.status(201).json(await svc.createEstablishment(req.user!.companyId, req.body));
});

export const updateEstablishment = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await svc.updateEstablishment(req.user!.companyId, req.params.id, req.body));
});

export const createEmissionPoint = asyncHandler(async (req: AuthRequest, res) => {
  res.status(201).json(await svc.createEmissionPoint(req.user!.companyId, req.params.establishmentId, req.body));
});

export const updateEmissionPoint = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await svc.updateEmissionPoint(req.user!.companyId, req.params.id, req.body));
});

export const listCertificates = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await svc.listCertificates(req.user!.companyId));
});

export const uploadCertificate = asyncHandler(async (req: AuthRequest, res) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  const { alias, password } = req.body as { alias?: string; password?: string };
  if (!file) throw AppError.badRequest('Sube el archivo .p12/.pfx del certificado', 'MISSING_CERT_FILE');
  if (!password) throw AppError.badRequest('La contraseña del certificado es obligatoria', 'MISSING_CERT_PASSWORD');
  res.status(201).json(await svc.uploadCertificate(req.user!.companyId, {
    alias: alias || file.originalname,
    fileBuffer: file.buffer,
    password,
  }));
});

export const deactivateCertificate = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await svc.deactivateCertificate(req.user!.companyId, req.params.id));
});

// ── Etapa 2: prueba de armado de XML + firma (sin enviar nada al SRI) ──
export const previewSignedTest = asyncHandler(async (req: AuthRequest, res) => {
  const { establishmentId, emissionPointId } = req.body as { establishmentId?: string; emissionPointId?: string };
  if (!establishmentId || !emissionPointId) {
    throw AppError.badRequest('Selecciona un establecimiento y un punto de emisión', 'MISSING_EMISSION_POINT');
  }
  res.json(await previewSignedTestFactura(req.user!.companyId, establishmentId, emissionPointId));
});
