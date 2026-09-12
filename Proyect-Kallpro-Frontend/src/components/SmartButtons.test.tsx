import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SmartButtons from './SmartButtons';
import { getSmartButtons } from '../api/smartButtons';

vi.mock('../api/smartButtons', () => ({
  getSmartButtons: vi.fn(),
}));

const renderButtons = () =>
  render(
    <MemoryRouter>
      <SmartButtons entityType="PURCHASE_ORDER" entityId="po1" />
    </MemoryRouter>
  );

describe('SmartButtons (contadores de documentos vinculados)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('muestra los contadores con etiquetas en español', async () => {
    vi.mocked(getSmartButtons).mockResolvedValue([
      { key: 'JOURNAL', label: 'Asientos', icon: '📑', count: 2, route: '/financial/journal-entries?entityId=po1', items: [
        { id: 'j1', title: 'AST-0001', subtitle: 'Anticipo · $100.00 · Contabilizado', route: '/financial/journal-entries?entityId=po1' },
        { id: 'j2', title: 'AST-0002', subtitle: 'Recepción · $400.00 · Contabilizado', route: '/financial/journal-entries?entityId=po1' },
      ]},
      { key: 'SHIPMENTS', label: 'Envíos', icon: '🚚', count: 0, route: null, items: [] },
    ]);
    renderButtons();
    expect(await screen.findByText('Asientos')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Envíos')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('deshabilita botones con contador 0', async () => {
    vi.mocked(getSmartButtons).mockResolvedValue([
      { key: 'SHIPMENTS', label: 'Envíos', icon: '🚚', count: 0, route: null, items: [] },
    ]);
    renderButtons();
    const btn = (await screen.findByText('Envíos')).closest('button')!;
    expect(btn).toBeDisabled();
  });

  it('al hacer clic despliega los documentos vinculados', async () => {
    vi.mocked(getSmartButtons).mockResolvedValue([
      { key: 'JOURNAL', label: 'Asientos', icon: '📑', count: 1, route: '/financial/journal-entries?entityId=po1', items: [
        { id: 'j1', title: 'AST-0001', subtitle: 'Anticipo · $100.00 · Contabilizado', route: '/financial/journal-entries?entityId=po1' },
      ]},
    ]);
    renderButtons();
    fireEvent.click(await screen.findByText('Asientos'));
    expect(screen.getByText('AST-0001')).toBeInTheDocument();
    expect(screen.getByText(/Anticipo · \$100\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Ver todos en asientos/)).toBeInTheDocument();
  });

  it('no renderiza nada si la API falla', async () => {
    vi.mocked(getSmartButtons).mockRejectedValue(new Error('fail'));
    const { container } = renderButtons();
    await vi.waitFor(() => expect(getSmartButtons).toHaveBeenCalled());
    expect(container.firstChild?.firstChild ?? null).toBeNull();
  });
});
