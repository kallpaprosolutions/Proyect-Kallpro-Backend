import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';
import { globalSearch } from '../services/search.service';
import { getSmartButtons, SmartButtonEntity } from '../services/smart-buttons.service';

/**
 * GET /api/search?q=texto — búsqueda global federada (mejora A1).
 * Busca en clientes, proveedores, productos, OC, facturas, pedidos y requisiciones
 * de la empresa del usuario autenticado.
 */
export const search = asyncHandler(async (req: AuthRequest, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const data = await globalSearch(req.user!.companyId, q);
  res.json(data);
});

const SMART_BUTTON_ENTITIES: SmartButtonEntity[] = ['PURCHASE_ORDER', 'SALES_ORDER', 'INVOICE'];

/**
 * GET /api/search/related/:entityType/:entityId — smart buttons (mejora A4).
 * Contadores + documentos vinculados (asientos, pagos, envíos, facturas,
 * retenciones, NC) para el header del detalle de OC / pedido / factura.
 */
export const relatedDocs = asyncHandler(async (req: AuthRequest, res) => {
  const { entityType, entityId } = req.params;
  if (!SMART_BUTTON_ENTITIES.includes(entityType as SmartButtonEntity)) {
    throw AppError.badRequest(`entityType no soportado: ${entityType}`, 'UNSUPPORTED_ENTITY_TYPE');
  }
  const buttons = await getSmartButtons(req.user!.companyId, entityType as SmartButtonEntity, entityId);
  res.json({ buttons });
});
