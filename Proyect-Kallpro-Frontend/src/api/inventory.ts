import client from './client';
const api = client;

export const inventoryApi = {
  getKPIs: () => api.get('/inventory/kpis'),
  getCategories: () => api.get('/inventory/categories'),
  createCategory: (data: any) => api.post('/inventory/categories', data),
  updateCategory: (id: string, data: any) => api.put(`/inventory/categories/${id}`, data),
  getWarehouses: () => api.get('/inventory/warehouses'),
  getWarehouseTree: () => api.get('/inventory/warehouses/tree'),
  createWarehouse: (data: any) => api.post('/inventory/warehouses', data),
  updateWarehouse: (id: string, data: any) => api.put(`/inventory/warehouses/${id}`, data),
  toggleWarehouse: (id: string) => api.patch(`/inventory/warehouses/${id}/toggle`),

  // Ubicaciones físicas (layout: zona/percha/piso)
  getLocations: (warehouseId?: string) =>
    api.get('/inventory/locations', { params: warehouseId ? { warehouseId } : {} }),
  createLocation: (data: { warehouseId: string; zone?: string; rack?: string; level?: string; description?: string }) =>
    api.post('/inventory/locations', data),
  updateLocation: (id: string, data: any) => api.put(`/inventory/locations/${id}`, data),
  deleteLocation: (id: string) => api.delete(`/inventory/locations/${id}`),
  reclassifyProduct: (id: string, categoryId: string) => api.patch(`/inventory/products/${id}/reclassify`, { categoryId }),
  getProducts: () => api.get('/inventory/products'),
  searchProducts: (q: string, limit = 20) => api.get('/inventory/products/search', { params: { q, limit } }),
  getProduct: (id: string) => api.get(`/inventory/products/${id}`),
  createProduct: (data: any) => api.post('/inventory/products', data),
  updateProduct: (id: string, data: any) => api.put(`/inventory/products/${id}`, data),

  // Lookups rápidos por escaneo
  getProductByBarcode: (code: string) => api.get(`/inventory/products/by-barcode/${encodeURIComponent(code)}`),
  getProductBySku:     (code: string) => api.get(`/inventory/products/by-sku/${encodeURIComponent(code)}`),

  // Imagen del producto
  uploadProductImage: (id: string, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.post(`/inventory/products/${id}/image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteProductImage: (id: string) => api.delete(`/inventory/products/${id}/image`),
  registerMovement: (data: any) => api.post('/inventory/movements', data),

  // Ajustes de inventario con doble autorización (solicitar → aprobar/rechazar)
  getAdjustments: (status?: string) =>
    api.get('/inventory/adjustments', { params: status ? { status } : {} }),
  createAdjustment: (data: {
    productId: string;
    warehouseId: string;
    type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
    quantity: number;
    unitCost?: number;
    reason: string;
    notes?: string;
  }) => api.post('/inventory/adjustments', data),
  approveAdjustment: (id: string) => api.post(`/inventory/adjustments/${id}/approve`),
  rejectAdjustment: (id: string, reason: string) =>
    api.post(`/inventory/adjustments/${id}/reject`, { reason }),
  getKardex: (productId: string, warehouseId?: string) =>
    api.get(`/inventory/kardex/${productId}`, { params: warehouseId ? { warehouseId } : {} }),
  /** Un movimiento individual (trazabilidad — link "Ver movimiento" desde Ajustes) */
  getMovement: (id: string) => api.get(`/inventory/movements/${id}`),
  getFifoBatches: (productId: string) => api.get(`/inventory/fifo-batches/${productId}`),
  updateValuation: (id: string, data: { valuationMethod: string; standardCost?: number }) =>
    api.patch(`/inventory/products/${id}/valuation`, data),
  getValuationComparison: (id: string) => api.get(`/inventory/products/${id}/valuation-comparison`),
  /** Valorización contable del inventario (totales, por bodega/categoría, conciliación con el mayor) */
  getInventoryValuation: (params?: { warehouseId?: string; categoryId?: string }) =>
    api.get('/inventory/valuation', { params }),

  // Transferencias entre bodegas
  transferStock: (data: {
    fromWarehouseId: string;
    toWarehouseId: string;
    productId: string;
    quantity: number;
    notes?: string;
  }) => api.post('/inventory/transfer', data),

  // Chequeo blando de disponibilidad (advierte sin bloquear, para cotización/pedido DRAFT)
  checkStock: (items: Array<{ productId: string; warehouseId?: string | null; quantity: number }>) =>
    api.post('/inventory/stock-check', { items }),

  // Reservas
  reserveStock: (data: { productId: string; warehouseId: string; quantity: number; reference: string }) =>
    api.post('/inventory/reserve', data),
  releaseReservation: (data: { productId: string; warehouseId: string; quantity: number; reference: string }) =>
    api.post('/inventory/release-reservation', data),

  // Reorden inteligente
  getReorderSuggestions: () => api.get('/inventory/reorder-suggestions'),

  // C1 — Reabastecimiento entre bodegas (por producto-bodega, con traslado o requisición sugerida)
  getReplenishmentSuggestions: () => api.get('/inventory/replenishment-suggestions'),
  applySuggestedTransfer: (productId: string, warehouseId: string) =>
    api.post(`/inventory/replenishment-suggestions/${productId}/${warehouseId}/transfer`),
  applySuggestedRequisition: (productId: string, warehouseId: string) =>
    api.post(`/inventory/replenishment-suggestions/${productId}/${warehouseId}/requisition`),
  snoozeReplenishment: (productId: string, warehouseId: string, days = 7) =>
    api.post(`/inventory/replenishment-suggestions/${productId}/${warehouseId}/snooze`, { days }),
  updateStockThresholds: (productId: string, warehouseId: string, data: { minStock: number | null; maxStock: number | null }) =>
    api.patch(`/inventory/products/${productId}/stock/${warehouseId}/thresholds`, data),

  // C2 — Panel de operaciones de inventario (recepciones/expediciones/traslados por bodega)
  getOperationsPanel: () => api.get('/inventory/operations-panel'),

  // Lotes próximos a vencer
  getBatchesNearExpiry: (days?: number) =>
    api.get('/inventory/batches/near-expiry', { params: days ? { days } : {} }),

  // Analytics avanzados
  getAnalytics: (days?: number) =>
    api.get('/inventory/analytics', { params: days ? { days } : {} }),

  // Pronóstico de demanda (top vendidos) y tendencia de rotación por producto
  getDemandForecast: (months?: number, top?: number) =>
    api.get('/inventory/demand-forecast', { params: { ...(months ? { months } : {}), ...(top ? { top } : {}) } }),
  getRotationTrend: (months?: number) =>
    api.get('/inventory/rotation-trend', { params: months ? { months } : {} }),

  // Conteo físico
  getPhysicalCounts: (warehouseId?: string) =>
    api.get('/inventory/physical-counts', { params: warehouseId ? { warehouseId } : {} }),
  startPhysicalCount: (data: { warehouseId: string; notes?: string }) =>
    api.post('/inventory/physical-count/start', data),
  addPhysicalCountItems: (countId: string, items: Array<{ productId: string; physicalQty: number }>) =>
    api.post(`/inventory/physical-count/${countId}/items`, { items }),
  finalizePhysicalCount: (countId: string) =>
    api.post(`/inventory/physical-count/${countId}/finalize`),
};
