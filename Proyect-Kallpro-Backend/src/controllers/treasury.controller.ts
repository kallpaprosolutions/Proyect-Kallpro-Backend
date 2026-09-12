import { Request } from 'express';
import * as svc from '../services/treasury.service';
import * as attendance from '../services/attendance.service';
import * as reconciliation from '../services/reconciliation.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';
import { parseBankCsv, parseOfx, BANK_PRESETS } from '../services/treasury/engines/bank-statement-parser.engine';

function domainError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith('VALIDATION:')) throw AppError.badRequest(msg.replace('VALIDATION: ', ''), 'VALIDATION_ERROR');
  if (msg.startsWith('PRESET_COLUMNS_NOT_FOUND:')) {
    const bankLabel = msg.split(':')[1];
    throw AppError.badRequest(`No se reconocieron las columnas esperadas para ${bankLabel}. Revisa que el archivo sea el export real del banco, o usa el preset "Genérico".`, 'PRESET_COLUMNS_NOT_FOUND');
  }
  const map: Record<string, [number, string]> = {
    ACCOUNT_NOT_FOUND: [404, 'Cuenta bancaria no encontrada'],
    INVOICE_NOT_FOUND: [404, 'Factura no encontrada'],
    TRANSACTION_NOT_FOUND: [404, 'Movimiento no encontrado'],
    ALREADY_VOIDED: [409, 'El movimiento ya está anulado'],
    HAS_JOURNAL_ENTRY: [409, 'El movimiento tiene asiento contable: reversa primero el asiento en Contabilidad'],
    PERIOD_NOT_POSTED: [409, 'El período de nómina debe estar contabilizado antes de pagarlo'],
    ALREADY_PAID: [409, 'El período de nómina ya está pagado'],
    PERIOD_LOCKED: [409, 'El período de nómina ya fue contabilizado; no se pueden aplicar novedades'],
    LINE_NOT_FOUND: [404, 'Línea del extracto no encontrada'],
    LINE_NOT_PENDING: [409, 'La línea del extracto ya fue conciliada'],
    TRANSACTION_NOT_AVAILABLE: [409, 'El movimiento ya está conciliado o anulado'],
  };
  const hit = map[msg];
  if (hit) throw new AppError(hit[1], hit[0], msg);
  throw e;
}
const run = async <T>(fn: () => Promise<T>): Promise<T> => fn().catch(domainError);

// ── Catálogo y cuentas ──
export const getBankCatalog = asyncHandler(async (_req: Request, res) => {
  res.json(svc.getBankCatalog());
});

export const listAccounts = asyncHandler(async (req: Request, res) => {
  res.json(await svc.listBankAccounts(req.user!.companyId));
});

export const createAccount = asyncHandler(async (req: Request, res) => {
  const data = await run(() => svc.createBankAccount(req.user!.companyId, req.body));
  res.status(201).json(data);
});

export const updateAccount = asyncHandler(async (req: Request, res) => {
  const data = await run(() => svc.updateBankAccount(req.params.id, req.user!.companyId, req.body));
  res.json(data);
});

// ── Resumen, obligaciones, cobros ──
export const getSummary = asyncHandler(async (req: Request, res) => {
  const weeks = req.query.weeks ? Math.min(16, Math.max(4, Number(req.query.weeks))) : 8;
  res.json(await svc.getTreasurySummary(req.user!.companyId, weeks));
});

export const getObligations = asyncHandler(async (req: Request, res) => {
  res.json(await svc.getObligations(req.user!.companyId));
});

export const getReceivables = asyncHandler(async (req: Request, res) => {
  res.json(await svc.getReceivables(req.user!.companyId));
});

// ── Movimientos ──
export const listTransactions = asyncHandler(async (req: Request, res) => {
  res.json(await svc.listTransactions(req.user!.companyId, {
    bankAccountId: req.query.bankAccountId as string | undefined,
    type: req.query.type as string | undefined,
  }));
});

export const registerTransaction = asyncHandler(async (req: Request, res) => {
  const data = await run(() => svc.registerTransaction(req.user!.companyId, req.body, req.user!.userId));
  res.status(201).json(data);
});

export const voidTransaction = asyncHandler(async (req: Request, res) => {
  const data = await run(() => svc.voidTransaction(req.params.id, req.user!.companyId));
  res.json(data);
});

