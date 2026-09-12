import axios from 'axios';

// Portal tiene su propio cliente con header de token separado
const portalClient = axios.create({ baseURL: '/api/portal' });

portalClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('portalToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const portalApi = {
  login: (email: string, password: string) =>
    portalClient.post('/auth/login', { email, password }),

  getRFQs: () => portalClient.get('/rfqs'),

  submitQuotation: (requisitionId: string, data: {
    notes?: string;
    validUntil?: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number; deliveryDays?: number; notes?: string }>;
  }) => portalClient.post(`/rfqs/${requisitionId}/quote`, data),

  getMyQuotations: () => portalClient.get('/quotes'),
  getMyOrders: () => portalClient.get('/orders'),
};
