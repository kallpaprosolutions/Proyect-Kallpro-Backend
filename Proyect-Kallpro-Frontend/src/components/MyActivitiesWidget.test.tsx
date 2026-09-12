import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyActivitiesWidget from './MyActivitiesWidget';
import { Activity, getMyActivities } from '../api/activities';

vi.mock('../api/activities', () => ({
  getMyActivities: vi.fn(),
  completeActivity: vi.fn(),
}));

const act = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'a1', entityType: 'PURCHASE_ORDER', entityId: 'po1', type: 'REVISAR', note: null,
  dueDate: '2026-09-01T00:00:00.000Z', assignedToId: 'u1', assignedToName: 'Ana Torres',
  createdById: 'u1', createdByName: 'Ana Torres', doneAt: null, createdAt: '2026-08-20T00:00:00.000Z',
  status: 'OVERDUE', ...overrides,
});

function renderWidget() {
  return render(<MemoryRouter><MyActivitiesWidget /></MemoryRouter>);
}

describe('MyActivitiesWidget ("Mis actividades" en Inicio)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('no renderiza nada si no hay actividades pendientes', async () => {
    vi.mocked(getMyActivities).mockResolvedValue([]);
    const { container } = renderWidget();
    await waitFor(() => expect(getMyActivities).toHaveBeenCalled());
    expect(container.querySelector('h2')).toBeNull();
  });

  it('lista mis actividades pendientes con el contador', async () => {
    vi.mocked(getMyActivities).mockResolvedValue([act(), act({ id: 'a2', type: 'PAGAR', status: 'TODAY' })]);
    renderWidget();
    expect(await screen.findByText('🗓️ Mis actividades')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/🔍 Revisar/)).toBeInTheDocument();
    expect(screen.getByText(/💳 Pagar/)).toBeInTheDocument();
  });

  it('una actividad vencida se muestra en rojo', async () => {
    vi.mocked(getMyActivities).mockResolvedValue([act({ status: 'OVERDUE' })]);
    renderWidget();
    const dueText = await screen.findByText(/Venció el/);
    expect(dueText.className).toContain('text-red-500');
  });
});
