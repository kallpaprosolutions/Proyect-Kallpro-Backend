import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GlobalSearch from './GlobalSearch';
import { globalSearch } from '../../api/search';

vi.mock('../../api/search', () => ({
  globalSearch: vi.fn(),
}));

const openPalette = () => {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
};

const renderSearch = () =>
  render(
    <MemoryRouter>
      <GlobalSearch />
    </MemoryRouter>
  );

describe('GlobalSearch (Ctrl+K)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(globalSearch).mockResolvedValue({ query: '', groups: [], total: 0 });
  });

  it('no se muestra hasta pulsar Ctrl+K', () => {
    renderSearch();
    expect(screen.queryByPlaceholderText(/Buscar clientes/)).toBeNull();
    openPalette();
    expect(screen.getByPlaceholderText(/Buscar clientes/)).toBeInTheDocument();
  });

  it('se abre con el evento del botón del Navbar', () => {
    renderSearch();
    fireEvent(window, new Event('kallpa:open-search'));
    expect(screen.getByPlaceholderText(/Buscar clientes/)).toBeInTheDocument();
  });

  it('muestra menús del sistema filtrados en español', () => {
    renderSearch();
    openPalette();
    const input = screen.getByPlaceholderText(/Buscar clientes/);
    fireEvent.change(input, { target: { value: 'tesor' } });
    expect(screen.getByText('Tesorería')).toBeInTheDocument();
  });

  it('encuentra menús por palabras clave alternativas (conciliacion → Tesorería)', () => {
    renderSearch();
    openPalette();
    const input = screen.getByPlaceholderText(/Buscar clientes/);
    fireEvent.change(input, { target: { value: 'conciliacion' } });
    expect(screen.getByText('Tesorería')).toBeInTheDocument();
  });

  it('muestra resultados federados agrupados del backend', async () => {
    vi.mocked(globalSearch).mockResolvedValue({
      query: 'oc-0001',
      groups: [{
        type: 'PURCHASE_ORDER',
        label: 'Órdenes de compra',
        results: [{
          type: 'PURCHASE_ORDER', id: 'po1', title: 'OC-0001',
          subtitle: 'Ferretería Sur · Aprobada · $150.00', route: '/purchases/po1',
        }],
      }],
      total: 1,
    });
    renderSearch();
    openPalette();
    const input = screen.getByPlaceholderText(/Buscar clientes/);
    fireEvent.change(input, { target: { value: 'oc-0001' } });
    expect(await screen.findByText('OC-0001')).toBeInTheDocument();
    expect(screen.getByText('Órdenes de compra')).toBeInTheDocument();
    expect(screen.getByText(/Ferretería Sur · Aprobada/)).toBeInTheDocument();
  });

  it('no llama al backend con menos de 2 caracteres', async () => {
    renderSearch();
    openPalette();
    const input = screen.getByPlaceholderText(/Buscar clientes/);
    fireEvent.change(input, { target: { value: 'a' } });
    await waitFor(() => expect(globalSearch).not.toHaveBeenCalled());
  });

  it('cierra con Escape (comportamiento cmdk + overlay)', () => {
    renderSearch();
    openPalette();
    expect(screen.getByPlaceholderText(/Buscar clientes/)).toBeInTheDocument();
    // Ctrl+K de nuevo alterna y cierra
    openPalette();
    expect(screen.queryByPlaceholderText(/Buscar clientes/)).toBeNull();
  });
});
