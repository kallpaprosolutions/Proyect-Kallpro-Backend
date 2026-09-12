import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import LeadsPage from './LeadsPage';
import { renderWithQuery } from '../../test/renderWithQuery';
import { crmApi } from '../../api/crm';

vi.mock('../../api/crm', () => ({
  crmApi: {
    listLeads: vi.fn(),
    getLeadStats: vi.fn(),
    rescoreAllLeads: vi.fn(),
    getLead: vi.fn(),
  },
}));

const stats = {
  total: 12,
  converted: 3,
  conversionRate: 25,
  duplicatesPending: 2,
  avgScore: 54,
  mql: 4,
  sql: 2,
  byStatus: [],
  byGrade: [],
  bySource: [],
  thresholds: { mql: 50, sql: 75 },
};

const leads = [
  {
    id: 'l1', firstName: 'Ana', lastName: 'Vaca', email: 'ana@minera.com',
    companyName: 'Minera Andina', jobTitle: 'Gerente Financiero',
    score: 82, grade: 'A', temperature: 'hot', status: 'NEW',
    source: 'web_form', utmCampaign: 'google-erp', isDuplicate: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'l2', firstName: 'Luis', lastName: null, email: 'luis@gmail.com',
    companyName: null, jobTitle: null,
    score: 18, grade: 'D', temperature: 'cold', status: 'DISQUALIFIED',
    source: 'whatsapp', isDuplicate: true, dedupeScore: 95,
    createdAt: new Date().toISOString(),
  },
];

describe('LeadsPage', () => {
  beforeEach(() => {
    vi.mocked(crmApi.listLeads).mockResolvedValue({ data: { leads, total: 2 } } as any);
    vi.mocked(crmApi.getLeadStats).mockResolvedValue({ data: stats } as any);
  });

  it('traduce los estados a español en vez de mostrar el enum crudo', async () => {
    renderWithQuery(<LeadsPage />);
    expect(await screen.findByText('Nuevo')).toBeInTheDocument();
    expect(screen.getByText('Descartado')).toBeInTheDocument();
    expect(screen.queryByText('DISQUALIFIED')).not.toBeInTheDocument();
  });

  it('traduce el origen del lead', async () => {
    renderWithQuery(<LeadsPage />);
    expect(await screen.findByText('Formulario web')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.queryByText('web_form')).not.toBeInTheDocument();
  });

  it('marca los posibles duplicados sin ocultarlos de la lista', async () => {
    renderWithQuery(<LeadsPage />);
    // El duplicado sigue visible; solo lleva su aviso.
    expect(await screen.findByText('Luis')).toBeInTheDocument();
    expect(screen.getByText('Posible duplicado')).toBeInTheDocument();
  });

  it('ofrece el atajo para revisar los duplicados pendientes', async () => {
    renderWithQuery(<LeadsPage />);
    expect(await screen.findByText(/lead\(s\) marcados como posible duplicado/)).toBeInTheDocument();
  });

  it('muestra los indicadores de la bandeja con la tasa de conversión', async () => {
    renderWithQuery(<LeadsPage />);
    expect(await screen.findByText('25%')).toBeInTheDocument();
    expect(screen.getByText('Tasa de conversión')).toBeInTheDocument();
  });

  it('sitúa el puntaje contra los umbrales de la empresa', async () => {
    renderWithQuery(<LeadsPage />);
    // 82 supera el umbral SQL (75); 18 se queda en Lead.
    expect(await screen.findByText('SQL')).toBeInTheDocument();
    expect(screen.getByText('Lead')).toBeInTheDocument();
  });

  it('muestra el estado vacío cuando no hay leads', async () => {
    vi.mocked(crmApi.listLeads).mockResolvedValue({ data: { leads: [], total: 0 } } as any);
    renderWithQuery(<LeadsPage />);
    expect(await screen.findByText('Todavía no hay leads')).toBeInTheDocument();
  });
});
