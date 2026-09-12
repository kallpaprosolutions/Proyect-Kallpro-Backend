import { AuthRequest } from '../../types/index';
import * as acc from '../../services/finance/accounting.service';
import * as tax from '../../services/finance/tax.service';
import * as journal from '../../services/journal.service';
import * as fiscal from '../../services/finance/fiscal-period.service';
import { asyncHandler } from '../../middleware/error-handler';
import { AppError } from '../../utils/errors';
import { sendCsv } from '../../utils/csv.helper';

/** Traduce PERIOD_CLOSED:YYYY-MM a un 400 legible. */
function mapPeriodClosed(e: any): never {
  if (e?.message?.startsWith('PERIOD_CLOSED')) {
    const period = e.message.split(':')[1] ?? '';
    throw AppError.badRequest(`El período contable ${period} está cerrado. Reábrelo en Contabilidad → Cierres para registrar asientos en esa fecha.`, 'PERIOD_CLOSED');
  }
  throw e;
}

function parseRange(req: AuthRequest) {
  const { from, to } = req.query as { from?: string; to?: string };
  return {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  };
}

// ── Inicialización completa: plan de cuentas + mappings + impuestos ──
export const seedAccounts = asyncHandler(async (req: AuthRequest, res) => {
  const companyId = req.user!.companyId;
  const accounts = await acc.seedChartOfAccounts(companyId);
  const mappings = await acc.seedAccountMappings(companyId);
  const taxes = await tax.seedTaxCatalogs();
  res.json({ ok: true, accounts: accounts.length, mappings: mappings.length, taxes });
});

export const getChart = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await acc.getChartOfAccounts(req.user!.companyId));
});

export const getTrialBalance = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await acc.getTrialBalance(req.user!.companyId, parseRange(req)));
});

// ── Balanza de comprobación v2: saldo inicial + movimientos + saldo final ──
// ?from&to&level=1..6&format=csv
export const getTrialBalance2 = asyncHandler(async (req: AuthRequest, res) => {
  const { level, format } = req.query as { level?: string; format?: string };
  const result = await acc.getTrialBalance2(req.user!.companyId, {
    ...parseRange(req),
    level: level ? Math.max(1, Math.min(6, Number(level))) : undefined,
  });
  if (format === 'csv') {
    sendCsv(res, 'balanza-comprobacion.csv',
      ['Cuenta', 'Nombre', 'Tipo', 'Nivel', 'Saldo inicial', 'Debe', 'Haber', 'Saldo final'],
      result.rows.map((r) => [r.code, r.name, r.accountType, r.level, r.opening, r.debit, r.credit, r.closing]));
    return;
  }
  res.json(result);
});

// ── Períodos fiscales (cierre contable mensual) ──
export const listFiscalPeriods = asyncHandler(async (req: AuthRequest, res) => {
  const monthsBack = Math.max(6, Math.min(36, Number(req.query.monthsBack) || 18));
  res.json(await fiscal.listPeriods(req.user!.companyId, monthsBack));
});

export const closeFiscalPeriod = asyncHandler(async (req: AuthRequest, res) => {
  const { year, month, notes } = req.body as { year?: number; month?: number; notes?: string };
  if (!year || !month) throw AppError.badRequest('year y month requeridos', 'VALIDATION_ERROR');
  try {
    res.json(await fiscal.closePeriod(req.user!.companyId, Number(year), Number(month), req.user!.userId, notes));
  } catch (e: any) {
    if (e?.message === 'CANNOT_CLOSE_FUTURE') throw AppError.badRequest('No se puede cerrar un mes futuro', 'CANNOT_CLOSE_FUTURE');
    if (e?.message === 'INVALID_MONTH') throw AppError.badRequest('Mes inválido', 'VALIDATION_ERROR');
    throw e;
  }
});

export const reopenFiscalPeriod = asyncHandler(async (req: AuthRequest, res) => {
  const { year, month } = req.body as { year?: number; month?: number };
  if (!year || !month) throw AppError.badRequest('year y month requeridos', 'VALIDATION_ERROR');
  try {
    res.json(await fiscal.reopenPeriod(req.user!.companyId, Number(year), Number(month), req.user!.userId));
  } catch (e: any) {
    if (e?.message === 'PERIOD_NOT_CLOSED') throw AppError.badRequest('Ese período no está cerrado', 'PERIOD_NOT_CLOSED');
    throw e;
  }
});

