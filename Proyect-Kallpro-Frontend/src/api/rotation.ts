import api from './client';

export const rotationApi = {
  getAnalysis:    () => api.get('/rotation/analysis'),
  getObsolescence:() => api.get('/rotation/obsolescence'),
  getTrend:       (months = 6) => api.get(`/rotation/trend?months=${months}`),
  getExpiring:    (days = 90)  => api.get(`/rotation/expiring?days=${days}`),
  getLots:        (productId: string) => api.get(`/rotation/lots/${productId}`),
};
