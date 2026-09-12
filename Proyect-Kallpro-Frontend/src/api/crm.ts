import client from './client';

export const crmApi = {
  // ── Dashboard ────────────────────────────────────────────────────────────────
  getDashboard: () => client.get('/crm/dashboard'),

  // ── Contacts ─────────────────────────────────────────────────────────────────
  listContacts: (params?: { search?: string; assignedTo?: string; limit?: number; offset?: number }) =>
    client.get('/crm/contacts', { params }),
  getContact: (id: string) => client.get(`/crm/contacts/${id}`),
  createContact: (data: any) => client.post('/crm/contacts', data),
  updateContact: (id: string, data: any) => client.patch(`/crm/contacts/${id}`, data),

  // ── Companies ────────────────────────────────────────────────────────────────
  listCompanies: (params?: { search?: string; sector?: string; limit?: number; offset?: number }) =>
    client.get('/crm/companies', { params }),
  getCompany: (id: string) => client.get(`/crm/companies/${id}`),
  createCompany: (data: any) => client.post('/crm/companies', data),
  updateCompany: (id: string, data: any) => client.patch(`/crm/companies/${id}`, data),
  validateRUC: (ruc: string) => client.post('/crm/companies/validate-ruc', { ruc }),

  // ── Deals ────────────────────────────────────────────────────────────────────
  listDeals: (params?: { stage?: string; contactId?: string; assignedTo?: string; limit?: number }) =>
    client.get('/crm/deals', { params }),
  getDeal: (id: string) => client.get(`/crm/deals/${id}`),
  createDeal: (data: any) => client.post('/crm/deals', data),
  updateDeal: (id: string, data: any) => client.patch(`/crm/deals/${id}`, data),
  updateDealStage: (id: string, stage: string) => client.patch(`/crm/deals/${id}/stage`, { stage }),
  getFunnelMetrics: () => client.get('/crm/deals/funnel'),
  // Puente CRM → Ventas: productos conversados y cotización generada al ganar
  getDealItems: (id: string) => client.get(`/crm/deals/${id}/items`),
  setDealItems: (id: string, items: Array<{ productId: string; description?: string | null; quantity: number; unitPrice: number }>) =>
    client.put(`/crm/deals/${id}/items`, { items }),
  generateQuotation: (id: string) => client.post(`/crm/deals/${id}/generate-quotation`),
  getDealsAtRisk: (days?: number) => client.get('/crm/deals/at-risk', { params: days ? { days } : {} }),

  // ── Conversations / Inbox ────────────────────────────────────────────────────
  listConversations: (params?: { status?: string; channel?: string; assignedTo?: string; limit?: number }) =>
    client.get('/crm/conversations', { params }),
  getThread: (id: string) => client.get(`/crm/conversations/${id}`),
  addMessage: (id: string, body: string, direction?: string, channel?: string) =>
    client.post(`/crm/conversations/${id}/messages`, { body, direction, channel }),
  updateConversationStatus: (id: string, status: string) =>
    client.patch(`/crm/conversations/${id}/status`, { status }),
  approveMessage: (conversationId: string, messageId: string) =>
    client.post(`/crm/conversations/${conversationId}/messages/${messageId}/approve`),

  // ── Agents ───────────────────────────────────────────────────────────────────
  listAgents: () => client.get('/crm/agents'),
  getAgentMetrics: (code: string) => client.get(`/crm/agents/${code}/metrics`),
  invokeAgent: (code: string, context: any) => client.post(`/crm/agents/${code}/invoke`, context),

  getAgentConfig: (code: string) => client.get(`/crm/agents/${code}/config`),
  updateAgent: (code: string, data: any) => client.patch(`/crm/agents/${code}`, data),

  // ── Forecast ─────────────────────────────────────────────────────────────────
  getForecast: (period?: string) => client.get('/crm/forecast', { params: period ? { period } : {} }),
  getMonthlyTrend: (months?: number) => client.get('/crm/forecast/trend', { params: months ? { months } : {} }),
  getForecastAccuracy: (period?: string) => client.get('/crm/forecast/accuracy', { params: period ? { period } : {} }),
  getVelocity: (months?: number) => client.get('/crm/forecast/velocity', { params: months ? { months } : {} }),
  getForecastByOwner: (period?: string) => client.get('/crm/forecast/by-owner', { params: period ? { period } : {} }),
  setQuota: (period: string, quotaUsd: number) => client.post('/crm/forecast/quota', { period, quotaUsd }),
  closePeriod: (period: string) => client.post('/crm/forecast/close-period', { period }),
  setDealCategory: (dealId: string, category: string) =>
    client.patch(`/crm/forecast/deals/${dealId}/category`, { category }),
  clearDealCategory: (dealId: string) => client.delete(`/crm/forecast/deals/${dealId}/category`),

  // ── Leads (Sprint 13) ────────────────────────────────────────────────────────
  listLeads: (params?: {
    status?: string; grade?: string; temperature?: string; source?: string;
    ownerUserId?: string; search?: string; onlyDuplicates?: boolean;
    minScore?: number; limit?: number; offset?: number; sortBy?: 'score' | 'createdAt';
  }) => client.get('/crm/leads', { params }),
  getLead: (id: string) => client.get(`/crm/leads/${id}`),
  createLead: (data: any) => client.post('/crm/leads', data),
  updateLead: (id: string, data: any) => client.patch(`/crm/leads/${id}`, data),
  getLeadStats: () => client.get('/crm/leads/stats'),
  getLeadCatalogs: () => client.get('/crm/leads/catalogs'),
  checkLeadDuplicate: (data: any) => client.post('/crm/leads/check-duplicate', data),
  rescoreLead: (id: string) => client.post(`/crm/leads/${id}/rescore`),
  rescoreAllLeads: () => client.post('/crm/leads/rescore-all'),
  assignLead: (id: string, ownerUserId?: string) => client.post(`/crm/leads/${id}/assign`, { ownerUserId }),
  registerLeadEvent: (id: string, eventType: string, channel?: string, metadata?: any) =>
    client.post(`/crm/leads/${id}/events`, { eventType, channel, metadata }),
  convertLead: (id: string, data: any = {}) => client.post(`/crm/leads/${id}/convert`, data),
  disqualifyLead: (id: string, reason: string) => client.post(`/crm/leads/${id}/disqualify`, { reason }),

  // ── Configuración editable del CRM (Sprint 13) ───────────────────────────────
  getConfigMeta: () => client.get('/crm/config/meta'),

  listStages: () => client.get('/crm/config/stages'),
  createStage: (data: any) => client.post('/crm/config/stages', data),
  updateStage: (id: string, data: any) => client.patch(`/crm/config/stages/${id}`, data),
  deleteStage: (id: string) => client.delete(`/crm/config/stages/${id}`),
  reorderStages: (order: Array<{ id: string; sequence: number }>) =>
    client.post('/crm/config/stages/reorder', { order }),

  getScoringConfig: () => client.get('/crm/config/scoring'),
  updateScoringConfig: (data: any) => client.patch('/crm/config/scoring', data),
  listScoringRules: () => client.get('/crm/config/scoring/rules'),
  createScoringRule: (data: any) => client.post('/crm/config/scoring/rules', data),
  updateScoringRule: (id: string, data: any) => client.patch(`/crm/config/scoring/rules/${id}`, data),
  deleteScoringRule: (id: string) => client.delete(`/crm/config/scoring/rules/${id}`),
  resetScoringRules: () => client.post('/crm/config/scoring/rules/reset'),

  listAssignmentRules: () => client.get('/crm/config/assignment-rules'),
  createAssignmentRule: (data: any) => client.post('/crm/config/assignment-rules', data),
  updateAssignmentRule: (id: string, data: any) => client.patch(`/crm/config/assignment-rules/${id}`, data),
  deleteAssignmentRule: (id: string) => client.delete(`/crm/config/assignment-rules/${id}`),

  listForms: () => client.get('/crm/config/forms'),
  getForm: (id: string) => client.get(`/crm/config/forms/${id}`),
  createForm: (data: any) => client.post('/crm/config/forms', data),
  updateForm: (id: string, data: any) => client.patch(`/crm/config/forms/${id}`, data),
  deleteForm: (id: string) => client.delete(`/crm/config/forms/${id}`),
  rotateFormKey: (id: string) => client.post(`/crm/config/forms/${id}/rotate-key`),
};
