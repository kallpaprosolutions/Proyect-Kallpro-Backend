import client from './client';

export const budgetApi = {
  getDepartments: () => client.get('/budget/departments'),
  createDepartment: (data: { name: string; code?: string }) => client.post('/budget/departments', data),
  getBudgets: (year?: number, month?: number) =>
    client.get('/budget', { params: { year, month } }),
  upsertBudget: (data: any) => client.post('/budget', data),
  getSummary: (year?: number, month?: number) =>
    client.get('/budget/summary', { params: { year, month } }),
  checkBudget: (departmentId?: string, amount?: number) =>
    client.get('/budget/check', { params: { departmentId, amount } }),
  getWorksheet: (year?: number) => client.get('/budget/worksheet', { params: { year } }),
  bulkUpsert: (data: { departmentId?: string | null; year: number; months: number[] }) =>
    client.post('/budget/bulk', data),
};
