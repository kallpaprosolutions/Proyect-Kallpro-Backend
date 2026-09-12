import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Activities from './Activities';
import { Activity, getEntityActivities, createActivity, completeActivity, getAssignableUsers } from '../api/activities';
import { useAuthStore } from '../store/auth.store';

vi.mock('../api/activities', () => ({
  getEntityActivities: vi.fn(),
  createActivity: vi.fn(),
  completeActivity: vi.fn(),
  reopenActivity: vi.fn(),
  deleteActivity: vi.fn(),
  getAssignableUsers: vi.fn(),
}));

const act = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'a1', entityType: 'PURCHASE_ORDER', entityId: 'po1', type: 'LLAMAR', note: 'Confirmar entrega',
  dueDate: '2026-09-01T00:00:00.000Z', assignedToId: 'u1', assignedToName: 'Ana Torres',
  createdById: 'u1', createdByName: 'Ana Torres', doneAt: null, createdAt: '2026-08-20T00:00:00.000Z',
  status: 'OVERDUE', ...overrides,
});

describe('Activities (actividades programadas del documento)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEntityActivities).mockResolvedValue([]);
    vi.mocked(getAssignableUsers).mockResolvedValue([]);
    useAuthStore.setState({ user: { id: 'u1', email: 'ana@kallpa.ec', firstName: 'Ana', lastName: 'Torres', role: 'ADMIN', company: { id: 'c1', name: 'KallpaPro' } } as any });
  });

  it('muestra el estado vacío en español', async () => {
    render(<Activities entityType="PURCHASE_ORDER" entityId="po1" />);
    expect(await screen.findByText('Sin actividades agendadas.')).toBeInTheDocument();
  });

  it('lista las actividades con tipo, nota y responsable', async () => {
    vi.mocked(getEntityActivities).mockResolvedValue([act()]);
    render(<Activities entityType="PURCHASE_ORDER" entityId="po1" />);
    expect(await screen.findByText(/📞 Llamar — Confirmar entrega/)).toBeInTheDocument();
    expect(screen.getByText(/Ana Torres/)).toBeInTheDocument();
  });

  it('una actividad vencida se muestra en rojo', async () => {
    vi.mocked(getEntityActivities).mockResolvedValue([act({ status: 'OVERDUE' })]);
    render(<Activities entityType="PURCHASE_ORDER" entityId="po1" />);
    const dueText = await screen.findByText(/Venció el/);
    expect(dueText.className).toContain('text-red-600');
  });

  it('agenda una actividad nueva desde el formulario', async () => {
    vi.mocked(createActivity).mockResolvedValue(act({ id: 'a9' }));
    render(<Activities entityType="PURCHASE_ORDER" entityId="po1" />);
    fireEvent.click(await screen.findByText('+ Agendar'));
    fireEvent.click(screen.getByText('Agendar'));
    await waitFor(() => expect(createActivity).toHaveBeenCalledWith('PURCHASE_ORDER', 'po1', expect.objectContaining({ type: 'LLAMAR' })));
  });

  it('marca una actividad como hecha si el usuario es el responsable', async () => {
    vi.mocked(getEntityActivities).mockResolvedValue([act({ assignedToId: 'u1' })]);
    vi.mocked(completeActivity).mockResolvedValue(act({ status: 'DONE', doneAt: '2026-09-01T00:00:00.000Z' }));
    render(<Activities entityType="PURCHASE_ORDER" entityId="po1" />);
    const checkbox = await screen.findByTitle('Marcar como hecha');
    fireEvent.click(checkbox);
    await waitFor(() => expect(completeActivity).toHaveBeenCalledWith('a1'));
  });

  it('no permite completar una actividad ajena', async () => {
    vi.mocked(getEntityActivities).mockResolvedValue([act({ assignedToId: 'otro', createdById: 'otro', assignedToName: 'Luis Vega' })]);
    render(<Activities entityType="PURCHASE_ORDER" entityId="po1" />);
    const checkbox = await screen.findByTitle('Marcar como hecha');
    expect(checkbox).toBeDisabled();
  });
});
