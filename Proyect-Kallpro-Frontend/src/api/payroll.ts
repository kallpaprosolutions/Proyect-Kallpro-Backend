import client from './client';
const api = client;

export interface EmployeePayload {
  cedula: string; firstName: string; lastName: string;
  email?: string; phone?: string; departmentId?: string | null;
  position: string; category: 'JEFATURA' | 'ASISTENTE' | 'SERVICIOS';
  baseSalary: number; hireDate: string;
  monthlyThirteenth?: boolean; monthlyFourteenth?: boolean; reserveFundsToIESS?: boolean;
  familyBurdens?: number; projectedPersonalExpenses?: number; bankAccount?: string;
  managerId?: string | null;
  userId?: string | null;
}

export const payrollApi = {
  getConfig: () => api.get('/payroll/config'),

  // Organigrama (TTHH tiene acceso aquí sin ver el resto de nómina)
  getOrgChart: () => api.get('/payroll/org-chart'),
  reassignManager: (id: string, managerId: string | null) => api.put(`/payroll/org-chart/${id}`, { managerId }),

  // Empleados
  getEmployees: (all = false) => api.get('/payroll/employees', { params: all ? { all: '1' } : {} }),
  createEmployee: (data: EmployeePayload) => api.post('/payroll/employees', data),
  updateEmployee: (id: string, data: Partial<EmployeePayload> & { isActive?: boolean }) =>
    api.put(`/payroll/employees/${id}`, data),
  getLinkableUsers: () => api.get('/payroll/employees/linkable-users'),

  // Períodos y rol de pagos
  getPeriods: () => api.get('/payroll/periods'),
  getPeriod: (id: string) => api.get(`/payroll/periods/${id}`),
  generate: (year: number, month: number) => api.post('/payroll/generate', { year, month }),
  postPeriod: (id: string) => api.post(`/payroll/periods/${id}/post`),
  payPeriod: (id: string) => api.post(`/payroll/periods/${id}/pay`),

  // Novedades
  addNovelty: (data: { periodId: string; employeeId: string; type: string; hours?: number; amount?: number; notes?: string }) =>
    api.post('/payroll/novelties', data),
  deleteNovelty: (id: string) => api.delete(`/payroll/novelties/${id}`),

  // Participación de utilidades (15%, art. 97 CT) — solo cálculo
  getUtilidades: (year: number, profit: number) => api.get('/payroll/utilidades', { params: { year, profit } }),

  // Departamentos (se reutiliza el catálogo del módulo de presupuestos)
  getDepartments: () => api.get('/budget/departments'),
  createDepartment: (data: { name: string; code?: string }) => api.post('/budget/departments', data),
};