export const getBalanceSheet = asyncHandler(async (req: AuthRequest, res) => {
  const { asOf } = req.query as { asOf?: string };
  res.json(await acc.getBalanceSheet(req.user!.companyId, asOf ? new Date(asOf) : undefined));
});

export const getIncomeStatement = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await acc.getIncomeStatement(req.user!.companyId, parseRange(req)));
});

// ── Mayor por cuenta (saldo corrido + drill-down al documento origen) ──
export const getLedger = asyncHandler(async (req: AuthRequest, res) => {
  const data = await acc.getAccountLedger(req.user!.companyId, req.params.accountCode, parseRange(req));
  if ((req.query as any).format === 'csv') {
    sendCsv(res, `mayor-${data.account.code}.csv`,
      ['Fecha', 'Asiento', 'Descripción', 'Debe', 'Haber', 'Saldo', 'Origen'],
      [
        ['', '', 'SALDO DE APERTURA', '', '', data.openingBalance, ''],
        ...data.entries.map((e) => [
          new Date(e.date).toISOString().slice(0, 10), e.journalNumber, e.description,
          e.debit, e.credit, e.runningBalance, e.sourceType ?? 'MANUAL',
        ]),
        ['', '', 'SALDO DE CIERRE', '', '', data.closingBalance, ''],
      ]);
    return;
  }
  res.json(data);
});

// ── Estado de flujo de efectivo (método directo o indirecto, NIC 7) ──
export const getCashFlow = asyncHandler(async (req: AuthRequest, res) => {
  const { method } = req.query as { method?: string };
  res.json(await acc.getCashFlowStatement(req.user!.companyId, {
    ...parseRange(req),
    method: method === 'indirect' ? 'indirect' : 'direct',
  }));
});

// ── Estado de Cambios en el Patrimonio (NIC 1, Etapa 8) ──
export const getEquityStatement = asyncHandler(async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  if (!from || !to) throw AppError.badRequest('from y to son obligatorios (rango del período)', 'VALIDATION_ERROR');
  res.json(await acc.getEquityStatement(req.user!.companyId, { from: new Date(from), to: new Date(to) }));
});

// ── Paquete NIIF/Supercías: 4 estados + notas en un solo PDF (Etapa 8) ──
export const exportSuperciasPackagePdf = asyncHandler(async (req: AuthRequest, res) => {
  const { period } = req.query as { period?: string };
  if (!period || !/^\d{4}(-\d{2})?$/.test(period)) {
    throw AppError.badRequest('period debe ser "AAAA-MM" o "AAAA"', 'VALIDATION_ERROR');
  }
  const { exportSuperciasPackagePdf: svc } = await import('../../services/reports.service');
  await svc(req.user!.companyId, period, res);
});

// ── Descarga de un solo reporte (pestaña "Reporte") en PDF o Excel ──
export const exportBalanceSheetPdf = asyncHandler(async (req: AuthRequest, res) => {
  const { asOf } = req.query as { asOf?: string };
  const { exportBalanceSheetPdf: svc } = await import('../../services/reports.service');
  await svc(req.user!.companyId, asOf, res);
});
export const exportBalanceSheetExcel = asyncHandler(async (req: AuthRequest, res) => {
  const { asOf } = req.query as { asOf?: string };
  const { exportBalanceSheetExcel: svc } = await import('../../services/reports.service');
  await svc(req.user!.companyId, asOf, res);
});
export const exportIncomeStatementPdf = asyncHandler(async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const { exportIncomeStatementPdf: svc } = await import('../../services/reports.service');
  await svc(req.user!.companyId, from, to, res);
});
export const exportIncomeStatementExcel = asyncHandler(async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const { exportIncomeStatementExcel: svc } = await import('../../services/reports.service');
  await svc(req.user!.companyId, from, to, res);
});
export const exportCashFlowPdf = asyncHandler(async (req: AuthRequest, res) => {
  const { from, to, method } = req.query as { from?: string; to?: string; method?: string };
  const { exportCashFlowPdf: svc } = await import('../../services/reports.service');
  await svc(req.user!.companyId, from, to, method === 'indirect' ? 'indirect' : 'direct', res);
});
export const exportCashFlowExcel = asyncHandler(async (req: AuthRequest, res) => {
  const { from, to, method } = req.query as { from?: string; to?: string; method?: string };
  const { exportCashFlowExcel: svc } = await import('../../services/reports.service');
  await svc(req.user!.companyId, from, to, method === 'indirect' ? 'indirect' : 'direct', res);
});

