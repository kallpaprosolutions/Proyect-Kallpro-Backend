import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/ui/Toast';
import HrCalendarPage from './HrCalendarPage';
import { hrCalendarApi } from '../../api/hrCalendar';
import { payrollApi } from '../../api/payroll';

vi.mock('../../api/hrCalendar', () => ({
  hrCalendarApi: {
    getCalendar: vi.fn(),
    getShiftTemplates: vi.fn(),
    createShiftTemplate: vi.fn(),
    updateShiftTemplate: vi.fn(),
    assignShift: vi.fn(),
    rescheduleShift: vi.fn(),
    cancelShift: vi.fn(),
    getLeaveRequests: vi.fn(),
    createLeaveRequest: vi.fn(),
    managerDecision: vi.fn(),
    hrDecision: vi.fn(),
    cancelLeaveRequest: vi.fn(),
  },
}));
vi.mock('../../api/payroll', () => ({
  payrollApi: { getEmployees: vi.fn() },
}));

const empleado = { id: 'emp1', firstName: 'Ana', lastName: 'Torres' };

const leaveMine = [{
  id: 'lv1', type: 'VACACIONES', status: 'PENDIENTE_JEFATURA',
  startDate: '2026-09-10', endDate: '2026-09-12', reason: 'Viaje familiar',
  employee: empleado,
}];

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider><HrCalendarPage /></ToastProvider>
    </MemoryRouter>,
  );
}

describe('HrCalendarPage (calendario de TTHH)', () => {
  beforeEach(() => {
    vi.mocked(hrCalendarApi.getCalendar).mockResolvedValue({
      data: { shifts: [], attendance: [], leaves: [], canManage: false },
    } as any);
    vi.mocked(hrCalendarApi.getShiftTemplates).mockResolvedValue({ data: [] } as any);
    vi.mocked(hrCalendarApi.getLeaveRequests).mockImplementation((params?: any) => {
      if (params?.scope === 'mine') return Promise.resolve({ data: leaveMine } as any);
      return Promise.resolve({ data: [] } as any);
    });
    vi.mocked(payrollApi.getEmployees).mockResolvedValue({ data: [empleado] } as any);
  });

  it('muestra el encabezado en modo colaborador (solo su calendario)', async () => {
    renderPage();
    expect(await screen.findByText('Calendario de TTHH')).toBeInTheDocument();
    expect(screen.getByText(/Tu turno, tu asistencia y tus solicitudes/)).toBeInTheDocument();
    // Un colaborador normal no ve el botón de plantillas de turno (exclusivo de TTHH)
    expect(screen.queryByText('🎨 Plantillas de turno')).toBeNull();
  });

  it('un colaborador puede solicitar un permiso', async () => {
    renderPage();
    await userEvent.click(await screen.findByText('+ Solicitar permiso'));
    expect(screen.getByText('Solicitar permiso')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Motivo/), 'Viaje familiar');
    vi.mocked(hrCalendarApi.createLeaveRequest).mockResolvedValue({ data: {} } as any);
    await userEvent.click(screen.getByText('Enviar solicitud'));

    expect(hrCalendarApi.createLeaveRequest).toHaveBeenCalledWith(expect.objectContaining({
      type: 'VACACIONES', reason: 'Viaje familiar',
    }));
  });

  it('muestra el panel de aprobaciones con mis solicitudes y permite cancelarlas', async () => {
    renderPage();
    await userEvent.click(await screen.findByText('📋 Aprobaciones'));
    const panel = await screen.findByText('Mis solicitudes');
    expect(panel).toBeInTheDocument();
    expect(screen.getByText(/Viaje familiar/)).toBeInTheDocument();
    expect(screen.getByText('Pendiente jefatura')).toBeInTheDocument();

    vi.mocked(hrCalendarApi.cancelLeaveRequest).mockResolvedValue({ data: {} } as any);
    await userEvent.click(screen.getByText('Cancelar'));
    expect(hrCalendarApi.cancelLeaveRequest).toHaveBeenCalledWith('lv1');
  });

  it('TTHH ve controles de gestión (plantillas de turno y filtro de colaborador)', async () => {
    vi.mocked(hrCalendarApi.getCalendar).mockResolvedValue({
      data: { shifts: [], attendance: [], leaves: [], canManage: true },
    } as any);
    renderPage();
    expect(await screen.findByText('🎨 Plantillas de turno')).toBeInTheDocument();
    expect(screen.getByText('Turnos, biométrico y solicitudes de permiso de todos los colaboradores')).toBeInTheDocument();
    const filter = screen.getByDisplayValue('Todos los colaboradores');
    expect(within(filter.closest('select')!).getByText('Ana Torres')).toBeInTheDocument();
  });
});
