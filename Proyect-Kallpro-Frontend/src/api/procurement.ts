import api from './client';

export const procurementApi = {
  // Pipeline del flujo de compras (Hub guiado)
  getPipeline: () => api.get('/purchases/pipeline'),

  // Supplier scoring
  getSupplierRanking:       ()                     => api.get('/purchases/suppliers/ranking'),
  getSupplierPerformance:   (id: string)            => api.get(`/purchases/suppliers/${id}/performance`),
  recalculateScore:         (id: string)            => api.post(`/purchases/suppliers/${id}/recalculate-score`),

  // AI
  getSupplierRecommendation: (requisitionId: string) => api.post('/ai/supplier-recommendation', { requisitionId }),
  checkPriceAnomaly:         (data: { productId?: string; description?: string; unitPrice: number; supplierId?: string }) =>
    api.post('/ai/price-anomaly-check', data),
  getProcurementInsights:    ()                     => api.get('/ai/procurement-insights'),

  // 3-way match
  validateThreeWayMatch:     (sriDocId: string)     => api.post(`/sri/${sriDocId}/validate-match`),

  // KPIs
  getProcurementKPIs:        ()                     => api.get('/dashboard/procurement-kpis'),

  // Journal entries
  getJournalEntries:         (params?: Record<string, string>) => api.get('/financial/journal-entries', { params }),
  getJournalEntry:           (id: string)           => api.get(`/financial/journal-entries/${id}`),
  postJournalEntry:          (entityType: string, entityId: string) =>
    api.post(`/financial/journal-entries/${entityType}/${entityId}/post`),
};
