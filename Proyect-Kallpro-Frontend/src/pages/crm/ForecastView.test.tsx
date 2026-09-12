import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import ForecastView from './ForecastView';
import { renderWithQuery } from '../../test/renderWithQuery';
import { crmApi } from '../../api/crm';

vi.mock('../../api/crm', () => ({
  crmApi: {
    getForecast: vi.fn(),
    getMonthlyTrend: vi.fn(),
    getForecastAccuracy: vi.fn(),
    getVelocity: vi.fn(),
    getForecastByOwner: vi.fn(),
    setQuota: vi.fn(),
  },
}));

// Recharts no mide en jsdom (ancho 0) y no pinta nada; se sustituye por un contenedor
// con tamaño fijo para que el resto de la pantalla sí se pueda comprobar.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<any>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: 600, height: 300 }}>{children}</div>
    ),
  };
});

const forecast = {
  period: '2026-07',
  openPipeline: 180_000,
  weightedForecast: 96_000,
  commit: 90_000,
  bestCase: 60_000,
  committedPlusUpside: 175_000,
  won: 25_000,
  omitted: 40_000,
  quota: 100_000,
  coverageRatio: 1.8,
  coverageStatus: 'insuficiente',
  quotaAttainment: 25,
  gapToQuota: 75_000,
  byCategory: [
    { category: 'PIPELINE', label: 'Pipeline', count: 4, amount: 30_000, weighted: 4_500 },
    { category: 'COMMIT', label: 'Comprometido', count: 2, amount: 90_000, weighted: 67_500 },
  ],
  byStage: [],
  dealCount: 6,
  avgDealSize: 30_000,
  staleDeals: [
    { id: 'd1', name: 'Minera Andina — ERP', stage: 'proposal', amountUsd: 45_000, daysInactive: 31, targetDays: 14 },
  ],
  benchmarks: { commit: 85, bestCase: 38, weighted: 22, bestCaseOverAchievement: 55, varianceRedFlag: 25, healthyCoverage: 3 },
};

describe('ForecastView', () => {
  beforeEach(() => {
    vi.mocked(crmApi.getForecast).mockResolvedValue({ data: forecast } as any);
    vi.mocked(crmApi.getMonthlyTrend).mockResolvedValue({ data: [] } as any);
    vi.mocked(crmApi.getVelocity).mockResolvedValue({ data: [] } as any);
    vi.mocked(crmApi.getForecastByOwner).mockResolvedValue({ data: [] } as any);
    vi.mocked(crmApi.getForecastAccuracy).mockResolvedValue({
      data: { verdict: 'sin_datos', commitAccuracy: 0, bestCaseAccuracy: 0, weightedAccuracy: 0, variancePct: 0, notes: [] },
    } as any);
  });

  it('destaca comprometido, mejor caso y ganado en español', async () => {
    renderWithQuery(<ForecastView />);
    expect(await screen.findByText('Comprometido')).toBeInTheDocument();
    expect(screen.getByText('Mejor caso')).toBeInTheDocument();
    expect(screen.getByText('Ganado')).toBeInTheDocument();
    expect(screen.queryByText('COMMIT')).not.toBeInTheDocument();
  });

  it('avisa cuando la cobertura de pipeline está por debajo de la referencia', async () => {
    renderWithQuery(<ForecastView />);
    expect(await screen.findByText('1.8×')).toBeInTheDocument();
    expect(screen.getByText('Insuficiente')).toBeInTheDocument();
  });

  it('lista las oportunidades estancadas con sus días sin actividad', async () => {
    renderWithQuery(<ForecastView />);
    expect(await screen.findByText('Minera Andina — ERP')).toBeInTheDocument();
    expect(screen.getByText('31 d sin actividad')).toBeInTheDocument();
  });

  it('oculta el bloque de precisión cuando no hay foto del período', async () => {
    renderWithQuery(<ForecastView />);
    await screen.findByText('Comprometido');
    expect(screen.queryByText('Precisión del pronóstico')).not.toBeInTheDocument();
  });

  it('muestra la precisión contra las referencias del mercado cuando hay datos', async () => {
    vi.mocked(crmApi.getForecastAccuracy).mockResolvedValue({
      data: {
        verdict: 'sobre_pronostico',
        commitAccuracy: 60, bestCaseAccuracy: 30, weightedAccuracy: 40,
        variancePct: -40,
        notes: ['Se cerró 40.0 % por debajo de lo comprometido.'],
      },
    } as any);
    renderWithQuery(<ForecastView />);
    expect(await screen.findByText('Precisión del pronóstico')).toBeInTheDocument();
    expect(screen.getByText('Sobre-pronóstico')).toBeInTheDocument();
    expect(screen.getByText('referencia 85 %')).toBeInTheDocument();
  });

  it('felicita cuando no hay oportunidades estancadas', async () => {
    vi.mocked(crmApi.getForecast).mockResolvedValue({ data: { ...forecast, staleDeals: [] } } as any);
    renderWithQuery(<ForecastView />);
    expect(await screen.findByText(/Ninguna oportunidad está estancada/)).toBeInTheDocument();
  });
});
