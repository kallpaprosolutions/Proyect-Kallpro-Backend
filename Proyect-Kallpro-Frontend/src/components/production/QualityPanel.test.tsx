import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import QualityPanel from './QualityPanel';
import { ConfirmProvider } from '../../hooks/useConfirm';

vi.mock('../../api/production', async () => {
  const actual = await vi.importActual<typeof import('../../api/production')>('../../api/production');
  return {
    ...actual,
    productionApi: {
      listParameters: vi.fn().mockResolvedValue({ data: [] }),
      createInspection: vi.fn(),
      releaseLot: vi.fn(),
      getTraceability: vi.fn().mockResolvedValue({ data: null }),
      getInspection: vi.fn(),
      createNonConformity: vi.fn(),
      updateNonConformity: vi.fn(),
    },
  };
});

const baseOrder = (over: Record<string, any> = {}) => ({
  id: 'o1',
  poNumber: 'PROD-0001',
  status: 'COMPLETED',
  quantity: 100,
  qualityStatus: 'QUARANTINE',
  lotNumber: 'LOTE-20260723-0001',
  manufacturingDate: '2026-07-23T10:00:00Z',
  expiryDate: '2026-08-22T10:00:00Z',
  actualCost: 250.5,
  product: { id: 'p1', name: 'Yogur natural', unit: 'L', sanitaryRegistry: 'ARCSA-001' },
  sanitary: { ok: true, level: 'OK', message: 'Registro sanitario ARCSA-001 vigente' },
  inspections: [],
  nonConformities: [],
  ...over,
});

describe('QualityPanel (lote, liberación y trazabilidad)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('muestra la ficha del lote con fechas y costo real', () => {
    render(<ConfirmProvider><QualityPanel order={baseOrder()} onChanged={() => {}} /></ConfirmProvider>);
    expect(screen.getByText('LOTE-20260723-0001')).toBeInTheDocument();
    expect(screen.getByText('$250.50')).toBeInTheDocument();
    expect(screen.getByText('Nº de lote')).toBeInTheDocument();
    expect(screen.getByText('Vencimiento')).toBeInTheDocument();
  });

  it('un lote en cuarentena ofrece liberar o rechazar', () => {
    render(<ConfirmProvider><QualityPanel order={baseOrder()} onChanged={() => {}} /></ConfirmProvider>);
    expect(screen.getByText('🔒 En cuarentena')).toBeInTheDocument();
    expect(screen.getByText('✓ Liberar lote')).toBeInTheDocument();
    expect(screen.getByText('✕ Rechazar lote')).toBeInTheDocument();
  });

  it('un lote ya liberado no vuelve a mostrar los botones de liberación', () => {
    render(<ConfirmProvider><QualityPanel order={baseOrder({ qualityStatus: 'RELEASED' })} onChanged={() => {}} /></ConfirmProvider>);
    expect(screen.getByText('✓ Liberado')).toBeInTheDocument();
    expect(screen.queryByText('✓ Liberar lote')).toBeNull();
  });

  it('avisa cuando el registro sanitario ARCSA está vencido', () => {
    render(<ConfirmProvider><QualityPanel order={baseOrder({
      sanitary: { ok: false, level: 'EXPIRED', message: 'Registro sanitario ARCSA-001 VENCIDO hace 5 día(s)' },
    })} onChanged={() => {}} /></ConfirmProvider>);
    expect(screen.getByText(/VENCIDO hace 5 día/)).toBeInTheDocument();
  });

  it('sin producir no ofrece acciones de calidad y explica por qué', () => {
    render(<ConfirmProvider><QualityPanel order={baseOrder({ status: 'IN_PROGRESS', qualityStatus: 'PENDING' })} onChanged={() => {}} /></ConfirmProvider>);
    expect(screen.getByText(/El lote se genera al completar la producción/)).toBeInTheDocument();
    expect(screen.queryByText('🔬 Registrar inspección')).toBeNull();
  });

  it('el certificado de análisis solo aparece con una inspección aprobada', () => {
    const { rerender } = render(<ConfirmProvider><QualityPanel order={baseOrder()} onChanged={() => {}} /></ConfirmProvider>);
    expect(screen.queryByText('📄 Certificado de análisis')).toBeNull();

    rerender(<ConfirmProvider><QualityPanel order={baseOrder({
      inspections: [{ id: 'i1', inspectionNumber: 'INS-0001', type: 'FINAL', status: 'PASSED', inspectedAt: '2026-07-23' }],
    })} onChanged={() => {}} /></ConfirmProvider>);
    expect(screen.getByText('📄 Certificado de análisis')).toBeInTheDocument();
    expect(screen.getByText('Aprobada')).toBeInTheDocument();
  });

  it('lista las no conformidades con severidad y estado en español', () => {
    render(<ConfirmProvider><QualityPanel order={baseOrder({
      nonConformities: [{ id: 'n1', ncNumber: 'RNC-0001', severity: 'CRITICAL', status: 'OPEN', description: 'pH fuera de rango' }],
    })} onChanged={() => {}} /></ConfirmProvider>);
    expect(screen.getByText('RNC-0001')).toBeInTheDocument();
    expect(screen.getByText('pH fuera de rango')).toBeInTheDocument();
    expect(screen.getByText('Crítica')).toBeInTheDocument();
    expect(screen.getByText('Abierta')).toBeInTheDocument();
  });
});
