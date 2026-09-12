import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import { purchasesApi } from '../../api/purchases';
import { inventoryApi } from '../../api/inventory';
import { DataTable } from '../../components/ui/DataTable';
import ProcurementDashboard from './ProcurementDashboard';
import { useToast } from '../../components/ui/Toast';
import CollapsiblePanel from '../../components/ui/CollapsiblePanel';
import StatCard from '../../components/ui/StatCard';
import { Compass, ShoppingCart, Clock, CheckCircle2 } from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  DRAFT:      'bg-surface-100 dark:bg-surface-700 text-surface-500',
  SUBMITTED:  'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  PENDING_L1: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400',
  PENDING_L2: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400',
  PENDING_L3: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400',
  PENDING_L4: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400',
  PENDING_L5: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400',
  APPROVED:   'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  PARTIAL:    'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400',
  RECEIVED:   'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  REJECTED:   'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  CANCELLED:  'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', SUBMITTED: 'Enviada',
  PENDING_L1: 'Aprob. N1', PENDING_L2: 'Aprob. N2', PENDING_L3: 'Aprob. N3', PENDING_L4: 'Aprob. N4', PENDING_L5: 'Aprob. N5',
  APPROVED: 'Aprobada', PARTIAL: 'Parcial', RECEIVED: 'Recibida', REJECTED: 'Rechazada', CANCELLED: 'Cancelada',
};
const STATUS_FILTERS = ['ALL', 'DRAFT', 'PENDING', 'APPROVED', 'PARTIAL', 'RECEIVED', 'REJECTED', 'CANCELLED'];

type Tab = 'orders' | 'analytics';

