import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productionApi } from '../../api/production';
import QualityPanel from '../../components/production/QualityPanel';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../hooks/useConfirm';

const STATUS_CONFIG: Record<string, { label: string; color: string; next?: string }> = {
  PLANNED:     { label: 'Planificada',  color: 'text-blue-600 dark:text-blue-400',   next: 'Iniciar Producción' },
  IN_PROGRESS: { label: 'En Proceso',   color: 'text-yellow-600 dark:text-yellow-400', next: 'Completar' },
  COMPLETED:   { label: 'Completada',   color: 'text-green-600 dark:text-green-400' },
  CANCELLED:   { label: 'Cancelada',    color: 'text-red-600 dark:text-red-400' },
};

export default function ProductionOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const confirmAction = useConfirm();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    productionApi.getOrder(id!).then((r) => setOrder(r.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, [id]);

  const handleAction = async () => {
    setError(''); setActionLoading(true);
    try {
      if (order.status === 'PLANNED') {
        await productionApi.startOrder(id!);
      } else if (order.status === 'IN_PROGRESS') {
        if (!await confirmAction({ title: 'Completar producción', message: '¿Confirmar producción completada? Se registrarán movimientos de inventario.' })) return;
        await productionApi.completeOrder(id!);
      }
      load();
    } catch (err: any) {
      const detail = err.response?.data?.shortages?.join('\n') || err.response?.data?.error || 'Error';
      setError(detail);
    } finally { setActionLoading(false); }
  };

  const handleCancel = async () => {
    if (!await confirmAction({ title: 'Cancelar orden', message: '¿Cancelar esta orden de producción?', variant: 'danger' })) return;
    try {
      await productionApi.cancelOrder(id!);
      navigate('/production');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al cancelar');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );
  if (!order) return null;

  const st = STATUS_CONFIG[order.status] || { label: order.status, color: 'text-surface-500' };
  const progress = order.quantity > 0 ? (Number(order.quantityDone) / Number(order.quantity)) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🔧</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">{order.poNumber}</h1>
            <p className={`text-sm font-semibold ${st.color}`}>{st.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {st.next && (
            <button onClick={handleAction} disabled={actionLoading}
              className="bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {actionLoading ? 'Procesando...' : st.next}
            </button>
          )}
          {(order.status === 'PLANNED' || order.status === 'IN_PROGRESS') && (
            <button onClick={handleCancel}
              className="px-4 py-2 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors">
              Cancelar Orden
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm whitespace-pre-line">
            ⚠️ {error}
          </div>
        )}

        {/* Info cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700 shadow-soft">
            <p className="text-surface-500 text-sm">Producto</p>
            <p className="font-semibold mt-1 text-surface-900 dark:text-white">{order.product.name}</p>
            {order.product.sku && <p className="text-xs text-surface-500">{order.product.sku}</p>}
          </div>
          <div className="bg-white dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700 shadow-soft">
            <p className="text-surface-500 text-sm">Bodega</p>
            <p className="font-semibold mt-1 text-surface-900 dark:text-white">{order.warehouse.name}</p>
          </div>
          <div className="bg-white dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700 shadow-soft">
            <p className="text-surface-500 text-sm">Cantidad a Producir</p>
            <p className="text-2xl font-bold mt-1 text-surface-900 dark:text-white">{Number(order.quantity)} <span className="text-sm text-surface-500">{order.product.unit}</span></p>
          </div>
          <div className="bg-white dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700 shadow-soft">
            <p className="text-surface-500 text-sm">Progreso</p>
            <p className="text-2xl font-bold mt-1 text-surface-900 dark:text-white">{progress.toFixed(0)}%</p>
            <div className="mt-2 h-1.5 bg-surface-100 dark:bg-surface-700 rounded-full">
              <div className="h-1.5 bg-brand-500 rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            { label: 'Inicio Planeado', val: order.plannedStart },
            { label: 'Fin Planeado',    val: order.plannedEnd },
            { label: 'Inicio Real',     val: order.actualStart },
            { label: 'Fin Real',        val: order.actualEnd },
          ].map(({ label, val }) => (
            <div key={label}>
              <p className="text-surface-500 text-xs">{label}</p>
              <p className="font-medium mt-0.5 text-surface-900 dark:text-white">{val ? new Date(val).toLocaleDateString('es') : '—'}</p>
            </div>
          ))}
        </div>

        {/* Calidad, lote y trazabilidad (Sprint 12 — ISO 9001 · ARCSA) */}
        <QualityPanel order={order} onChanged={load} />

        {/* Componentes */}
        {order.items.length > 0 && (
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700">
              <h2 className="font-semibold text-surface-900 dark:text-white">Componentes Requeridos</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left px-4 py-3">Componente</th>
                  <th className="text-right px-4 py-3">Requerido</th>
                  <th className="text-right px-4 py-3">Consumido</th>
                  <th className="text-center px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {order.items.map((item: any) => {
                  const done = Number(item.consumedQty) >= Number(item.requiredQty);
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-surface-900 dark:text-white">{item.component.name}</p>
                        {item.component.sku && <p className="text-xs text-surface-500">{item.component.sku}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-surface-700 dark:text-surface-300">
                        {Number(item.requiredQty).toFixed(2)} {item.component.unit}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-surface-700 dark:text-surface-300">
                        {Number(item.consumedQty).toFixed(2)} {item.component.unit}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {done
                          ? <span className="text-xs bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">✓ OK</span>
                          : <span className="text-xs bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full">Pendiente</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {order.notes && (
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-5">
            <p className="text-sm text-surface-600 dark:text-surface-400 font-medium mb-1">Notas</p>
            <p className="text-sm text-surface-700 dark:text-surface-300">{order.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
