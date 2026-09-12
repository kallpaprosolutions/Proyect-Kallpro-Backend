import api from './client';

/** Catálogo de estados del tracking (espejo del backend logistics.service) */
export const SHIPMENT_STATUS_META: Record<string, { label: string; icon: string; tone: string }> = {
  PENDING:          { label: 'Pendiente',     icon: '📋', tone: 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300' },
  PICKED:           { label: 'Preparado',     icon: '📦', tone: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' },
  DISPATCHED:       { label: 'Despachado',    icon: '🚚', tone: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400' },
  IN_TRANSIT:       { label: 'En tránsito',   icon: '🛣️', tone: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-400' },
  OUT_FOR_DELIVERY: { label: 'En reparto',    icon: '🛵', tone: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' },
  DELIVERED:        { label: 'Entregado',     icon: '✅', tone: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' },
  FAILED:           { label: 'Fallido',       icon: '⚠️', tone: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' },
};

export const CARRIERS = ['SERVIENTREGA', 'TRAMACO', 'DHL', 'URBANO', 'PROPIO'];

export const logisticsApi = {
  getKpis: () => api.get('/logistics/kpis'),
  list: (params?: { orderType?: string; status?: string; q?: string }) =>
    api.get('/logistics/shipments', { params }),
  getOne: (id: string) => api.get(`/logistics/shipments/${id}`),
  byOrder: (orderType: 'SALES' | 'PURCHASE', orderId: string) =>
    api.get(`/logistics/by-order/${orderType}/${orderId}`),
  track: (trackingNumber: string) => api.get(`/logistics/track/${trackingNumber}`),
  create: (data: {
    orderType: 'SALES' | 'PURCHASE'; orderId: string; carrier?: string; carrierGuide?: string;
    destAddress?: string; recipientName?: string; recipientPhone?: string; estimatedDelivery?: string; freightCost?: number;
  }) => api.post('/logistics/shipments', data),
  addEvent: (id: string, data: { status: string; location?: string; notes?: string }) =>
    api.post(`/logistics/shipments/${id}/events`, data),
  // Webhooks de couriers (token por empresa)
  getWebhookInfo: () => api.get('/logistics/webhook-token'),
  rotateWebhookToken: () => api.post('/logistics/webhook-token/rotate'),

  // ── Guías de Remisión electrónicas (Etapa 4 del plan SRI, resto) ──
  getDeliveryGuides: (shipmentId: string) => api.get(`/logistics/shipments/${shipmentId}/delivery-guides`),
  createDeliveryGuide: (shipmentId: string, data: {
    motivoTraslado: string; dirPartida: string; fechaIniTransporte: string; fechaFinTransporte: string;
    transportista: { razonSocial: string; tipoIdentificacion: 'RUC' | 'CEDULA' | 'PASAPORTE'; identificacion: string; placa: string };
  }) => api.post(`/logistics/shipments/${shipmentId}/delivery-guides`, data),
  getDeliveryGuide: (id: string) => api.get(`/logistics/delivery-guides/${id}`),
};
