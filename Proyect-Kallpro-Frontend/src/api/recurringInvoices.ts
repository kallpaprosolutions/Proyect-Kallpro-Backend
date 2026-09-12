import api from './client';

export interface RecurringInvoiceTemplate {
  id: string;
  supplierId: string;
  supplier: { id: string; name: string; ruc: string | null };
  description: string;
  amount: number;
  taxCode: string;
  taxRate: number;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  lastGeneratedPeriod: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface RecurringInvoiceTemplateInput {
  supplierId: string;
  description: string;
  amount: number;
  taxCode: string;
  taxRate: number;
  dayOfMonth: number;
  startDate: string;
  endDate?: string | null;
  isActive?: boolean;
}

export interface GenerateDueResult {
  generated: Array<{ templateId: string; description: string; documentId: string }>;
  skipped: Array<{ templateId: string; description: string; reason: string }>;
}

export const recurringInvoicesApi = {
  list: () => api.get<RecurringInvoiceTemplate[]>('/financial/recurring-invoices'),
  get: (id: string) => api.get<RecurringInvoiceTemplate & { generatedDocuments: Array<{ id: string; numeroDoc: string | null; fechaEmision: string; total: number; status: string }> }>(`/financial/recurring-invoices/${id}`),
  create: (data: RecurringInvoiceTemplateInput) => api.post<RecurringInvoiceTemplate>('/financial/recurring-invoices', data),
  update: (id: string, data: Partial<RecurringInvoiceTemplateInput>) => api.put<RecurringInvoiceTemplate>(`/financial/recurring-invoices/${id}`, data),
  generateDue: () => api.post<GenerateDueResult>('/financial/recurring-invoices/generate-due'),
};
