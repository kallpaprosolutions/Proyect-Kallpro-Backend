import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import JournalEntriesPage from './JournalEntriesPage';
import { financialApi } from '../../api/financial';

vi.mock('../../api/financial', () => ({
  financialApi: { getJournalEntries: vi.fn() },
}));

const asientos = [
  {
    id: 'e1', entryNumber: 'AST-0005', entryDate: '2026-06-10',
    description: 'Costo de ventas PV-0002', entityType: 'SALES_ORDER',
    status: 'POSTED', totalDebit: '10.00', lines: [],
  },
  {
    id: 'e2', entryNumber: 'AST-0002', entryDate: '2026-06-06',
    description: 'Recepción OC OC-0001', entityType: 'PURCHASE_ORDER',
    status: 'REVERSED', totalDebit: '500.00', lines: [],
  },
];

describe('JournalEntriesPage', () => {
  beforeEach(() => {
    vi.mocked(financialApi.getJournalEntries).mockResolvedValue({ data: asientos } as any);
  });

  it('traduce el origen y el estado del asiento (sin enums crudos)', async () => {
    render(<MemoryRouter><JournalEntriesPage /></MemoryRouter>);
    // Regresión: mostraba SALES_ORDER / PURCHASE_ORDER / POSTED sin traducir
    expect(await screen.findByText('Venta')).toBeInTheDocument();
    expect(screen.getByText('Compra')).toBeInTheDocument();
    expect(screen.getByText('Contabilizado')).toBeInTheDocument();
    expect(screen.getByText('Reversado')).toBeInTheDocument();
    expect(screen.queryByText('SALES_ORDER')).toBeNull();
    expect(screen.queryByText('PURCHASE_ORDER')).toBeNull();
    expect(screen.queryByText('POSTED')).toBeNull();
  });

  it('lista los asientos con número y monto', async () => {
    render(<MemoryRouter><JournalEntriesPage /></MemoryRouter>);
    expect(await screen.findByText('AST-0005')).toBeInTheDocument();
    expect(screen.getByText('$500.00')).toBeInTheDocument();
  });
});
