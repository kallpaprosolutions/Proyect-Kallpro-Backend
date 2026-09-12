import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { productionApi } from '../../api/production';
import { reportsApi } from '../../api/reports';
import QualityTab from '../../components/production/QualityTab';
import CollapsiblePanel from '../../components/ui/CollapsiblePanel';
import StatCard from '../../components/ui/StatCard';
import { Cog, PlayCircle, CheckCircle2, XCircle } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PLANNED:     { label: 'Planificada',  color: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' },
  IN_PROGRESS: { label: 'En Proceso',   color: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' },
  COMPLETED:   { label: 'Completada',   color: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' },
  CANCELLED:   { label: 'Cancelada',    color: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' },
};

type TabKey = 'orders' | 'bom' | 'quality';

export default function ProductionPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [tab, setTab] = useState<TabKey>('orders');
  const [filter, setFilter] = useState('');
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    const [o, b] = await Promise.all([productionApi.listOrders(), productionApi.listBOMs()]);
    setOrders(o.data);
    setBoms(b.data);
  };

  useEffect(() => { load(); }, []);

  const handleExcel = async () => {
    setExporting(true);
    try { await reportsApi.productionExcel(); } finally { setExporting(false); }
  };

  const filteredOrders = orders.filter((o) =>
    !filter || o.status === filter
  );

  const kpis = useMemo(() => {
    const planned = orders.filter(o => o.status === 'PLANNED').length;
    const inProgress = orders.filter(o => o.status === 'IN_PROGRESS').length;
    const completed = orders.filter(o => o.status === 'COMPLETED').length;
    const cancelled = orders.filter(o => o.status === 'CANCELLED').length;
    return { planned, inProgress, completed, cancelled };
  }, [orders]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Dashboard colapsable */}
      <CollapsiblePanel id="production-dashboard" title="Dashboard de Producción" icon={Cog} defaultOpen={true}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Planificadas" value={String(kpis.planned)} icon={<Cog className="w-5 h-5" />} color="brand" index={0} />
          <StatCard label="En proceso" value={String(kpis.inProgress)} icon={<PlayCircle className="w-5 h-5" />} color="amber" index={1} />
          <StatCard label="Completadas" value={String(kpis.completed)} icon={<CheckCircle2 className="w-5 h-5" />} color="emerald" index={2} />
          <StatCard label="Canceladas" value={String(kpis.cancelled)} icon={<XCircle className="w-5 h-5" />} color="red" index={3} />
        </div>
      </CollapsiblePanel>

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🔧</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Órdenes de Producción</h1>
            <p className="text-sm text-surface-500">{orders.length} órdenes registradas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExcel} disabled={exporting}
            className="text-xs px-3 py-1.5 bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-900/60 text-green-700 dark:text-green-400 rounded-lg transition-colors disabled:opacity-50">
            {exporting ? 'Exportando...' : '📊 Excel'}
          </button>
          <Link to="/production/orders/new"
            className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            + Nueva Orden
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-1 w-fit">
          {[
            { key: 'orders', label: '📋 Órdenes de Producción' },
            { key: 'bom', label: '🧩 Lista de Materiales (BOM)' },
            { key: 'quality', label: '🧪 Calidad' },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key as TabKey)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-brand-500 text-white' : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Calidad tab (Sprint 12 — ISO 9001 · ARCSA) */}
        {tab === 'quality' && <QualityTab />}

        {/* Orders tab */}
        {tab === 'orders' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex gap-2">
              {['', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => (
                <button key={s} onClick={() => setFilter(s)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${filter === s ? 'bg-brand-500 text-white' : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'}`}>
                  {s === '' ? 'Todas' : STATUS_CONFIG[s]?.label}
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
              {filteredOrders.length === 0 ? (
                <p className="text-center py-12 text-surface-500">No hay órdenes de producción.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase border-b border-surface-200 dark:border-surface-700">
                      <th className="text-left px-4 py-3">N° Orden</th>
                      <th className="text-left px-4 py-3">Producto</th>
                      <th className="text-left px-4 py-3">Bodega</th>
                      <th className="text-right px-4 py-3">Cantidad</th>
                      <th className="text-left px-4 py-3">Estado</th>
                      <th className="text-left px-4 py-3">Inicio Plan.</th>
                      <th className="text-left px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                    {filteredOrders.map((o) => {
                      const st = STATUS_CONFIG[o.status] || { label: o.status, color: 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400' };
                      return (
                        <tr key={o.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30">
                          <td className="px-4 py-3 font-mono text-brand-600 dark:text-brand-400">{o.poNumber}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-surface-900 dark:text-white">{o.product.name}</p>
                            {o.product.sku && <p className="text-xs text-surface-500">{o.product.sku}</p>}
                          </td>
                          <td className="px-4 py-3 text-surface-500">{o.warehouse.name}</td>
                          <td className="px-4 py-3 text-right font-mono text-surface-700 dark:text-surface-300">{Number(o.quantity)} {o.product.unit}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                          </td>
                          <td className="px-4 py-3 text-surface-500 text-xs">
                            {o.plannedStart ? new Date(o.plannedStart).toLocaleDateString('es') : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Link to={`/production/orders/${o.id}`}
                              className="text-xs px-3 py-1 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-400 rounded-lg transition-colors">
                              Ver →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* BOM tab */}
        {tab === 'bom' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-surface-500">{boms.length} listas de materiales registradas</p>
              <Link to="/production/bom/new"
                className="text-sm bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg transition-colors">
                + Nueva BOM
              </Link>
            </div>
            <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
              {boms.length === 0 ? (
                <p className="text-center py-12 text-surface-500">No hay listas de materiales. Crea la primera.</p>
              ) : boms.map((bom) => (
                <div key={bom.id} className="border-b border-surface-100 dark:border-surface-700 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-surface-900 dark:text-white">{bom.product.name}</p>
                        <span className="text-xs text-surface-500">v{bom.version}</span>
                        {bom.isActive
                          ? <span className="text-xs bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">Activa</span>
                          : <span className="text-xs bg-surface-100 dark:bg-surface-700 text-surface-500 px-1.5 py-0.5 rounded-full">Inactiva</span>
                        }
                      </div>
                      <p className="text-xs text-surface-500 mt-0.5">{bom.items.length} componentes</p>
                    </div>
                    <Link to={`/production/bom/${bom.id}`}
                      className="text-xs px-3 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-400 rounded-lg transition-colors">
                      Ver →
                    </Link>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {bom.items.slice(0, 5).map((item: any) => (
                      <span key={item.id} className="text-xs bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 px-2 py-0.5 rounded-lg">
                        {item.component.name} × {Number(item.quantity)}
                      </span>
                    ))}
                    {bom.items.length > 5 && (
                      <span className="text-xs text-surface-500">+{bom.items.length - 5} más</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
