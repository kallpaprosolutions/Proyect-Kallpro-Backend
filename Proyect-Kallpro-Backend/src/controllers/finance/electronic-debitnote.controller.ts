import { AuthRequest } from '../../types/index';
import * as svc from '../../services/finance/electronic-debitnote.service';
import { asyncHandler } from '../../middleware/error-handler';
import { AppError } from '../../utils/errors';

export const emit = asyncHandler(async (req: AuthRequest, res) => {
  const { establishmentId, emissionPointId } = req.body as { establishmentId?: string; emissionPointId?: string };
  if (!establishmentId || !emissionPointId) {
    throw AppError.badRequest('Selecciona un establecimiento y un punto de emisión', 'MISSING_EMISSION_POINT');
  }
  res.json(await svc.emitDebitNote(req.user!.companyId, req.params.id, { establishmentId, emissionPointId }, req.user!.userId));
});

export const checkAuthorization = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await svc.checkDebitNoteAuthorization(req.user!.companyId, req.params.id, req.user!.userId));
});

export const status = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await svc.getDebitNoteSriStatus(req.user!.companyId, req.params.id));
});

export const downloadXml = asyncHandler(async (req: AuthRequest, res) => {
  const { filename, xml } = await svc.getDebitNoteSriXml(req.user!.companyId, req.params.id);
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(xml);
});
