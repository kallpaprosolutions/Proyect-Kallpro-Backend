import client from './client';
const api = client;

export interface OrdersQuery {
  status?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface ReceiveLine { itemId: string; quantity: number; }

export const purchasesApi = {
  getSuppliers: () => api.get('/purchases/suppliers'),
  getSupplier: (id: string) => api.get(`/purchases/suppliers/${id}`),
  createSupplier: (data: any) => api.post('/purchases/suppliers', data),
  updateSupplier: (id: string, data: any) => api.put(`/purchases/suppliers/${id}`, data),
  getOrders: (params?: OrdersQuery) => api.get('/purchases/orders', { params }),
  getOrder: (id: string) => api.get(`/purchases/orders/${id}`),
  createOrder: (data: any) => api.post('/purchases/orders', data),
  updateStatus: (id: string, status: string) => api.patch(`/purchases/orders/${id}/status`, { status }),
  submitOrder: (id: string) => api.post(`/purchases/orders/${id}/submit`),
  approveOrder: (id: string, level: number, notes?: string) =>
    api.post(`/purchases/orders/${id}/approve`, { level, notes }),
  rejectOrder: (id: string, reason: string) =>
    api.post(`/purchases/orders/${id}/reject`, { reason }),
  receiveOrder: (id: string, warehouseId: string, lines?: ReceiveLine[], conformity?: { qualityOk?: boolean; conformityNotes?: string }) =>
    api.post(`/purchases/orders/${id}/receive`, { warehouseId, lines, ...conformity }),
  payAdvance: (id: string) => api.post(`/purchases/orders/${id}/pay-advance`),
  payBalance: (id: string) => api.post(`/purchases/orders/${id}/pay-balance`),
};
