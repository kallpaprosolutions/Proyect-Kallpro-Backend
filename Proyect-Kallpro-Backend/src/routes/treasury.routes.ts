import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import * as ctrl from '../controllers/treasury.controller';

const router = Router();
router.use(authMiddleware);

// Tesorería mueve dinero: dirección, gerencia, contabilidad y tesorería.
const TREASURY_ROLES = ['ADMIN', 'GERENTE', 'CONTADOR', 'ASISTENTE_CONTABLE', 'TESORERIA'];
router.use(requireRole(...TREASURY_ROLES));

// Catálogo de bancos del Ecuador (+ SWIFT) y cuentas de la empresa
router.get('/banks', ctrl.getBankCatalog);
router.get('/accounts', ctrl.listAccounts);
router.post('/accounts', ctrl.createAccount);
router.put('/accounts/:id', ctrl.updateAccount);

// Panorama: saldos, flujo proyectado, obligaciones y cobros pendientes
router.get('/summary', ctrl.getSummary);
router.get('/obligations', ctrl.getObligations);
router.get('/receivables', ctrl.getReceivables);

// Movimientos bancarios (pagos/cobros vinculados a nómina, CxP, CxC, impuestos)
router.get('/transactions', ctrl.listTransactions);
router.post('/transactions', ctrl.registerTransaction);
router.post('/transactions/:id/void', ctrl.voidTransaction);

// Reportería gerencial (módulo Financiero)
router.get('/income-expense', ctrl.incomeExpenseReport);

// Conciliación bancaria (extracto vs movimientos): automática + semiautomática
router.post('/reconciliation/import', ctrl.importStatement);
// B2 — import de extracto por archivo (CSV con preset de banco, u OFX/QFX).
router.get('/reconciliation/presets', ctrl.getStatementPresets);
router.post('/reconciliation/import-file', ctrl.importStatementFile);
router.get('/reconciliation', ctrl.reconciliationStatus);
router.post('/reconciliation/:lineId/match', ctrl.confirmMatch);
router.post('/reconciliation/:lineId/create-transaction', ctrl.createFromLine);

// Asistencia biométrica → horas extras de nómina
router.post('/attendance/import', ctrl.importAttendance);
router.get('/attendance/summary', ctrl.attendanceSummary);
router.post('/attendance/apply-overtime', ctrl.applyOvertime);

export default router;
