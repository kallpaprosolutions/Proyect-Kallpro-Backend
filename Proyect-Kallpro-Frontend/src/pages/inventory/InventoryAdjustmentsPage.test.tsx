import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/ui/Toast';
import { ConfirmProvider } from '../../hooks/useConfirm';
import InventoryAdjustmentsPage from './InventoryAdjustmentsPage';
import { inventoryApi } from '../../api/inventory';

vi.mock('../../api/inventory', () => ({
  inventoryApi: {
    getAdjustments: vi.fn(),
    getProducts: vi.fn(),
    getWarehouses: vi.fn(),
    getMovement: vi.fn(),
    createAdjustment: vi.fn(),
    approveAdjustment: vi.fn(),
    rejectAdjustment: vi.fn(),
    searchProducts: vi.fn(),
  },
}));
vi.mock('../../api/financial', () => ({
  financialApi: { getJournalEntry: vi.fn() },
}));
vi.mock('../../hooks/useCan', () => ({
  useCan: () => ({ can: () => true, cannot: () => false, ability: {} }),
}));

const ajusteAprobado = {
  id: 'a1', adjNumber: 'AJU-0001', type: 'ADJUSTMENT_IN', quantity: '5',
  unitCost: '10', reason: 'Prueba', notes: null, status: 'APPROVED_APPLIED',
  requestedBy: 'u1', requestedAt: '2026-06-19T19:15:51.000Z',
  approvedBy: 'u2', approvedAt: '2026-06-19T19:16:44.000Z', rejectionReason: null,
  movementId: 'mov-huerfano', journalEntryId: null,
  product: { id: 'p1', name: 'DISCO DURO 1TB', sku: 'PROD-002', unit: 'UNIDAD', avgCost: '10' },
  warehouse: { id: 'w1', name: 'BODEGA COSTA' },
  requestedByName: 'Admin', approvedByName: 'Carla',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider><ConfirmProvider><InventoryAdjustmentsPage /></ConfirmProvider></ToastProvider>
    </MemoryRouter>,
  );
}

describe('InventoryAdjustmentsPage', () => {
  beforeEach(() => {
    vi.mocked(inventoryApi.getAdjustments).mockResolvedValue({ data: [ajusteAprobado] } as any);
    vi.mocked(inventoryApi.getProducts).mockResolvedValue({ data: [] } as any);
    vi.mocked(inventoryApi.getWarehouses).mockResolvedValue({ data: [] } as any);
  });

  it('muestra el ajuste aprobado con su número y estado', async () => {
    renderPage();
    expect(await screen.findByText('AJU-0001')).toBeInTheDocument();
    expect(screen.getByText('Aprobado y aplicado')).toBeInTheDocument();
  });

  it('muestra un toast de error si el movimiento vinculado ya no existe (404)', async () => {
    // Regresión: AJU con movementId huérfano — el click no debe romper la página.
    vi.mocked(inventoryApi.getMovement).mockRejectedValue({
      response: { status: 404, data: { error: 'Movimiento no encontrado' } },
    });
    renderPage();
    await userEvent.click(await screen.findByText('Ver movimiento'));
    expect(await screen.findByText('No se pudo cargar el movimiento')).toBeInTheDocument();
    // La tabla sigue visible (no crash)
    expect(screen.getByText('AJU-0001')).toBeInTheDocument();
  });

  it('abre el detalle del movimiento cuando el API responde', async () => {
    vi.mocked(inventoryApi.getMovement).mockResolvedValue({
      data: {
        id: 'mov-1', type: 'ADJUSTMENT_IN', quantity: '5', unitCost: '10',
        createdAt: '2026-06-19T19:16:44.000Z',
        product: { name: 'DISCO DURO 1TB', sku: 'PROD-002' },
        warehouse: { name: 'BODEGA COSTA' },
      },
    } as any);
    renderPage();
    await userEvent.click(await screen.findByText('Ver movimiento'));
    expect(vi.mocked(inventoryApi.getMovement)).toHaveBeenCalledWith('mov-huerfano');
    expect(screen.queryByText('No se pudo cargar el movimiento')).toBeNull();
  });
});