// ── Aging de cartera (CxC), pagos (CxP) y forecast de caja — módulo Financiero ──
export const getArAging = asyncHandler(async (req: AuthRequest, res) => {
  const { customerId } = req.query as { customerId?: string };
  const { getArAging: svc } = await import('../../services/finance/aging.service');
  res.json(await svc(req.user!.companyId, customerId));
});

export const getApAging = asyncHandler(async (req: AuthRequest, res) => {
  const { getApAging: svc } = await import('../../services/finance/aging.service');
  res.json(await svc(req.user!.companyId));
});

export const getCashFlowForecast = asyncHandler(async (req: AuthRequest, res) => {
  const weeks = Math.max(1, Math.min(26, Number(req.query.weeks) || 8));
  const { getCashFlowForecast: svc } = await import('../../services/finance/aging.service');
  res.json(await svc(req.user!.companyId, weeks));
});

// ── Configuración de cuentas (posting setup) ──
export const getMappings = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await acc.getAccountMappings(req.user!.companyId));
});

export const updateMapping = asyncHandler(async (req: AuthRequest, res) => {
  const { key, accountCode } = req.body;
  if (!key || !accountCode) throw AppError.badRequest('key y accountCode requeridos', 'VALIDATION_ERROR');
  try {
    res.json(await acc.updateAccountMapping(req.user!.companyId, key, accountCode));
  } catch (e: any) {
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST'); // default original: 400
  }
});

// ── Asientos manuales ──
export const createManualEntry = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const entry = await journal.createManualEntry(req.user!.companyId, req.body, req.user!.userId);
    res.status(201).json(entry);
  } catch (e: any) {
    if (e?.message === 'UNBALANCED') throw AppError.badRequest('El asiento no cuadra: débitos ≠ créditos', 'UNBALANCED');
    if (e?.message?.startsWith('ACCOUNT_NOT_FOUND')) throw AppError.badRequest(`Cuenta no existe en el plan: ${e.message.split(':')[1]}`, 'ACCOUNT_NOT_FOUND');
    if (e?.message?.startsWith('PERIOD_CLOSED')) mapPeriodClosed(e);
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST');
  }
});

export const reverseEntry = asyncHandler(async (req: AuthRequest, res) => {
  try {
    res.json(await journal.reverseEntry(req.params.id, req.user!.companyId, req.user!.userId));
  } catch (e: any) {
    if (e?.message?.startsWith('PERIOD_CLOSED')) mapPeriodClosed(e);
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST');
  }
});

// ── Reclasificación de cuenta (regularización de un mal registro) ──
// No edita el asiento original (regla 5: contabilizado no se modifica) — crea un asiento
// correctivo de 2 líneas que mueve el saldo de la cuenta equivocada a la correcta.
export const reclassifyEntry = asyncHandler(async (req: AuthRequest, res) => {
  const { entryId, lineId, toAccountCode, reason } = req.body as {
    entryId?: string; lineId?: string; toAccountCode?: string; reason?: string;
  };
  if (!entryId || !lineId || !toAccountCode) throw AppError.badRequest('entryId, lineId y toAccountCode son obligatorios', 'VALIDATION');
  if (!reason?.trim()) throw AppError.badRequest('El motivo de la reclasificación es obligatorio', 'VALIDATION');
  try {
    const entry = await journal.createReclassificationEntry(req.user!.companyId, {
      originalEntryId: entryId, lineId, toAccountCode, reason, userId: req.user!.userId,
    });
    res.status(201).json(entry);
  } catch (e: any) {
    if (e?.message?.startsWith('ACCOUNT_NOT_FOUND')) throw AppError.badRequest(`Cuenta no existe en el plan: ${e.message.split(':')[1]}`, 'ACCOUNT_NOT_FOUND');
    if (e?.message?.startsWith('PERIOD_CLOSED')) mapPeriodClosed(e);
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST');
  }
});

// ── Impuestos / retenciones ──
export const listIva = asyncHandler(async (_req: AuthRequest, res) => {
  res.json(await tax.listIvaTariffs());
});
export const listRetentions = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await tax.listRetentions(req.query.tipo as string | undefined));
});
export const upsertIva = asyncHandler(async (req: AuthRequest, res) => {
  try {
    res.json(await tax.upsertIvaTariff(req.body));
  } catch (e: any) {
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST');
  }
});
export const upsertRetention = asyncHandler(async (req: AuthRequest, res) => {
  try {
    res.json(await tax.upsertRetention(req.body));
  } catch (e: any) {
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST');
  }
});