export default function PurchasesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('orders');

  // Filtros estructurados (estado + rango de fechas). El texto/orden/paginación los maneja el DataTable.
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Quick receive modal
  const [receiveTarget, setReceiveTarget] = useState<any | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [receiveLoading, setReceiveLoading] = useState(false);

  useEffect(() => { loadOrders(); }, []);

  function loadOrders() {
    setError('');
    setLoading(true);
    purchasesApi.getOrders()
      .then((r) => setOrders(r.data))
      .catch(() => setError('No se pudo conectar con el servidor. Verifica que el backend esté corriendo.'))
      .finally(() => setLoading(false));
  }

  function openReceiveModal(order: any) {
    setReceiveTarget(order);
    setSelectedWarehouse('');
    setReceiveQty({});
    if (warehouses.length === 0) {
      inventoryApi.getWarehouses().then((r) => setWarehouses(r.data)).catch(() => {});
    }
    // Cargar detalle (ítems con nombre de producto y cantidades recibidas)
    purchasesApi.getOrder(order.id).then((r) => {
      setReceiveTarget(r.data);
      const defaults: Record<string, string> = {};
      for (const it of r.data?.items || []) {
        const pending = (it.quantity ?? 0) - (it.receivedQuantity ?? 0);
        defaults[it.id] = String(Math.max(0, pending));
      }
      setReceiveQty(defaults);
    }).catch(() => {});
  }

  async function confirmReceive() {
    if (!receiveTarget || !selectedWarehouse) return;
    const lines = (receiveTarget.items || [])
      .map((it: any) => ({ itemId: it.id, quantity: Number(receiveQty[it.id] || 0) }))
      .filter((l: any) => l.quantity > 0);
    if (lines.length === 0) { toast.warning('Indica al menos una cantidad a recibir'); return; }
    setReceiveLoading(true);
    try {
      await purchasesApi.receiveOrder(receiveTarget.id, selectedWarehouse, lines);
      setReceiveTarget(null);
      loadOrders();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.response?.data?.message || 'No se pudo recibir la orden');
    } finally {
      setReceiveLoading(false);
    }
  }

  // Un estado cuenta como "pendiente de aprobación" si está enviado o en cualquier nivel L1..L5
  const isPendingApproval = (s: string) => s === 'SUBMITTED' || s.startsWith('PENDING_L');

  // Filtro estructural (estado + fechas). Búsqueda/orden/paginación → DataTable.
  const filtered = useMemo(() => {
    let list = orders.slice();
    if (statusFilter === 'PENDING') list = list.filter((o) => isPendingApproval(o.status));
    else if (statusFilter !== 'ALL') list = list.filter((o) => o.status === statusFilter);
    if (dateFrom) list = list.filter((o) => o.createdAt >= dateFrom);
    if (dateTo) list = list.filter((o) => o.createdAt <= dateTo + 'T23:59:59');
    return list;
  }, [orders, statusFilter, dateFrom, dateTo]);

  const statusCount = (s: string) =>
    s === 'ALL' ? orders.length
    : s === 'PENDING' ? orders.filter((o) => isPendingApproval(o.status)).length
    : orders.filter((o) => o.status === s).length;

  const totalPending = orders.filter((o) => ['DRAFT', 'APPROVED', 'PARTIAL'].includes(o.status) || isPendingApproval(o.status))
    .reduce((s, o) => s + Number(o.totalAmount), 0);

  const columns = useMemo<ColumnDef<any, any>[]>(() => [
    {
      accessorKey: 'poNumber',
      header: 'N° OC',
      cell: ({ getValue }) => <span className="font-mono font-medium text-brand-600 dark:text-brand-400">{getValue() as string}</span>,
    },
    {
      id: 'supplier',
      accessorFn: (o) => o.supplier?.name || '',
      header: 'Proveedor',
      cell: ({ row }) => <span className="text-surface-800 dark:text-white">{row.original.supplier?.name}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: 'Fecha',
      cell: ({ getValue }) => <span className="text-surface-500">{new Date(getValue() as string).toLocaleDateString('es')}</span>,
    },
    {
      accessorKey: 'deliveryDate',
      header: 'Entrega',
      cell: ({ getValue }) => <span className="text-surface-500">{getValue() ? new Date(getValue() as string).toLocaleDateString('es') : '—'}</span>,
    },
    {
      accessorKey: 'totalAmount',
      header: 'Total',
      cell: ({ getValue }) => <span className="font-mono text-surface-800 dark:text-white">${Number(getValue()).toLocaleString('es', { minimumFractionDigits: 2 })}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[s] || 'bg-surface-100 text-surface-500'}`}>{STATUS_LABELS[s] || s}</span>;
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const o = row.original;
        return (
          <div className="flex items-center gap-3 justify-end">
            {(o.status === 'APPROVED' || o.status === 'PARTIAL') && (
              <button onClick={(e) => { e.stopPropagation(); openReceiveModal(o); }}
                className="text-xs px-2 py-1 rounded bg-green-50 dark:bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/30 font-medium whitespace-nowrap">
                📦 {o.status === 'PARTIAL' ? 'Recibir resto' : 'Recibir'}
              </button>
            )}
            <span className="text-brand-500 text-sm font-medium whitespace-nowrap">Ver →</span>
          </div>
        );
      },
    },
  ], []);

  const pendingCount = orders.filter((o) => isPendingApproval(o.status)).length;
  const receivedCount = orders.filter((o) => o.status === 'RECEIVED').length;
  const money = (n: number) => `$${Number(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Dashboard colapsable */}
      <CollapsiblePanel id="purchases-dashboard" title="Dashboard de Compras" icon={Compass}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total OCs" value={String(orders.length)} icon={<ShoppingCart className="w-5 h-5" />} color="brand" index={0} />
          <StatCard label="Pendientes aprobación" value={String(pendingCount)} icon={<Clock className="w-5 h-5" />} color={pendingCount > 0 ? 'amber' : 'emerald'} index={1} />
          <StatCard label="Recibidas" value={String(receivedCount)} icon={<CheckCircle2 className="w-5 h-5" />} color="emerald" index={2} />
          <StatCard label="Monto pendiente" value={money(totalPending)} icon={<Compass className="w-5 h-5" />} color="purple" index={3} />
        </div>
      </CollapsiblePanel>

      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🛒</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Compras</h1>
            <p className="text-sm text-surface-500">Órdenes de compra y proveedores</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/approvals" className="text-sm px-4 py-2 border border-surface-200 dark:border-surface-600 hover:border-surface-400 dark:hover:border-surface-400 text-surface-600 dark:text-surface-300 rounded-lg font-medium transition-colors">
            📋 Aprobaciones
          </Link>
          <Link to="/purchases/requisitions" className="text-sm px-4 py-2 border border-surface-200 dark:border-surface-600 hover:border-surface-400 dark:hover:border-surface-400 text-surface-600 dark:text-surface-300 rounded-lg font-medium transition-colors">
            📄 Requisiciones
          </Link>
          <Link to="/purchases/analytics" className="text-sm px-4 py-2 border border-surface-200 dark:border-surface-600 hover:border-surface-400 dark:hover:border-surface-400 text-surface-600 dark:text-surface-300 rounded-lg font-medium transition-colors">
            📊 Analytics
          </Link>
          <Link to="/purchases/suppliers/ranking" className="text-sm px-4 py-2 border border-surface-200 dark:border-surface-600 hover:border-surface-400 dark:hover:border-surface-400 text-surface-600 dark:text-surface-300 rounded-lg font-medium transition-colors">
            🏅 Ranking
          </Link>
          <Link to="/purchases/suppliers" className="text-sm px-4 py-2 border border-surface-200 dark:border-surface-600 hover:border-surface-400 dark:hover:border-surface-400 text-surface-600 dark:text-surface-300 rounded-lg font-medium transition-colors">
            Proveedores
          </Link>
          <Link to="/purchases/new" className="text-sm px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors">
            + Nueva OC
          </Link>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          <span className="text-red-500 text-lg">⚠️</span>
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button onClick={loadOrders} className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline flex-shrink-0">
            Reintentar
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft mb-6 overflow-hidden">
        <div className="flex border-b border-surface-100 dark:border-surface-700 px-2">
          {([
            { key: 'orders',    label: '📦 Órdenes de Compra' },
            { key: 'analytics', label: '📊 Analytics' },
          ] as { key: Tab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'orders' && (
          <div className="p-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total OCs', value: orders.length, color: 'text-surface-800 dark:text-white' },
                { label: 'Pendientes', value: orders.filter((o) => o.status === 'APPROVED').length, color: 'text-yellow-600 dark:text-yellow-400' },
                { label: 'Recibidas', value: orders.filter((o) => o.status === 'RECEIVED').length, color: 'text-green-600 dark:text-green-400' },
                { label: 'Monto Pendiente', value: `$${totalPending.toLocaleString('es', { minimumFractionDigits: 2 })}`, color: 'text-brand-600 dark:text-brand-400', large: true },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-surface-50 dark:bg-surface-900/50 rounded-xl p-4 border border-surface-100 dark:border-surface-700">
                  <p className="text-surface-500 text-sm">{kpi.label}</p>
                  <p className={`${kpi.large ? 'text-xl' : 'text-3xl'} font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Status pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {STATUS_FILTERS.map((s) => {
                const active = statusFilter === s;
                const count = statusCount(s);
                const label = s === 'ALL' ? 'Todas' : s === 'PENDING' ? 'Por aprobar' : STATUS_LABELS[s];
                return (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      active
                        ? 'bg-brand-500 text-white shadow-soft'
                        : 'bg-surface-50 dark:bg-surface-900/50 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-700 hover:border-brand-300'
                    }`}>
                    {label}
                    <span className={`ml-1.5 ${active ? 'opacity-90' : 'opacity-60'}`}>({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Listado de órdenes (DataTable) */}
            <DataTable
              columns={columns}
              data={filtered}
              loading={loading}
              searchPlaceholder="🔍 Buscar por N° OC o proveedor..."
              onRowClick={(o) => navigate(`/purchases/${o.id}`)}
              emptyIcon="🛒"
              emptyMessage={orders.length === 0 ? 'No hay órdenes de compra. Crea la primera.' : 'No hay órdenes que coincidan con los filtros.'}
              toolbar={
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs text-surface-500">Desde</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-800 dark:text-white" />
                  <label className="text-xs text-surface-500">Hasta</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                    className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-800 dark:text-white" />
                  {(dateFrom || dateTo || statusFilter !== 'ALL') && (
                    <button onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter('ALL'); }}
                      className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-white underline">
                      Limpiar
                    </button>
                  )}
                </div>
              }
            />
          </div>
        )}

        {activeTab === 'analytics' && <ProcurementDashboard embedded />}
      </div>

      {/* Quick Receive Modal */}
      {receiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setReceiveTarget(null)}>
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-surface-100 dark:border-surface-700">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Recibir OC {receiveTarget.poNumber}</h3>
              <p className="text-sm text-surface-500 mt-1">Proveedor: {receiveTarget.supplier?.name} · Recepción parcial permitida</p>
            </div>
            <div className="p-5 space-y-4">
              {receiveTarget.items ? (
                <div className="overflow-x-auto rounded-lg border border-surface-100 dark:border-surface-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                        <th className="text-left px-3 py-2">Producto</th>
                        <th className="text-right px-3 py-2">Ordenado</th>
                        <th className="text-right px-3 py-2">Pendiente</th>
                        <th className="text-right px-3 py-2">Recibir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                      {receiveTarget.items.map((it: any) => {
                        const pending = (it.quantity ?? 0) - (it.receivedQuantity ?? 0);
                        return (
                          <tr key={it.id}>
                            <td className="px-3 py-2 text-surface-800 dark:text-white">{it.product?.name || 'Producto'}</td>
                            <td className="px-3 py-2 text-right font-mono text-surface-600 dark:text-surface-300">{it.quantity}</td>
                            <td className="px-3 py-2 text-right font-mono text-orange-600 dark:text-orange-400">{pending}</td>
                            <td className="px-3 py-2 text-right">
                              <input inputMode="numeric" value={receiveQty[it.id] ?? ''} disabled={pending <= 0}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/[^0-9]/g, '');
                                  const capped = raw === '' ? '' : String(Math.min(Number(raw), pending));
                                  setReceiveQty((q) => ({ ...q, [it.id]: capped }));
                                }}
                                className="w-20 text-right bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-40" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-surface-400">Cargando ítems...</p>
              )}
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Almacén destino</label>
                <select value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-4 py-2.5 text-sm text-surface-800 dark:text-white">
                  <option value="">Selecciona un almacén...</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
            <div className="p-5 border-t border-surface-100 dark:border-surface-700 flex justify-end gap-2">
              <button onClick={() => setReceiveTarget(null)} className="px-4 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:border-surface-400">
                Cancelar
              </button>
              <button onClick={confirmReceive} disabled={!selectedWarehouse || receiveLoading}
                className="px-4 py-2 text-sm rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                {receiveLoading ? 'Procesando...' : 'Confirmar recepción'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
