import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/ui/Toast';
import EmployeesPage from './EmployeesPage';
import { payrollApi } from '../../api/payroll';

vi.mock('../../api/payroll', () => ({
  payrollApi: {
    getEmployees: vi.fn(),
    getDepartments: vi.fn(),
    getConfig: vi.fn(),
    createEmployee: vi.fn(),
    updateEmployee: vi.fn(),
    getLinkableUsers: vi.fn(),
  },
}));

const empleados = [
  {
    id: 'e1', cedula: '1712345678', firstName: 'María', lastName: 'Paredes',
    email: 'maria@kallpa.ec', position: 'Jefa Administrativa', category: 'JEFATURA',
    baseSalary: '1500', hireDate: '2024-03-01T00:00:00.000Z',
    monthlyThirteenth: false, monthlyFourteenth: false, reserveFundsToIESS: true,
    familyBurdens: 2, projectedPersonalExpenses: '3000', isActive: true,
    department: { id: 'd1', name: 'Administración' },
  },
  {
    id: 'e2', cedula: '1798765432', firstName: 'Luis', lastName: 'Vera',
    email: null, position: 'Auxiliar de Limpieza', category: 'SERVICIOS',
    baseSalary: '482', hireDate: '2026-01-15T00:00:00.000Z',
    monthlyThirteenth: true, monthlyFourteenth: true, reserveFundsToIESS: false,
    familyBurdens: 0, projectedPersonalExpenses: '0', isActive: true,
    department: null,
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider><EmployeesPage /></ToastProvider>
    </MemoryRouter>,
  );
}

describe('EmployeesPage (Nómina)', () => {
  beforeEach(() => {
    vi.mocked(payrollApi.getEmployees).mockResolvedValue({ data: empleados } as any);
    vi.mocked(payrollApi.getDepartments).mockResolvedValue({ data: [{ id: 'd1', name: 'Administración' }] } as any);
    vi.mocked(payrollApi.getConfig).mockResolvedValue({ data: { SBU: 482 } } as any);
    vi.mocked(payrollApi.getLinkableUsers).mockResolvedValue({ data: [] } as any);
  });

  it('lista empleados con categoría traducida y sueldo', async () => {
    renderPage();
    expect(await screen.findByText('María Paredes')).toBeInTheDocument();
    // (el nombre de categoría también aparece en los botones de filtro)
    expect(screen.getAllByText('Jefatura').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Servicios').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('JEFATURA')).toBeNull(); // sin enums crudos
    expect(screen.getByText('$1500,00')).toBeInTheDocument();
  });

  it('muestra el SBU vigente en el encabezado', async () => {
    renderPage();
    expect(await screen.findByText(/SBU \d{4}: \$482,00/)).toBeInTheDocument();
  });

  it('indica la forma de pago de beneficios de cada empleado', async () => {
    renderPage();
    await screen.findByText('María Paredes');
    expect(screen.getByText(/FR→IESS/)).toBeInTheDocument();       // fondos acumulados en IESS
    expect(screen.getByText(/XIII mens\./)).toBeInTheDocument();   // décimos mensualizados
  });
});
