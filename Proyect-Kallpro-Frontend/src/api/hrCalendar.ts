import client from './client';
const api = client;

export interface ShiftTemplatePayload {
  name: string; startTime: string; endTime: string; breakMinutes?: number; color?: string;
}

export interface AssignShiftPayload {
  employeeId: string; date: string; shiftTemplateId?: string; startTime?: string; endTime?: string; notes?: string;
}

export interface LeaveRequestPayload {
  employeeId?: string; type: string; startDate: string; endDate: string; reason: string;
}

export const hrCalendarApi = {
  // Calendario (turnos + biométrico + permisos)
  getCalendar: (from: string, to: string, employeeId?: string) =>
    api.get('/hr/calendar', { params: { from, to, ...(employeeId ? { employeeId } : {}) } }),

  // Plantillas de turno
  getShiftTemplates: () => api.get('/hr/shift-templates'),
  createShiftTemplate: (data: ShiftTemplatePayload) => api.post('/hr/shift-templates', data),
  updateShiftTemplate: (id: string, data: Partial<ShiftTemplatePayload> & { isActive?: boolean }) =>
    api.put(`/hr/shift-templates/${id}`, data),

  // Turnos asignados
  assignShift: (data: AssignShiftPayload) => api.post('/hr/shifts', data),
  rescheduleShift: (id: string, data: Partial<AssignShiftPayload> & { status?: string }) =>
    api.patch(`/hr/shifts/${id}`, data),
  cancelShift: (id: string) => api.delete(`/hr/shifts/${id}`),

  // Solicitudes de permiso
  getLeaveRequests: (params?: { status?: string; scope?: 'mine' | 'team'; employeeId?: string }) =>
    api.get('/hr/leave-requests', { params }),
  createLeaveRequest: (data: LeaveRequestPayload) => api.post('/hr/leave-requests', data),
  managerDecision: (id: string, decision: 'APPROVE' | 'REJECT', comment?: string) =>
    api.patch(`/hr/leave-requests/${id}/manager-decision`, { decision, comment }),
  hrDecision: (id: string, decision: 'APPROVE' | 'REJECT', comment?: string) =>
    api.patch(`/hr/leave-requests/${id}/hr-decision`, { decision, comment }),
  cancelLeaveRequest: (id: string) => api.delete(`/hr/leave-requests/${id}`),
};
