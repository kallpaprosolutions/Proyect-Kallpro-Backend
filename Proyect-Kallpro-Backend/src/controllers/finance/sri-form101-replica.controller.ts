import { AuthRequest } from '../../types/index';
import { asyncHandler } from '../../middleware/error-handler';
import { AppError } from '../../utils/errors';
import * as svc from '../../services/finance/sri-form101-replica.service';
import { FORM101_CASILLAS, FORM101_DEFAULT_RATES } from '../../services/finance/engines/sri-form101-official.engine';

const cid = (req: AuthRequest) => req.user!.companyId;

export const getLayout = asyncHandler(async (_req: AuthRequest, res) => {
  res.json(FORM101_CASILLAS);
});

export const getMappings = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await svc.getCasillaMappings(cid(req)));
});

export const saveMapping = asyncHandler(async (req: AuthRequest, res) => {
  const { casillaCode, accounts } = req.body ?? {};
  if (!casillaCode) throw AppError.badRequest('Indica la casilla', 'VALIDATION');
  try {
    res.json(await svc.upsertCasillaMapping(cid(req), String(casillaCode), Array.isArray(accounts) ? accounts : []));
  } catch (e: any) {
    if (e?.message?.startsWith('VALIDATION:')) throw AppError.badRequest(e.message.replace('VALIDATION: ', ''), 'VALIDATION');
    throw e;
  }
});

export const deleteMapping = asyncHandler(async (req: AuthRequest, res) => {
  await svc.clearCasillaMapping(cid(req), req.params.casillaCode);
  res.status(204).send();
});

export const getReplica = asyncHandler(async (req: AuthRequest, res) => {
  const period = String(req.query.period ?? '');
  if (!/^\d{4}$/.test(period)) throw AppError.badRequest('Indica el ejercicio fiscal (AAAA)', 'VALIDATION');
  // El frontend ya envía fracción decimal (0.25), no puntos porcentuales — no volver a dividir /100.
  const tarifaGeneral = req.query.tarifaGeneral !== undefined ? Number(req.query.tarifaGeneral) : FORM101_DEFAULT_RATES.tarifaGeneral;
  const tarifaReinversion = req.query.tarifaReinversion !== undefined ? Number(req.query.tarifaReinversion) : tarifaGeneral;
  res.json(await svc.computeForm101Replica(cid(req), period, { tarifaGeneral, tarifaReinversion }));
});

export const saveOverride = asyncHandler(async (req: AuthRequest, res) => {
  const { period, casillaCode, value } = req.body ?? {};
  if (!/^\d{4}$/.test(String(period))) throw AppError.badRequest('Indica el ejercicio fiscal (AAAA)', 'VALIDATION');
  if (!casillaCode || !Number.isFinite(Number(value))) throw AppError.badRequest('Indica la casilla y un valor numérico', 'VALIDATION');
  try {
    res.json(await svc.setCasillaOverride(cid(req), String(period), String(casillaCode), Number(value), req.user!.userId));
  } catch (e: any) {
    if (e?.message?.startsWith('VALIDATION:')) throw AppError.badRequest(e.message.replace('VALIDATION: ', ''), 'VALIDATION');
    throw e;
  }
});

export const deleteOverride = asyncHandler(async (req: AuthRequest, res) => {
  const period = String(req.query.period ?? '');
  if (!/^\d{4}$/.test(period)) throw AppError.badRequest('Indica el ejercicio fiscal (AAAA)', 'VALIDATION');
  await svc.clearCasillaOverride(cid(req), period, req.params.casillaCode);
  res.status(204).send();
});
