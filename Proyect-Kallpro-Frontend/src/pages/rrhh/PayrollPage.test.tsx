import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/ui/Toast';
import PayrollPage from './PayrollPage';
import { payrollApi } from '../../api/payroll';

vi.mock('../../api/payroll', () => ({
  payrollApi: {
    getPeriods: vi.fn(),
    getPeriod: vi.fn(),
    getEmployees: vi.fn(),
    generate: vi.fn(),
    postPeriod: vi.fn(),
    payPeriod: vi.fn(),
    addNovelty: vi.fn(),
    deleteNovelty: vi.fn(),
  },
}));
vi.mock('../../api/financial', () => ({
  financialApi: { getJournalEntry: vi.fn() },
}));

const now = new Date();
const periodo = {
  id: 'per1', year: now.getFullYear(), month: now.getMonth() + 1, status: 'PROCESSED',
  journalEntryId: null, paymentEntryId: null,
  novelties: [],
  payslips: [
    {
      id: 'ps1', grossEarnings: '1000', otherEarnings: '83.30',
      totalDeductions: '94.50', netPay: '988.80', employerCost: '286.67',
      employee: { id: 'e1', firstName: 'María', lastName: 'Paredes', cedula: '17123', position: 'Jefa Administrativa', category: 'JEFATURA', department: { name: 'Administración' } },
      lines: [
        { id: 'l1', kind: 'EARNING', concept: 'SUELDO', label: 'Sueldo (30/30 días)', amount: '1000' },
        { id: 'l2', kind: 'EARNING', concept: 'FONDOS_RESERVA', label: 'Fondos de reserva 8,33% (pagados en rol)', amount: '83.30' },
        { id: 'l3', kind: 'DEDUCTION', concept: 'APORTE_IESS', label: 'Aporte personal IESS 9,45%', amount: '94.50' },
        { id: 'l4', kind: 'EMPLOYER', concept: 'APORTE_PATRONAL', label: 'Aporte patronal IESS 11,15%', amount: '111.50' },
      ],
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider><PayrollPage /></ToastProvider>
    </MemoryRouter>,
  );
}

describe('PayrollPage (Rol de Pagos)', () => {
  beforeEach(() => {
    vi.mocked(payrollApi.getPeriods).mockResolvedValue({ data: [{ id: 'per1', year: periodo.year, month: periodo.month, status: 'PROCESSED' }] } as any);
    vi.mocked(payrollApi.getPeriod).mockResolvedValue({ data: periodo } as any);
    vi.mocked(payrollApi.getEmployees).mockResolvedValue({ data: [] } as any);
  });

  it('muestra el rol calculado con totales y estado', async () => {
    renderPage();
    expect(await screen.findByText('María Paredes')).toBeInTheDocument();
    expect(screen.getByText('Calculado')).toBeInTheDocument();
    expect(screen.getByText('Neto a pagar')).toBeInTheDocument();
    expect(screen.getAllByText('$988,80').length).toBeGreaterThan(0);
  });

  it('ofrece contabilizar cuando el período está calculado', async () => {
    renderPage();
    await screen.findByText('María Paredes');
    expect(screen.getByText('📒 Contabilizar')).toBeInTheDocument();
    expect(screen.queryByText('💸 Registrar pago')).toBeNull();
  });

  it('al expandir un rol muestra ingresos, descuentos y costo patronal', async () => {
    renderPage();
    await userEvent.click(await screen.findByText('María Paredes'));
    expect(screen.getByText('Aporte personal IESS 9,45%')).toBeInTheDocument();
    expect(screen.getByText('Aporte patronal IESS 11,15%')).toBeInTheDocument();
    expect(screen.getByText(/Fondos de reserva 8,33%/)).toBeInTheDocument();
  });

  it('contabilizar llama al endpoint y muestra confirmación', async () => {
    vi.mocked(payrollApi.postPeriod).mockResolvedValue({ data: { period: { ...periodo, status: 'POSTED', journalEntryId: 'je1' } } } as any);
    renderPage();
    await userEvent.click(await screen.findByText('📒 Contabilizar'));
    expect(vi.mocked(payrollApi.postPeriod)).toHaveBeenCalledWith('per1');
    expect(await screen.findByText('Período contabilizado — asiento generado')).toBeInTheDocument();
  });
});
