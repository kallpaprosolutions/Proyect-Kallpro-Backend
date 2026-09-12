import { z } from 'zod';
import { AuthRequest } from '../types/index';
import * as svc from '../services/delivery-guide.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

export const deliveryGuideSchema = z.object({
  motivoTraslado: z.string().min(1),
  dirPartida: z.string().min(1),
  fechaIniTransporte: z.coerce.date(),
  fechaFinTransporte: z.coerce.date(),
  transportista: z.object({
    razonSocial: z.string().min(1),
    tipoIdentificacion: z.enum(['RUC', 'CEDULA', 'PASAPORTE']),
    identificacion: z.string().min(1),
    placa: z.string().min(1),
  }),
});

export const listForShipment = asyncHandler(async (req: AuthRequest, res) => {
  const data = await svc.getDeliveryGuidesForShipment(req.user!.companyId, req.params.id);
  res.json(data);
});

export const getOne = asyncHandler(async (req: AuthRequest, res) => {
  const guide = await svc.getDeliveryGuideById(req.user!.companyId, req.params.id);
  if (!guide) throw AppError.notFound('Guía de remisión no encontrada', 'DELIVERY_GUIDE_NOT_FOUND');
  res.json(guide);
});

export const create = asyncHandler(async (req: AuthRequest, res) => {
  const body = req.body as z.infer<typeof deliveryGuideSchema>;
  try {
    const guide = await svc.createDeliveryGuide(req.user!.companyId, req.params.id, body, req.user!.userId);
    res.status(201).json(guide);
  } catch (e: any) {
    switch (e?.message) {
      case 'SHIPMENT_NOT_FOUND': throw AppError.notFound('Envío no encontrado', 'SHIPMENT_NOT_FOUND');
      case 'SHIPMENT_NOT_SALES': throw AppError.badRequest('Solo se emiten guías de remisión para envíos de venta', 'SHIPMENT_NOT_SALES');
      case 'NO_ITEMS': throw AppError.badRequest('El envío no tiene ítems para trasladar', 'NO_ITEMS');
      default:
        if (typeof e?.message === 'string' && e.message.startsWith('VALIDATION: ')) {
          throw AppError.badRequest(e.message.replace('VALIDATION: ', ''), 'VALIDATION');
        }
        throw e;
    }
  }
});
