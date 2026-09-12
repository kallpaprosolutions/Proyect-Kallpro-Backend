import client from './client';

export const productionApi = {
  // BOM
  listBOMs: () => client.get('/production/bom'),
  getBOM: (id: string) => client.get(`/production/bom/${id}`),
  createBOM: (data: any) => client.post('/production/bom', data),
  updateBOM: (id: string, data: any) => client.put(`/production/bom/${id}`, data),

  // Orders
  listOrders: (status?: string) =>
    client.get('/production/orders', { params: status ? { status } : {} }),
  getOrder: (id: string) => client.get(`/production/orders/${id}`),
  createOrder: (data: any) => client.post('/production/orders', data),
  startOrder: (id: string) => client.patch(`/production/orders/${id}/start`),
  completeOrder: (id: string) => client.patch(`/production/orders/${id}/complete`),
  cancelOrder: (id: string) => client.patch(`/production/orders/${id}/cancel`),

  // MRP
  getMRPRequirements: (productId: string, quantity: number, warehouseId?: string) =>
    client.get('/production/mrp', { params: { productId, quantity, warehouseId } }),

  // ── Calidad (Sprint 12 — ISO 9001 · ISO 22000 · ARCSA) ──
  listParameters: (productId?: string) =>
    client.get('/production/quality/parameters', { params: productId ? { productId } : {} }),
  createParameter: (data: any) => client.post('/production/quality/parameters', data),
  updateParameter: (id: string, data: any) => client.put(`/production/quality/parameters/${id}`, data),
  deleteParameter: (id: string) => client.delete(`/production/quality/parameters/${id}`),

  listInspections: (params?: { productionOrderId?: string; status?: string }) =>
    client.get('/production/quality/inspections', { params: params ?? {} }),
  getInspection: (id: string) => client.get(`/production/quality/inspections/${id}`),
  createInspection: (data: any) => client.post('/production/quality/inspections', data),

  releaseLot: (orderId: string, approve: boolean, notes?: string) =>
    client.patch(`/production/orders/${orderId}/release`, { approve, notes }),
  getTraceability: (orderId: string) => client.get(`/production/orders/${orderId}/traceability`),

  listNonConformities: (params?: { status?: string; severity?: string; productionOrderId?: string }) =>
    client.get('/production/quality/non-conformities', { params: params ?? {} }),
  getNonConformity: (id: string) => client.get(`/production/quality/non-conformities/${id}`),
  createNonConformity: (data: any) => client.post('/production/quality/non-conformities', data),
  updateNonConformity: (id: string, data: any) =>
    client.patch(`/production/quality/non-conformities/${id}`, data),

  getQualityKPIs: () => client.get('/production/quality/kpis'),
};

// ─── Etiquetas en español (regla 7: la UI nunca muestra el enum crudo) ───
export const QUALITY_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDING:    { label: 'Sin producir',  className: 'bg-surface-100 dark:bg-surface-700 text-surface-500' },
  QUARANTINE: { label: '🔒 En cuarentena', className: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
  RELEASED:   { label: '✓ Liberado',    className: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
  REJECTED:   { label: '✕ Rechazado',   className: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' },
};

export const NC_LABELS = {
  source: {
    PRODUCTION: 'Producción', INSPECTION: 'Inspección de calidad',
    CUSTOMER_COMPLAINT: 'Reclamo de cliente', AUDIT: 'Auditoría', SUPPLIER: 'Proveedor',
  } as Record<string, string>,
  severity: { MINOR: 'Menor', MAJOR: 'Mayor', CRITICAL: 'Crítica' } as Record<string, string>,
  disposition: {
    REWORK: 'Reproceso', SCRAP: 'Desecho', CONCESSION: 'Concesión', RETURN: 'Devolución',
  } as Record<string, string>,
  status: {
    OPEN: 'Abierta', IN_PROGRESS: 'En tratamiento', VERIFICATION: 'Verificando eficacia', CLOSED: 'Cerrada',
  } as Record<string, string>,
};
