import client from './client';

export const requisitionsApi = {
  getAll: (status?: string) => client.get('/requisitions', { params: status ? { status } : {} }),
  getOne: (id: string) => client.get(`/requisitions/${id}`),
  create: (data: any) => client.post('/requisitions', data),
  approve: (id: string, level: number, notes?: string) =>
    client.post(`/requisitions/${id}/approve`, { level, notes }),
  reject: (id: string, reason: string) => client.post(`/requisitions/${id}/reject`, { reason }),
  getQuotations: (id: string) => client.get(`/requisitions/${id}/quotations`),
  addQuotation: (id: string, data: any) => client.post(`/requisitions/${id}/quotations`, data),
  selectWinner: (id: string, quotationId: string, overrideReason?: string) =>
    client.post(`/requisitions/${id}/select-winner`, { quotationId, overrideReason }),

  // Evaluación ponderada (pesos)
  saveCriteria: (id: string, criteria: any[]) =>
    client.put(`/requisitions/${id}/criteria`, { criteria }),
  evaluate: (id: string) => client.post(`/requisitions/${id}/evaluate`),
  saveManualScores: (id: string, qid: string, manualScores: Record<string, number>, advanceRequiredPct?: number) =>
    client.put(`/requisitions/${id}/quotations/${qid}/manual-scores`, { manualScores, advanceRequiredPct }),
};
