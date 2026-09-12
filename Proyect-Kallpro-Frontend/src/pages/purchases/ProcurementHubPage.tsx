import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import { procurementApi } from '../../api/procurement';
import { DataTable } from '../../components/ui/DataTable';

/**
 * Hub de Compras Guiado — pantalla central del flujo P2P.
 * El usuario ve dónde está cada compra y cuál es SU siguiente acción:
 * Requisición → Cotizaciones → Comparativo → Aprobación → Pago/Recepción → Fin.
 */

type StageKey = 'REQUISITION' | 'QUOTATION' | 'COMPARISON' | 'APPROVAL' | 'PAYMENT_RECEIPT' | 'CLOSED';

interface PipelineItem {
  id: string; type: 'REQ' | 'PO'; number: string; title: string | null;
  supplier: string | null; amount: number; status: string;
  nextAction: string | null; nextActionUrl: string | null; daysInStage: number;
}
interface Stage { key: StageKey; label: string; count: number; items: PipelineItem[]; }
interface Pending { kind: string; entityId: string; label: string; url: string; daysWaiting: number; }

const STAGE_ICONS: Record<StageKey, string> = {
  REQUISITION: '📝', QUOTATION: '📨', COMPARISON: '⚖️',
  APPROVAL: '✅', PAYMENT_RECEIPT: '💵', CLOSED: '🏁',
};

const STAGE_HINTS: Record<StageKey, string> = {
  REQUISITION: 'Solicitudes esperando aprobación interna',
  QUOTATION: 'Esperando cotizaciones de proveedores (máx. 3)',
  COMPARISON: 'Listas para comparar con pesos y elegir ganador',
  APPROVAL: 'Órdenes de compra en cadena de aprobación',
  PAYMENT_RECEIPT: 'Anticipos, recepción conforme y pago de saldo',
  CLOSED: 'Compras finalizadas, rechazadas o canceladas',
};

