import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import WarehousesPage from './WarehousesPage';
import { inventoryApi } from '../../api/inventory';
import { ToastProvider } from '../../components/ui/Toast';
import { ConfirmProvider } from '../../hooks/useConfirm';

vi.mock('../../api/inventory', () => ({
  inventoryApi: {
    getWarehouseTree: vi.fn(),
    getLocations: vi.fn(),
    getWarehouses: vi.fn(),
    createWarehouse: vi.fn(),
    updateWarehouse: vi.fn(),
    toggleWarehouse: vi.fn(),
    createLocation: vi.fn(),
    updateLocation: vi.fn(),
    deleteLocation: vi.fn(),
  },
}));

const bodega = (id: string, name: string, extra: object = {}) => ({
  id, name, code: id.toUpperCase(), isActive: true, isDefault: false,
  parentWarehouseId: null, children: [], stocks: [], ...extra,
});

describe('WarehousesPage', () => {
  beforeEach(() => {
    vi.mocked(inventoryApi.getLocations).mockResolvedValue({ data: [] } as any);
  });

  it('escribe "raíces" en plural correctamente (regresión: decía "raízces")', async () => {
    vi.mocked(inventoryApi.getWarehouseTree).mockResolvedValue({
      data: [bodega('b1', 'MATRIZ', { isDefault: true }), bodega('b2', 'COSTA')],
    } as any);
    render(<ToastProvider><ConfirmProvider><WarehousesPage /></ConfirmProvider></ToastProvider>);
    expect(await screen.findByText(/2 raíces · 2 total/)).toBeInTheDocument();
    expect(screen.queryByText(/raízces/)).toBeNull();
  });

  it('usa singular "raíz" cuando hay una sola bodega raíz', async () => {
    vi.mocked(inventoryApi.getWarehouseTree).mockResolvedValue({
      data: [bodega('b1', 'MATRIZ', { isDefault: true })],
    } as any);
    render(<ToastProvider><ConfirmProvider><WarehousesPage /></ConfirmProvider></ToastProvider>);
    expect(await screen.findByText(/1 raíz · 1 total/)).toBeInTheDocument();
  });

  it('cuenta sub-bodegas en el total', async () => {
    const hijo = bodega('b2', 'SUB-1');
    vi.mocked(inventoryApi.getWarehouseTree).mockResolvedValue({
      data: [bodega('b1', 'MATRIZ', { isDefault: true, children: [hijo] })],
    } as any);
    render(<ToastProvider><ConfirmProvider><WarehousesPage /></ConfirmProvider></ToastProvider>);
    expect(await screen.findByText(/1 raíz · 2 total/)).toBeInTheDocument();
  });
});
