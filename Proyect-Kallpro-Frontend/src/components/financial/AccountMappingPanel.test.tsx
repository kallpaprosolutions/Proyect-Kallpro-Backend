import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '../ui/Toast';
import AccountMappingPanel from './AccountMappingPanel';
import { financialApi } from '../../api/financial';

vi.mock('../../api/financial', () => ({
  financialApi: {
    getAccountMappings: vi.fn(),
    updateAccountMapping: vi.fn(),
  },
}));

// El AccountSelect real carga el plan de cuentas por API; aquí basta un stub.
vi.mock('./ChartOfAccountsTree', () => ({
  AccountSelect: ({ value }: { value: string }) => <span data-testid="account-select">{value}</span>,
}));

// Mismas claves que DEFAULT_MAPPINGS del backend (accounting.service.ts).
const MAPPING_KEYS = [
  'CASH', 'INVENTORY', 'AR', 'AP', 'SUPPLIER_ADVANCE', 'IVA_CREDIT', 'IVA_DEBIT',
  'RETENTION_PAYABLE_RENTA', 'RETENTION_PAYABLE_IVA', 'RETENTION_ASSET',
  'SALES', 'COGS', 'INV_ADJUST_GAIN', 'INV_WRITEOFF',
];

const mappings = MAPPING_KEYS.map((key, i) => ({
  id: `m${i}`, key, accountCode: `100${i}`, accountName: `CUENTA ${i}`,
}));

describe('AccountMappingPanel', () => {
  beforeEach(() => {
    vi.mocked(financialApi.getAccountMappings).mockResolvedValue({ data: mappings } as any);
  });

  it('muestra una etiqueta en español para CADA clave de mapeo (sin claves crudas)', async () => {
    render(<ToastProvider><AccountMappingPanel /></ToastProvider>);
    await screen.findByText('Anticipos a proveedores'); // regresión: SUPPLIER_ADVANCE salía crudo

    // Ninguna clave interna del ERP debe verse tal cual en la UI.
    for (const key of MAPPING_KEYS) {
      expect(screen.queryByText(key)).toBeNull();
    }
  });

  it('renderiza un selector de cuenta por cada mapeo', async () => {
    render(<ToastProvider><AccountMappingPanel /></ToastProvider>);
    await screen.findByText('Anticipos a proveedores');
    expect(screen.getAllByTestId('account-select')).toHaveLength(MAPPING_KEYS.length);
  });
});
