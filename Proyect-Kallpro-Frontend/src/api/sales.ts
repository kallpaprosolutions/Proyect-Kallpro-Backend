import api from './client';

export const salesApi = {
  // KPIs
  getKPIs: () => api.get('/sales/kpis'),

  // Customers
  getCustomers: () => api.get('/sales/customers'),
  getCustomer: (id: string) => api.get(`/sales/customers/${id}`),
  createCustomer: (data: any) => api.post('/sales/customers', data),
  updateCustomer: (id: string, data: any) => api.put(`/sales/customers/${id}`, data),

  // Quotations
  getQuotations: () => api.get('/sales/quotations'),
  getQuotation: (id: string) => api.get(`/sales/quotations/${id}`),
  createQuotation: (data: any) => api.post('/sales/quotations', data),
  updateQuotationStatus: (id: string, status: string) => api.patch(`/sales/quotations/${id}/status`, { status }),
  convertQuotation: (id: string) => api.post(`/sales/quotations/${id}/convert`),
  // Aprobación de descuento fuera de tope / venta bajo costo (estado PENDING_APPROVAL)
  approveQuotation: (id: string) => api.post(`/sales/quotations/${id}/approve`),
  rejectQuotation: (id: string, reason: string) => api.post(`/sales/quotations/${id}/reject`, { reason }),

  // Sales Orders
  getOrders: () => api.get('/sales/orders'),
  getOrder: (id: string) => api.get(`/sales/orders/${id}`),
  createOrder: (data: any) => api.post('/sales/orders', data),
  confirmOrder: (id: string) => api.post(`/sales/orders/${id}/confirm`),
  approveOrder: (id: string) => api.post(`/sales/orders/${id}/approve`),
  rejectOrder: (id: string, reason: string) => api.post(`/sales/orders/${id}/reject`, { reason }),
  // Sin `items` → despacha todo lo pendiente. Con `items` → despacho parcial.
  dispatchOrder: (id: string, items?: Array<{ salesOrderItemId: string; quantity: number }>) =>
    api.post(`/sales/orders/${id}/dispatch`, items && items.length ? { items } : {}),

  // Preview de retenciones del pedido (neto a cobrar antes de facturar)
  getWithholdingPreview: (id: string) => api.get(`/sales/orders/${id}/withholding-preview`),
};
