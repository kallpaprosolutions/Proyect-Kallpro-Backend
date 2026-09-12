import client from './client';
const api = client;

export interface BankAccountPayload {
  bankCode: string; accountNumber: string; accountType?: string; currency?: string;
  swiftCode?: string; iban?: string; isForeign?: boolean; alias?: string; openingBalance?: number;
}

export interface TransactionPayload {
  bankAccountId: string;
  type: 'INGRESO' | 'EGRESO';
  method: string; // TRANSFERENCIA | CHEQUE | EFECTIVO | SWIFT | TARJETA
  amount: number;
  date?: string;
  reference?: string;
  beneficiary?: string;
  swiftCode?: string;
  sourceType?: string; // PAYROLL | AP_INVOICE | AR_INVOICE | TAX_SRI | TAX_IESS | MANUAL
  sourceId?: string;
  notes?: string;
}

export const treasuryApi = {
  // Catálogo de bancos Ecuador (con SWIFT) y cuentas de la empresa
  getBankCatalog: () => api.get('/treasury/banks'),
  getAccounts: () => api.get('/treasury/accounts'),
  createAccount: (data: BankAccountPayload) => api.post('/treasury/accounts', data),
  updateAccount: (id: string, data: Partial<BankAccountPayload> & { isActive?: boolean }) =>
    api.put(`/treasury/accounts/${id}`, data),

  // Panorama y flujo de caja
  getSummary: (weeks?: number) => api.get('/treasury/summary', { params: weeks ? { weeks } : {} }),
  getObligations: () => api.get('/treasury/obligations'),
  getReceivables: () => api.get('/treasury/receivables'),

  // Movimientos bancarios
  getTransactions: (filters?: { bankAccountId?: string; type?: string }) =>
    api.get('/treasury/transactions', { params: filters }),
  registerTransaction: (data: TransactionPayload) => api.post('/treasury/transactions', data),
  voidTransaction: (id: string) => api.post(`/treasury/transactions/${id}/void`),

  // Reportería gerencial (Financiero)
  getIncomeExpense: (months?: number) =>
    api.get('/treasury/income-expense', { params: months ? { months } : {} }),

  // Conciliación bancaria (extracto vs movimientos)
  importStatement: (bankAccountId: string, lines: Array<{ date: string; description: string; reference?: string; amount: number }>) =>
    api.post('/treasury/reconciliation/import', { bankAccountId, lines }),
  // B2 — import por archivo (CSV con preset de banco, u OFX/QFX)
  getStatementPresets: () => api.get<Array<{ key: string; label: string }>>('/treasury/reconciliation/presets'),
  importStatementFile: (bankAccountId: string, format: string, fileText: string) =>
    api.post('/treasury/reconciliation/import-file', { bankAccountId, format, fileText }),
  getReconciliation: (bankAccountId: string) =>
    api.get('/treasury/reconciliation', { params: { bankAccountId } }),
  confirmMatch: (lineId: string, transactionId: string) =>
    api.post(`/treasury/reconciliation/${lineId}/match`, { transactionId }),
  createFromLine: (lineId: string) =>
    api.post(`/treasury/reconciliation/${lineId}/create-transaction`),

  // Asistencia biométrica
  importAttendance: (records: Array<{ cedula: string; date: string; checkIn: string; checkOut: string; deviceId?: string }>, source?: string) =>
    api.post('/treasury/attendance/import', { records, source }),
  getAttendanceSummary: (year: number, month: number) =>
    api.get('/treasury/attendance/summary', { params: { year, month } }),
  applyOvertime: (year: number, month: number) =>
    api.post('/treasury/attendance/apply-overtime', { year, month }),
};
