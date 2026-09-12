import client from './client';
const api = client;

export interface DunningStep { daysOverdue: number; type: 'EMAIL' | 'WHATSAPP' | 'CALL'; message: string }

export interface ErpSettings {
  purchases: { minQuotations: number };
  documents: { reqPrefix: string; poPrefix: string; adjPrefix: string };
  inventory: { requireAdjustmentApproval: boolean; enableCameraScanner: boolean };
  sales: {
    enforceCreditLimit: boolean;
    allowPartialDispatch: boolean;
    maxDiscountByRole: Record<string, number>;
    discountApproverRoles: string[];
  };
  security: { sessionTimeoutMinutes: number; require2FAForRoles: string[] };
  finance: {
    paymentResponsableLimit: number;
    paymentGerencialLimit: number;
    dunning: { enabled: boolean; pauseWhenPromise: boolean; steps: DunningStep[] };
  };
  logistics: { webhookToken: string };
  regional: { currencyCode: string; currencySymbol: string };
  company: { ruc: string; address: string; city: string; website: string };
}

export interface CompanySettings {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  industry?: string | null;
  isPublicEntity: boolean;
  aiEnabled: boolean;
  settings: ErpSettings;
  approvalMatrix: ApprovalMatrixLevel[];
}

export interface ApprovalMatrixLevel {
  id: string;
  level: number;
  label: string;
  minAmount: number;
  maxAmount?: number | null;
  approverRole: string;
}

export type CompanySettingsUpdate =
  Partial<Pick<CompanySettings, 'name' | 'email' | 'phone' | 'industry' | 'isPublicEntity' | 'aiEnabled'>> & {
    settings?: { [K in keyof ErpSettings]?: Partial<ErpSettings[K]> };
  };

export const companyApi = {
  getSettings: () => api.get<CompanySettings>('/company/settings'),
  updateSettings: (data: CompanySettingsUpdate) => api.patch<CompanySettings>('/company/settings', data),
};

export const approvalMatrixApi = {
  getMatrix: () => api.get<ApprovalMatrixLevel[]>('/approval-matrix'),
  upsertMatrix: (levels: Omit<ApprovalMatrixLevel, 'id'>[]) =>
    api.put<ApprovalMatrixLevel[]>('/approval-matrix', { levels }),
  seedDefault: () => api.post<ApprovalMatrixLevel[]>('/approval-matrix/seed'),
};