// ── Reportería gerencial ──
export const incomeExpenseReport = asyncHandler(async (req: Request, res) => {
  const months = req.query.months ? Math.min(24, Math.max(3, Number(req.query.months))) : 12;
  res.json(await svc.getIncomeExpenseReport(req.user!.companyId, months));
});

// ── Conciliación bancaria ──
export const importStatement = asyncHandler(async (req: Request, res) => {
  const { bankAccountId, lines } = req.body;
  if (!bankAccountId) throw AppError.badRequest('bankAccountId requerido', 'VALIDATION_ERROR');
  const data = await run(() => reconciliation.importStatement(req.user!.companyId, bankAccountId, lines, req.user!.userId));
  res.status(201).json(data);
});

// B2 — presets de banco para el import de extracto (CSV con columnas propias, u OFX).
export const getStatementPresets = asyncHandler(async (_req: Request, res) => {
  res.json(Object.values(BANK_PRESETS).map((p) => ({ key: p.key, label: p.label })));
});

// Recibe el TEXTO del archivo tal como lo sube el usuario (CSV u OFX/QFX) + qué preset/formato
// usar, lo parsea a la misma forma que ya consume `importStatement` (StatementLineInput[]) y
// reusa esa función tal cual — cero lógica de conciliación duplicada.
export const importStatementFile = asyncHandler(async (req: Request, res) => {
  const { bankAccountId, format, fileText } = req.body;
  if (!bankAccountId) throw AppError.badRequest('bankAccountId requerido', 'VALIDATION_ERROR');
  if (!fileText || typeof fileText !== 'string') throw AppError.badRequest('Archivo vacío o ilegible', 'VALIDATION_ERROR');

  const { lines, skipped } = await run(async () => (format === 'OFX' ? parseOfx(fileText) : parseBankCsv(fileText, format)));
  if (lines.length === 0) {
    throw AppError.badRequest(
      skipped > 0 ? `No se pudo interpretar ninguna de las ${skipped} línea(s) del archivo con este preset` : 'El archivo no tiene movimientos',
      'NO_VALID_LINES',
    );
  }

  const data = await run(() => reconciliation.importStatement(req.user!.companyId, bankAccountId, lines, req.user!.userId));
  res.status(201).json({ ...data, parsedSkipped: skipped });
});

export const reconciliationStatus = asyncHandler(async (req: Request, res) => {
  const bankAccountId = req.query.bankAccountId as string;
  if (!bankAccountId) throw AppError.badRequest('bankAccountId requerido', 'VALIDATION_ERROR');
  res.json(await run(() => reconciliation.getReconciliationStatus(req.user!.companyId, bankAccountId)));
});

export const confirmMatch = asyncHandler(async (req: Request, res) => {
  const { transactionId } = req.body;
  if (!transactionId) throw AppError.badRequest('transactionId requerido', 'VALIDATION_ERROR');
  const data = await run(() => reconciliation.confirmMatch(req.user!.companyId, req.params.lineId, transactionId));
  res.json(data);
});

export const createFromLine = asyncHandler(async (req: Request, res) => {
  const data = await run(() => reconciliation.createFromStatementLine(req.user!.companyId, req.params.lineId, req.user!.userId));
  res.status(201).json(data);
});

// ── Asistencia (biométrico) ──
export const importAttendance = asyncHandler(async (req: Request, res) => {
  const { records, source } = req.body;
  const data = await run(() => attendance.importAttendance(req.user!.companyId, records, source));
  res.status(201).json(data);
});

export const attendanceSummary = asyncHandler(async (req: Request, res) => {
  const { year, month } = req.query;
  if (!year || !month) throw AppError.badRequest('year y month requeridos', 'VALIDATION_ERROR');
  res.json(await attendance.getMonthlySummary(req.user!.companyId, Number(year), Number(month)));
});

export const applyOvertime = asyncHandler(async (req: Request, res) => {
  const { year, month } = req.body;
  if (!year || !month) throw AppError.badRequest('year y month requeridos', 'VALIDATION_ERROR');
  const data = await run(() => attendance.applyOvertimeToPayroll(req.user!.companyId, Number(year), Number(month), req.user!.userId));
  res.json(data);
});
