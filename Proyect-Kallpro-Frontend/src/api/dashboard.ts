import client from './client';

export const dashboardApi = {
  getExecutive: () => client.get('/dashboard'),
  getHomeSummary: () => client.get('/dashboard/home-summary'),
};
