import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import * as ctrl from '../controllers/hr-calendar.controller';

const router = Router();
router.use(authMiddleware);

// TTHH gestiona turnos y biométrico de todos; el resto solo ve/solicita lo propio.
const HR_MANAGE_ROLES = ['ADMIN', 'TTHH'];

// Calendario (turnos + biométrico + permisos) — el scope se resuelve por rol dentro del controlador.
router.get('/calendar', ctrl.getCalendar);

// Plantillas de turno
router.get('/shift-templates', ctrl.listShiftTemplates);
router.post('/shift-templates', requireRole(...HR_MANAGE_ROLES), ctrl.createShiftTemplate);
router.put('/shift-templates/:id', requireRole(...HR_MANAGE_ROLES), ctrl.updateShiftTemplate);

// Turnos asignados (tarjetas del calendario) — agendar/reprogramar es exclusivo de TTHH
router.post('/shifts', requireRole(...HR_MANAGE_ROLES), ctrl.assignShift);
router.patch('/shifts/:id', requireRole(...HR_MANAGE_ROLES), ctrl.rescheduleShift);
router.delete('/shifts/:id', requireRole(...HR_MANAGE_ROLES), ctrl.cancelShift);

// Solicitudes de permiso — cualquier colaborador crea/cancela las suyas;
// la jefatura aprueba las de su equipo; TTHH aprueba en última instancia.
router.get('/leave-requests', ctrl.listLeaveRequests);
router.post('/leave-requests', ctrl.createLeaveRequest);
router.patch('/leave-requests/:id/manager-decision', ctrl.managerDecision);
router.patch('/leave-requests/:id/hr-decision', requireRole(...HR_MANAGE_ROLES), ctrl.hrDecision);
router.delete('/leave-requests/:id', ctrl.cancelLeaveRequest);

export default router;
