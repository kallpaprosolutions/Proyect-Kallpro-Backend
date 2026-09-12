import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/ui/Toast';
import ReplenishmentPage from './ReplenishmentPage';
import { inventoryApi } from '../../api/inventory';

vi.mock('../../api/inventory', () => ({
  inventoryApi: {
    getReplenishmentSuggestions: vi.fn(),
    applySuggestedTransfer: vi.fn(),
    applySuggestedRequisition: vi.fn(),
    snoozeReplenishment: vi.fn(),
  },
}));

const transferSuggestion = {
  productId: 'p1', productName: 'TORNILLO 1/4', sku: 'TOR-001', unit: 'CAJA',
  warehouseId: 'w1', warehouseName: 'Bodega Norte',
  available: 5, min: 10, max: 50, target: 50, needed: 45,
  route: 'TRANSFER', transferFromWarehouseId: 'w2', transferFromWarehouseName: 'Bodega Sur',
  daysOfStock: 5, urgency: 'CRITICAL',
};

const purchaseSuggestion = {
  productId: 'p2', productName: 'CEMENTO', sku: 'CEM-001', unit: 'SACO',
  warehouseId: 'w1', warehouseName: 'Bodega Norte',
  available: 8, min: 10, max: 50, target: 50, needed: 42,
  route: 'PURCHASE', transferFromWarehouseId: null, transferFromWarehouseName: null,
  daysOfStock: 12, urgency: 'MEDIUM',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider><ReplenishmentPage /></ToastProvider>
    </MemoryRouter>,
  );
}

describe('ReplenishmentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el estado vacío cuando ninguna bodega está bajo su mínimo', async () => {
    vi.mocked(inventoryApi.getReplenishmentSuggestions).mockResolvedValue({ data: [] } as any);
    renderPage();
    expect(await screen.findByText('✓ Todas las bodegas están sobre su mínimo')).toBeInTheDocument();
  });

  it('muestra la ruta preferida TRASLADO con la bodega donante', async () => {
    vi.mocked(inventoryApi.getReplenishmentSuggestions).mockResolvedValue({ data: [transferSuggestion] } as any);
    renderPage();
    expect(await screen.findByText('TORNILLO 1/4')).toBeInTheDocument();
    expect(screen.getByText(/Trasladar desde Bodega Sur/)).toBeInTheDocument();
    expect(screen.getByText('Trasladar')).toBeInTheDocument();
  });

  it('muestra la ruta preferida COMPRAR cuando ninguna bodega tiene excedente suficiente', async () => {
    vi.mocked(inventoryApi.getReplenishmentSuggestions).mockResolvedValue({ data: [purchaseSuggestion] } as any);
    renderPage();
    expect(await screen.findByText('CEMENTO')).toBeInTheDocument();
    expect(screen.getByText('🛒 Comprar')).toBeInTheDocument();
    expect(screen.getByText('Requisición')).toBeInTheDocument();
  });

  it('ejecuta el traslado sugerido y recarga la lista', async () => {
    vi.mocked(inventoryApi.getReplenishmentSuggestions)
      .mockResolvedValueOnce({ data: [transferSuggestion] } as any)
      .mockResolvedValueOnce({ data: [] } as any);
    vi.mocked(inventoryApi.applySuggestedTransfer).mockResolvedValue({ data: {} } as any);

    renderPage();
    await userEvent.click(await screen.findByText('Trasladar'));

    expect(inventoryApi.applySuggestedTransfer).toHaveBeenCalledWith('p1', 'w1');
    expect(await screen.findByText('✓ Todas las bodegas están sobre su mínimo')).toBeInTheDocument();
  });

  it('pospone una sugerencia y la quita de la lista', async () => {
    vi.mocked(inventoryApi.getReplenishmentSuggestions)
      .mockResolvedValueOnce({ data: [purchaseSuggestion] } as any)
      .mockResolvedValueOnce({ data: [] } as any);
    vi.mocked(inventoryApi.snoozeReplenishment).mockResolvedValue({ data: {} } as any);

    renderPage();
    await userEvent.click(await screen.findByText('Posponer'));

    expect(inventoryApi.snoozeReplenishment).toHaveBeenCalledWith('p2', 'w1', 7);
    expect(await screen.findByText('✓ Todas las bodegas están sobre su mínimo')).toBeInTheDocument();
  });

  it('muestra un toast de error si la ejecución falla (sugerencia obsoleta)', async () => {
    vi.mocked(inventoryApi.getReplenishmentSuggestions).mockResolvedValue({ data: [transferSuggestion] } as any);
    vi.mocked(inventoryApi.applySuggestedTransfer).mockRejectedValue({
      response: { data: { error: 'La sugerencia ya no aplica: el stock cambió' } },
    });

    renderPage();
    await userEvent.click(await screen.findByText('Trasladar'));

    expect(await screen.findByText('La sugerencia ya no aplica: el stock cambió')).toBeInTheDocument();
  });
});
