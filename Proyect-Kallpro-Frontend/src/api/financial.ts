import client from './client';

export const financialApi = {
  // ── Existing endpoints ──────────────────────────────────────────────────────
  getKPIs: () => client.get('/financial/kpis'),
  getInvoices: (type?: string) => client.get('/financial/invoices', { params: type ? { type } : {} }),
  getInvoice: (id: string) => client.get(`/financial/invoices/${id}`),
  createInvoice: (data: any) => client.post('/financial/invoices', data),
  updateStatus: (id: string, status: string, paidAmount?: number) =>
    client.patch(`/financial/invoices/${id}/status`, { status, paidAmount }),

  // ── Notas de crédito de venta (Sprint 4) ──
  getCreditableLines: (invoiceId: string) =>
    client.get(`/financial/invoices/${invoiceId}/creditable`),
  getCreditNotes: (invoiceId: string) =>
    client.get(`/financial/invoices/${invoiceId}/credit-notes`),
  createCreditNote: (invoiceId: string, data: { reason: string; restock?: boolean; lines: Array<{ salesOrderItemId: string; quantity: number }> }) =>
    client.post(`/financial/invoices/${invoiceId}/credit-notes`, data),
  getCreditNote: (id: string) => client.get(`/financial/credit-notes/${id}`),

  // ── Notas de débito de venta (Etapa 4 del plan SRI, resto) ──
  getDebitNotes: (invoiceId: string) =>
    client.get(`/financial/invoices/${invoiceId}/debit-notes`),
  createDebitNote: (invoiceId: string, data: { reason: string; taxRate: number; concepts: Array<{ description: string; amount: number }> }) =>
    client.post(`/financial/invoices/${invoiceId}/debit-notes`, data),
  getDebitNote: (id: string) => client.get(`/financial/debit-notes/${id}`),

  // ── Facturación electrónica SRI de guías de remisión (Etapa 4, resto) ────
  getDeliveryGuideSriStatus: (guideId: string) => client.get(`/logistics/delivery-guides/${guideId}/sri`),
  emitDeliveryGuideToSri: (guideId: string, establishmentId: string, emissionPointId: string) =>
    client.post(`/logistics/delivery-guides/${guideId}/sri/emit`, { establishmentId, emissionPointId }),
  checkDeliveryGuideSriAuthorization: (guideId: string) =>
    client.post(`/logistics/delivery-guides/${guideId}/sri/check-authorization`),
  downloadDeliveryGuideSriXml: async (guideId: string, filename: string) => {
    const res = await client.get(`/logistics/delivery-guides/${guideId}/sri/xml`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },

  parseStatement: (balanceSheet?: File | null, incomeStatement?: File | null) => {
    const form = new FormData();
    if (balanceSheet)    form.append('balanceSheet', balanceSheet);
    if (incomeStatement) form.append('incomeStatement', incomeStatement);
    return client.post('/financial/parse-statement', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // ── Finance v2 — Executive & 4D ─────────────────────────────────────────────
  getExecutiveSummary: (period?: string) =>
    client.get('/financial/executive-summary', { params: period ? { period } : {} }),

  get4DOptimization: (period?: string) =>
    client.get('/financial/optimization/4d', { params: period ? { period } : {} }),

  // ── Ratios ──────────────────────────────────────────────────────────────────
  getRatios: (category?: string, period?: string) =>
    client.get('/financial/ratios', { params: { category, period } }),

  // ── DCF ─────────────────────────────────────────────────────────────────────
  calculateDCF: (assumptions: Record<string, number>) =>
    client.post('/financial/dcf/calculate', assumptions),

  saveDCFModel: (name: string, assumptions: any, results: any) =>
    client.post('/financial/dcf/save', { name, assumptions, results }),

  getDCFModels: () => client.get('/financial/dcf/models'),

  // ── Scenarios ───────────────────────────────────────────────────────────────
  simulateScenario: (params: any) => client.post('/financial/scenarios/simulate', params),
  getPredefinedScenarios: () => client.get('/financial/scenarios/predefined'),
  saveScenario: (name: string, type: string, params: any, result: any) =>
    client.post('/financial/scenarios/save', { name, type, params, result }),
  getScenarios: () => client.get('/financial/scenarios'),
  compareScenarios: (ids: string[]) => client.post('/financial/scenarios/compare', { ids }),

  // ── Savings ─────────────────────────────────────────────────────────────────
  getSavingsSummary: (period?: string) =>
    client.get('/financial/savings/summary', { params: period ? { period } : {} }),
  logSaving: (data: any) => client.post('/financial/savings/log', data),

  // ── SRI ─────────────────────────────────────────────────────────────────────
  getSRIForms: (year?: number) =>
    client.get('/financial/sri/forms', { params: year ? { year } : {} }),
  getForm104: (period: string) => client.get(`/financial/sri/form-104/${period}`),
  getForm103: (period: string) => client.get(`/financial/sri/form-103/${period}`),
  getSRICalendarWarnings: () => client.get('/financial/sri/calendar-warnings'),
  // Declaraciones por casillas + tablero contable accionable (Sprint 11)
  getForm104Casillas: (period: string) => client.get(`/financial/sri/form-104-casillas/${period}`),
  getForm103Casillas: (period: string) => client.get(`/financial/sri/form-103-casillas/${period}`),
  getAts: (period: string) => client.get(`/financial/sri/ats/${period}`),
  getAtsXml: (period: string) => client.get(`/financial/sri/ats/${period}/xml`, { responseType: 'text' }),
  // Cierre de impuestos automático (Etapa 6 del plan SRI)
  getTaxClosingPreview: (period: string) => client.get(`/financial/sri/tax-closing/${period}`),
  closeTaxPeriod: (period: string) => client.post(`/financial/sri/tax-closing/${period}/close`),
  getAccountingPanel: () => client.get('/financial/accounting-panel'),

  // ── AI Insights ─────────────────────────────────────────────────────────────
  getAIInsights: (period?: string) =>
    client.get(period ? `/financial/insights/${period}` : '/financial/insights'),

  // ── Contabilidad: plan de cuentas, balanza y estados financieros ────────────
  seedAccounts: () => client.post('/financial/seed-accounts'),
  getChartOfAccounts: () => client.get('/financial/chart-of-accounts'),
  getTrialBalance: (from?: string, to?: string) =>
    client.get('/financial/trial-balance', { params: { from, to } }),
  getBalanceSheet: (asOf?: string) =>
    client.get('/financial/balance-sheet', { params: { asOf } }),
  getIncomeStatement: (from?: string, to?: string) =>
    client.get('/financial/income-statement', { params: { from, to } }),
  /** Mayor por cuenta con saldo corrido y origen de cada movimiento */
  getLedger: (accountCode: string, from?: string, to?: string) =>
    client.get(`/financial/ledger/${accountCode}`, { params: { from, to } }),
  /** Estado de flujo de efectivo (NIC 7 — método directo o indirecto) */
  getCashFlow: (from?: string, to?: string, method: 'direct' | 'indirect' = 'direct') =>
    client.get('/financial/cash-flow', { params: { from, to, method } }),
  /** Aging de cartera CxC (opcionalmente filtrada por cliente) */
  getArAging: (customerId?: string) =>
    client.get('/financial/ar-aging', { params: customerId ? { customerId } : {} }),
  /** Aging de pagos CxP por proveedor */
  getApAging: () => client.get('/financial/ap-aging'),
  /** Proyección semanal de caja desde vencimientos CxC/CxP */
  getCashFlowForecast: (weeks = 8) =>
    client.get('/financial/cash-flow-forecast', { params: { weeks } }),

  // ── Estado de Cambios en el Patrimonio (NIC 1, Etapa 8) ──
  getEquityStatement: (from: string, to: string) =>
    client.get('/financial/equity-statement', { params: { from, to } }),

  // ── Notas a los Estados Financieros (Etapa 8) ──
  getFinancialNotes: (period: string) =>
    client.get('/financial/financial-notes', { params: { period } }),
  createFinancialNote: (data: { period: string; title: string; content: string; order?: number }) =>
    client.post('/financial/financial-notes', data),
  updateFinancialNote: (id: string, data: { title?: string; content?: string; order?: number }) =>
    client.patch(`/financial/financial-notes/${id}`, data),
  deleteFinancialNote: (id: string) => client.delete(`/financial/financial-notes/${id}`),

  /** Paquete NIIF/Supercías: Balance + Resultados + Cambios en Patrimonio + Flujo + Notas en un PDF */
  downloadSuperciasPackage: async (period: string) => {
    const res = await client.get('/financial/financial-statements/package.pdf', {
      params: { period }, responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = `estados-financieros-${period}.pdf`; a.click();
    URL.revokeObjectURL(url);
  },

  /** Balanza de comprobación v2: saldo inicial + movimientos + saldo final, agrupable por nivel */
  getTrialBalance2: (params: { from?: string; to?: string; level?: number }) =>
    client.get('/financial/trial-balance-v2', { params }),

  // ── Períodos fiscales (cierre contable mensual, Sprint 6) ──
  getFiscalPeriods: (monthsBack = 18) =>
    client.get('/financial/fiscal-periods', { params: { monthsBack } }),
  closeFiscalPeriod: (year: number, month: number, notes?: string) =>
    client.post('/financial/fiscal-periods/close', { year, month, notes }),
  reopenFiscalPeriod: (year: number, month: number) =>
    client.post('/financial/fiscal-periods/reopen', { year, month }),

  /** Descarga un export CSV del backend (con el token del cliente) y dispara el guardado. */
  downloadCsv: async (path: string, params: Record<string, string | number | undefined>, filename: string) => {
    const res = await client.get(path, { params: { ...params, format: 'csv' }, responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  /** Descarga cualquier archivo binario (PDF/Excel) del backend con el token del cliente. */
  downloadFile: async (path: string, params: Record<string, string | number | undefined>, filename: string) => {
    const res = await client.get(path, { params, responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ── Reportes individuales (pestaña "Reporte"): PDF y Excel de cada estado ──
  downloadBalanceSheetPdf: (asOf?: string) =>
    financialApi.downloadFile('/financial/balance-sheet/export.pdf', { asOf }, `balance-general-${asOf ?? 'hoy'}.pdf`),
  downloadBalanceSheetExcel: (asOf?: string) =>
    financialApi.downloadFile('/financial/balance-sheet/export.xlsx', { asOf }, `balance-general-${asOf ?? 'hoy'}.xlsx`),
  downloadIncomeStatementPdf: (from?: string, to?: string) =>
    financialApi.downloadFile('/financial/income-statement/export.pdf', { from, to }, 'estado-resultados.pdf'),
  downloadIncomeStatementExcel: (from?: string, to?: string) =>
    financialApi.downloadFile('/financial/income-statement/export.xlsx', { from, to }, 'estado-resultados.xlsx'),
  downloadCashFlowPdf: (from: string | undefined, to: string | undefined, method: 'direct' | 'indirect') =>
    financialApi.downloadFile('/financial/cash-flow/export.pdf', { from, to, method }, `flujo-de-efectivo-${method}.pdf`),
  downloadCashFlowExcel: (from: string | undefined, to: string | undefined, method: 'direct' | 'indirect') =>
    financialApi.downloadFile('/financial/cash-flow/export.xlsx', { from, to, method }, `flujo-de-efectivo-${method}.xlsx`),

  // Asientos contables
  getJournalEntries: (params?: Record<string, string>) =>
    client.get('/financial/journal-entries', { params }),
  /** Un asiento individual (trazabilidad — link "Ver asiento contable" desde Ajustes de Inventario) */
  getJournalEntry: (id: string) => client.get(`/financial/journal-entries/${id}`),
  /** Libro diario con filtros ricos + paginación + totales (Sprint 6) */
  searchJournalEntries: (params: Record<string, string | number | undefined>) =>
    client.get('/financial/journal-entries', { params: { page: 1, ...params } }),
  createJournalEntry: (data: { date?: string; description: string; lines: any[] }) =>
    client.post('/financial/journal-entries', data),
  reverseJournalEntry: (id: string) =>
    client.post(`/financial/journal-entries/${id}/reverse`),

  // Configuración de cuentas (posting setup)
  getAccountMappings: () => client.get('/financial/account-mappings'),
  updateAccountMapping: (key: string, accountCode: string) =>
    client.patch('/financial/account-mappings', { key, accountCode }),

  // Impuestos / retenciones
  listIva: () => client.get('/financial/taxes/iva'),
  upsertIva: (data: any) => client.post('/financial/taxes/iva', data),
  listRetentions: (tipo?: string) =>
    client.get('/financial/taxes/retentions', { params: tipo ? { tipo } : {} }),
  upsertRetention: (data: any) => client.post('/financial/taxes/retentions', data),

  // ── Cuentas por Pagar (CxP) — submódulo de Contabilidad ─────────────────────
  listPayables: (params?: { supplierId?: string; overdue?: boolean; search?: string }) =>
    client.get('/financial/ap/payables', { params }),
  getApKpis: () => client.get('/financial/ap/kpis'),
  getApAgingDetail: (supplierId?: string) =>
    client.get('/financial/ap/aging', { params: supplierId ? { supplierId } : {} }),
  payPayable: (id: string, data: { amount: number; bankAccountId?: string; reference?: string; method?: string }) =>
    client.post(`/financial/ap/payables/${id}/pay`, data),
  getApRetentions: (supplierId?: string) =>
    client.get('/financial/ap/retentions', { params: supplierId ? { supplierId } : {} }),
  getApCreditNotes: (supplierId?: string) =>
    client.get('/financial/ap/credit-notes', { params: supplierId ? { supplierId } : {} }),
  getSupplierStatement: (supplierId: string) =>
    client.get(`/financial/ap/suppliers/${supplierId}/statement`),
  /** Conciliación bancaria de los pagos de este documento (roadmap Asistente Contable, Fase 5). */
  getApReconciliation: (sriDocumentId: string) =>
    client.get(`/financial/ap/payables/${sriDocumentId}/reconciliation`),

  // ── CxP: priorización y programación de pagos (Fase 3) ──
  /** Cola de pagos pendientes ordenada por score de prioridad (vencimiento, importancia del proveedor, monto, impacto en caja). */
  getPaymentPriority: () => client.get('/financial/ap/payment-priority'),
  schedulePayment: (sriDocumentId: string, data: { scheduledDate: string; amount: number; bankAccountId?: string; notes?: string }) =>
    client.post(`/financial/ap/payables/${sriDocumentId}/schedule`, data),
  listScheduledPayments: (status?: string) =>
    client.get('/financial/ap/scheduled', { params: status ? { status } : {} }),
  cancelScheduledPayment: (id: string) => client.delete(`/financial/ap/scheduled/${id}`),
  /** Procesa los pagos programados indicados (o, si se omite `ids`, todos los vencidos/de hoy) — crea el Payment real de cada uno. */
  processScheduledPayments: (ids?: string[]) =>
    client.post('/financial/ap/scheduled/process', { ids }),

  // ── CxP: ajustes, notas de crédito y regularización (flujo real de trabajo) ──
  /** Cierra un saldo residual pequeño (redondeo, descuento negociado) contra una ganancia — no mueve caja. */
  writeOffPayable: (sriDocumentId: string, data: { amount: number; reason: string }) =>
    client.post(`/financial/ap/payables/${sriDocumentId}/write-off`, data),
  /** Notas de crédito de compra confirmadas de este proveedor que aún no se enlazaron a un documento específico. */
  getUnlinkedCreditNotes: (supplierId: string) =>
    client.get(`/financial/ap/suppliers/${supplierId}/unlinked-credit-notes`),
  /** Enlaza manualmente una nota de crédito a la factura que debe netear. */
  linkCreditNote: (creditNoteId: string, sriDocumentId: string) =>
    client.post(`/financial/ap/credit-notes/${creditNoteId}/link`, { sriDocumentId }),
  unlinkCreditNote: (creditNoteId: string) =>
    client.post(`/financial/ap/credit-notes/${creditNoteId}/unlink`),
  /** Reclasifica una línea de un asiento contabilizado a otra cuenta (regularización de un mal registro), sin editar el asiento original. */
  reclassifyEntry: (data: { entryId: string; lineId: string; toAccountCode: string; reason: string }) =>
    client.post('/financial/journal-entries/reclassify', data),

  // ── Cuentas por Cobrar (CxC) — submódulo de Contabilidad ────────────────────
  listReceivables: (params?: { customerId?: string; overdue?: boolean; search?: string }) =>
    client.get('/financial/ar/receivables', { params }),
  getArKpis: () => client.get('/financial/ar/kpis'),
  getArAgingDetail: (customerId?: string) =>
    client.get('/financial/ar/aging', { params: customerId ? { customerId } : {} }),
  collectReceivable: (id: string, data: { amount: number; bankAccountId?: string; reference?: string; method?: string }) =>
    client.post(`/financial/ar/receivables/${id}/collect`, data),
  getCreditStatus: (customerId: string) =>
    client.get(`/financial/ar/credit-status/${customerId}`),
  getCustomerStatement: (customerId: string) =>
    client.get(`/financial/ar/customers/${customerId}/statement`),
  /** Conciliación bancaria de los cobros de esta factura (roadmap Asistente Contable, Fase 5). */
  getArReconciliation: (invoiceId: string) =>
    client.get(`/financial/ar/receivables/${invoiceId}/reconciliation`),
  /** Cierra un saldo residual pequeño (descuento, incobrable) contra un gasto — no mueve caja. */
  writeOffReceivable: (invoiceId: string, data: { amount: number; reason: string }) =>
    client.post(`/financial/ar/receivables/${invoiceId}/write-off`, data),

  // ── Gestión de cobranza (CxC) ────────────────────────────────────────────
  getCollectionRadar: () => client.get('/financial/ar/collection/radar'),
  /** Cobranza automática: genera los recordatorios que tocan hoy según los escalones configurados. */
  runDunning: (force = false) => client.post('/financial/ar/collection/run-dunning', { force }),
  getCollectionHistory: (customerId: string) =>
    client.get(`/financial/ar/collection/${customerId}/history`),
  logCollectionActivity: (data: {
    customerId: string; invoiceId?: string; type: string; result?: string;
    promisedAmount?: number; promisedDate?: string; nextActionAt?: string; notes?: string;
  }) => client.post('/financial/ar/collection', data),

  // ── Facturación electrónica SRI — base normativa (Etapa 1) ───────────────
  getFiscalConfig: () => client.get('/financial/fiscal-config'),
  upsertFiscalConfig: (data: {
    ruc: string; razonSocial: string; nombreComercial?: string;
    obligadoContabilidad: boolean; contribuyenteEspecial?: string; regimen: string;
  }) => client.post('/financial/fiscal-config', data),
  setFiscalAmbiente: (ambiente: 'PRUEBAS' | 'PRODUCCION') =>
    client.post('/financial/fiscal-config/ambiente', { ambiente }),
  getProductionChecklist: () => client.get('/financial/fiscal-config/production-checklist'),
  setTipoEmision: (tipoEmision: 'NORMAL' | 'CONTINGENCIA') =>
    client.post('/financial/fiscal-config/tipo-emision', { tipoEmision }),
  createEstablishment: (data: { code: string; name: string; address: string; isMatriz?: boolean }) =>
    client.post('/financial/fiscal-config/establishments', data),
  updateEstablishment: (id: string, data: { name?: string; address?: string; active?: boolean }) =>
    client.patch(`/financial/fiscal-config/establishments/${id}`, data),
  createEmissionPoint: (establishmentId: string, data: { code: string; name?: string }) =>
    client.post(`/financial/fiscal-config/establishments/${establishmentId}/emission-points`, data),
  updateEmissionPoint: (id: string, data: { name?: string; active?: boolean }) =>
    client.patch(`/financial/fiscal-config/emission-points/${id}`, data),
  listCertificates: () => client.get('/financial/fiscal-config/certificates'),
  uploadCertificate: (file: File, alias: string, password: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('alias', alias);
    form.append('password', password);
    return client.post('/financial/fiscal-config/certificates', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deactivateCertificate: (id: string) =>
    client.post(`/financial/fiscal-config/certificates/${id}/deactivate`),
  /** Etapa 2: arma y firma un comprobante de prueba con el certificado real, sin enviar nada al SRI. */
  previewSignedTest: (establishmentId: string, emissionPointId: string) =>
    client.post('/financial/fiscal-config/sri-test/preview', { establishmentId, emissionPointId }),

  // ── Cola de reintentos (Etapa 5, contingencia) ────────────────────────────
  getPendingSriDocuments: () => client.get('/financial/sri/pending'),
  retryPendingSriDocuments: () => client.post('/financial/sri/retry-pending'),

  // ── Facturación electrónica SRI — emisión real (Etapa 3) ─────────────────
  getInvoiceSriStatus: (invoiceId: string) => client.get(`/financial/invoices/${invoiceId}/sri`),
  emitInvoiceToSri: (invoiceId: string, establishmentId: string, emissionPointId: string) =>
    client.post(`/financial/invoices/${invoiceId}/sri/emit`, { establishmentId, emissionPointId }),
  checkInvoiceSriAuthorization: (invoiceId: string) =>
    client.post(`/financial/invoices/${invoiceId}/sri/check-authorization`),
  downloadInvoiceSriXml: async (invoiceId: string, filename: string) => {
    const res = await client.get(`/financial/invoices/${invoiceId}/sri/xml`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },

  // ── Facturación electrónica SRI de notas de crédito (Etapa 4) ────────────
  getCreditNoteSriStatus: (creditNoteId: string) => client.get(`/financial/credit-notes/${creditNoteId}/sri`),
  emitCreditNoteToSri: (creditNoteId: string, establishmentId: string, emissionPointId: string) =>
    client.post(`/financial/credit-notes/${creditNoteId}/sri/emit`, { establishmentId, emissionPointId }),
  checkCreditNoteSriAuthorization: (creditNoteId: string) =>
    client.post(`/financial/credit-notes/${creditNoteId}/sri/check-authorization`),
  downloadCreditNoteSriXml: async (creditNoteId: string, filename: string) => {
    const res = await client.get(`/financial/credit-notes/${creditNoteId}/sri/xml`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },

  // ── Facturación electrónica SRI de notas de débito (Etapa 4, resto) ──────
  getDebitNoteSriStatus: (debitNoteId: string) => client.get(`/financial/debit-notes/${debitNoteId}/sri`),
  emitDebitNoteToSri: (debitNoteId: string, establishmentId: string, emissionPointId: string) =>
    client.post(`/financial/debit-notes/${debitNoteId}/sri/emit`, { establishmentId, emissionPointId }),
  checkDebitNoteSriAuthorization: (debitNoteId: string) =>
    client.post(`/financial/debit-notes/${debitNoteId}/sri/check-authorization`),
  downloadDebitNoteSriXml: async (debitNoteId: string, filename: string) => {
    const res = await client.get(`/financial/debit-notes/${debitNoteId}/sri/xml`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },
};
