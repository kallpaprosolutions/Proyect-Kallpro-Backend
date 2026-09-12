import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { handleCarrierWebhook } from '../services/logistics-webhook.service';

/**
 * Entrada PÚBLICA para couriers (sin JWT: el courier no es un usuario del ERP). Se autentica
 * con el token por empresa (header X-Webhook-Token, o ?token= para couriers que no permiten
 * headers custom). Montado ANTES de /api/logistics para que no lo tape el authMiddleware.
 */
const router = Router();

router.post('/:companyId/:carrier', asyncHandler(async (req, res) => {
  const token = (req.header('x-webhook-token') || (req.query.token as string | undefined)) ?? undefined;
  const outcome = await handleCarrierWebhook(req.params.companyId, req.params.carrier, token, req.body);
  // 200 aunque no se acepte: los couriers reintentan agresivamente ante 4xx/5xx y el motivo ya quedó en el log.
  res.status(200).json(outcome);
}));

export default router;