export default function ProcurementHubPage() {
  const navigate = useNavigate();
  const [stages, setStages] = useState<Stage[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeStage, setActiveStage] = useState<StageKey | 'ALL'>('ALL');

  const load = () => {
    setError('');
    setLoading(true);
    procurementApi.getPipeline()
      .then((r) => { setStages(r.data.stages); setPending(r.data.myPending); })
      .catch(() => setError('No se pudo cargar el flujo de compras. Verifica el backend.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const visibleItems = useMemo(() => {
    const list = activeStage === 'ALL'
      ? stages.filter((s) => s.key !== 'CLOSED').flatMap((s) => s.items.map((i) => ({ ...i, stageLabel: s.label, stageKey: s.key })))
      : (stages.find((s) => s.key === activeStage)?.items ?? []).map((i) => ({ ...i, stageLabel: stages.find((s) => s.key === activeStage)!.label, stageKey: activeStage as StageKey }));
    return list;
  }, [stages, activeStage]);

  const columns = useMemo<ColumnDef<any, any>[]>(() => [
    {
      accessorKey: 'number', header: 'Documento',
      cell: ({ row }) => (
        <div>
          <span className="font-mono font-medium text-brand-600 dark:text-brand-400">{row.original.number}</span>
          {row.original.title && <p className="text-xs text-surface-500 truncate max-w-[180px]">{row.original.title}</p>}
        </div>
      ),
    },
    {
      id: 'stage', accessorFn: (r) => r.stageLabel, header: 'Etapa',
      cell: ({ row }) => (
        <span className="text-xs px-2 py-1 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 whitespace-nowrap">
          {STAGE_ICONS[row.original.stageKey as StageKey]} {row.original.stageLabel}
        </span>
      ),
    },
    {
      id: 'supplier', accessorFn: (r) => r.supplier || '', header: 'Proveedor',
      cell: ({ getValue }) => <span className="text-surface-700 dark:text-surface-200">{(getValue() as string) || '—'}</span>,
    },
    {
      accessorKey: 'amount', header: 'Monto',
      cell: ({ getValue }) => <span className="font-mono">${Number(getValue()).toLocaleString('es', { minimumFractionDigits: 2 })}</span>,
    },
    {
      accessorKey: 'daysInStage', header: 'Días en etapa',
      cell: ({ getValue }) => {
        const d = getValue() as number;
        return <span className={`font-mono text-sm ${d > 7 ? 'text-red-500 font-semibold' : d > 3 ? 'text-amber-600 dark:text-amber-400' : 'text-surface-500'}`}>{d}d</span>;
      },
    },
    {
      id: 'next', header: 'Siguiente paso', enableSorting: false,
      cell: ({ row }) => row.original.nextActionUrl ? (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(row.original.nextActionUrl); }}
          className="text-xs px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors whitespace-nowrap">
          {row.original.nextAction} →
        </button>
      ) : <span className="text-xs text-surface-400">{row.original.nextAction || '—'}</span>,
    },
  ], [navigate]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header + CTA principal */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🛒</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Flujo de Compras</h1>
            <p className="text-sm text-surface-500">Requisición → Comparativo → Aprobación → Anticipo → Recepción → Saldo</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/purchases/suppliers" className="text-sm px-4 py-2 border border-surface-200 dark:border-surface-600 hover:border-surface-400 text-surface-600 dark:text-surface-300 rounded-lg font-medium transition-colors">
            🏭 Proveedores
          </Link>
          <Link to="/compras/ordenes" className="text-sm px-4 py-2 border border-surface-200 dark:border-surface-600 hover:border-surface-400 text-surface-600 dark:text-surface-300 rounded-lg font-medium transition-colors">
            📦 Órdenes
          </Link>
          <Link to="/purchases/requisitions/new"
            className="text-sm px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-semibold transition-colors shadow-soft">
            + Iniciar compra
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          <span className="text-red-500 text-lg">⚠️</span>
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button onClick={load} className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline">Reintentar</button>
        </div>
      )}

      {/* Banda de etapas interactiva */}
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-4 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-surface-500 uppercase tracking-wider">Etapas del flujo — haz clic para filtrar</p>
          {activeStage !== 'ALL' && (
            <button onClick={() => setActiveStage('ALL')} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">Ver todas</button>
          )}
        </div>
        <div className="flex items-center overflow-x-auto pb-1">
          {stages.map((stage, i) => {
            const active = activeStage === stage.key;
            return (
              <div key={stage.key} className="flex items-center flex-1 last:flex-none min-w-0">
                <button onClick={() => setActiveStage(active ? 'ALL' : stage.key)}
                  title={STAGE_HINTS[stage.key]}
                  className="flex flex-col items-center gap-1.5 min-w-0 group">
                  <div className={`relative w-11 h-11 rounded-full flex items-center justify-center text-base font-semibold transition-all ${
                    active ? 'bg-brand-500 text-white ring-4 ring-brand-200 dark:ring-brand-900'
                    : stage.count > 0 ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 group-hover:ring-2 group-hover:ring-brand-300'
                    : 'bg-surface-100 dark:bg-surface-700 text-surface-400'}`}>
                    {STAGE_ICONS[stage.key]}
                    {stage.count > 0 && (
                      <span className={`absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full text-[11px] font-bold flex items-center justify-center ${
                        active ? 'bg-white text-brand-600' : 'bg-brand-500 text-white'}`}>
                        {stage.count}
                      </span>
                    )}
                  </div>
                  <span className={`text-[11px] font-medium whitespace-nowrap ${active ? 'text-brand-600 dark:text-brand-400' : 'text-surface-500'}`}>
                    {stage.label}
                  </span>
                </button>
                {i < stages.length - 1 && <div className="flex-1 h-0.5 mx-2 min-w-[16px] bg-surface-200 dark:bg-surface-700" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mis pendientes */}
        <div className="lg:col-span-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-4 shadow-soft h-fit">
          <h2 className="font-semibold text-surface-900 dark:text-white mb-3 flex items-center gap-2">
            📌 Mis pendientes
            {pending.length > 0 && <span className="text-xs bg-brand-500 text-white px-2 py-0.5 rounded-full">{pending.length}</span>}
          </h2>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface-100 dark:bg-surface-700 rounded-xl animate-pulse" />)}</div>
          ) : pending.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">🎉</div>
              <p className="text-sm text-surface-400">No tienes acciones pendientes.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {pending.map((p) => (
                <button key={`${p.kind}-${p.entityId}-${p.label}`} onClick={() => navigate(p.url)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-surface-100 dark:border-surface-700 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-800 dark:text-surface-100 truncate">{p.label}</p>
                    <p className={`text-xs ${p.daysWaiting > 7 ? 'text-red-500' : 'text-surface-400'}`}>
                      {p.daysWaiting === 0 ? 'Hoy' : `Hace ${p.daysWaiting} día${p.daysWaiting === 1 ? '' : 's'}`}
                    </p>
                  </div>
                  <span className="text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lista de documentos en curso */}
        <div className="lg:col-span-2">
          <DataTable
            columns={columns}
            data={visibleItems}
            loading={loading}
            searchPlaceholder="🔍 Buscar por número, proveedor..."
            onRowClick={(r: any) => navigate(r.type === 'REQ' ? `/purchases/requisitions/${r.id}` : `/purchases/${r.id}`)}
            emptyIcon="🛒"
            emptyMessage={activeStage === 'ALL' ? 'No hay compras en curso. Inicia una con "+ Iniciar compra".' : 'No hay documentos en esta etapa.'}
            pageSize={8}
          />
        </div>
      </div>
    </div>
  );
}
