import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import * as ctrl from '../controllers/payroll.controller';

const router = Router();
router.use(authMiddleware);

// Organigrama: TTHH gestiona la estructura organizacional (igual que turnos/biométrico en
// hr-calendar.routes.ts); el resto de PAYROLL_ROLES solo puede verlo, no reorganizarlo.
// Se declara ANTES del router.use(requireRole(PAYROLL_ROLES)) de abajo para que TTHH no
// herede acceso al resto de nómina (sueldos, períodos, novedades).
const ORG_CHART_VIEW_ROLES = ['ADMIN', 'GERENTE', 'CONTADOR', 'ASISTENTE_CONTABLE', 'TTHH'];
const ORG_CHART_EDIT_ROLES = ['ADMIN', 'TTHH'];
router.get('/org-chart', requireRole(...ORG_CHART_VIEW_ROLES), ctrl.getOrgChart);
router.put('/org-chart/:id', requireRole(...ORG_CHART_EDIT_ROLES), ctrl.updateOrgChartManager);

// Nómina es información sensible: solo dirección, gerencia y contabilidad.
const PAYROLL_ROLES = ['ADMIN', 'GERENTE', 'CONTADOR', 'ASISTENTE_CONTABLE'];
router.use(requireRole(...PAYROLL_ROLES));

// Parámetros vigentes (SBU, tasas, tabla IR)
router.get('/config', ctrl.getConfig);

// Empleados
router.get('/employees', ctrl.listEmployees);
router.post('/employees', ctrl.createEmployee);
router.put('/employees/:id', ctrl.updateEmployee);
router.get('/employees/linkable-users', ctrl.listLinkableUsers);

// Períodos y rol de pagos
router.get('/periods', ctrl.listPeriods);
router.get('/periods/:id', ctrl.getPeriod);
router.post('/generate', ctrl.generatePayroll);          // { year, month } — calcula/recalcula
router.post('/periods/:id/post', ctrl.postPeriod);       // asiento de devengo
router.post('/periods/:id/pay', ctrl.payPeriod);         // asiento de pago de netos

// Participación de utilidades (15%, art. 97 CT): ?year=2025&profit=125000 — solo cálculo, no contabiliza
router.get('/utilidades', ctrl.getUtilidades);

// Novedades (horas extras, bonos, anticipos, préstamos, pensiones, multas)
router.post('/novelties', ctrl.addNovelty);
router.delete('/novelties/:id', ctrl.deleteNovelty);

export default router;
