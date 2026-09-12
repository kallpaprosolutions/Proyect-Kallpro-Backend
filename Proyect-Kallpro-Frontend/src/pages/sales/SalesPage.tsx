import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { salesApi } from '../../api/sales';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../hooks/useConfirm';
import { ShoppingBag, TrendingUp, FileText, Users } from 'lucide-react';
import CollapsiblePanel from '../../components/ui/CollapsiblePanel';
import StatCard from '../../components/ui/StatCard';
import { KanbanBoard, KanbanColumnDef } from '../../components/kanban/KanbanBoard';

type Tab = 'orders' | 'quotations' | 'customers' | 'dashboard';
const VALID_TABS: Tab[] = ['orders', 'quotations', 'customers', 'dashboard'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:      { label: 'Borrador',    color: 'text-surface-600 dark:text-surface-400',   bg: 'bg-surface-100 dark:bg-surface-700/40' },
  CONFIRMED:  { label: 'Confirmado', color: 'text-blue-700 dark:text-blue-400',   bg: 'bg-blue-100 dark:bg-blue-900/30' },
  PICKING:    { label: 'Preparando', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  DISPATCHED: { label: 'Despachado', color: 'text-cyan-700 dark:text-cyan-400',   bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
  DELIVERED:  { label: 'Entregado',  color: 'text-green-700 dark:text-green-400',  bg: 'bg-green-100 dark:bg-green-900/30' },
  INVOICED:   { label: 'Facturado',  color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  CANCELLED:  { label: 'Cancelado',  color: 'text-red-700 dark:text-red-400',    bg: 'bg-red-100 dark:bg-red-900/30' },
  SENT:       { label: 'Enviada',    color: 'text-blue-700 dark:text-blue-400',   bg: 'bg-blue-100 dark:bg-blue-900/30' },
  ACCEPTED:   { label: 'Aceptada',   color: 'text-green-700 dark:text-green-400',  bg: 'bg-green-100 dark:bg-green-900/30' },
  REJECTED:   { label: 'Rechazada',  color: 'text-red-700 dark:text-red-400',    bg: 'bg-red-100 dark:bg-red-900/30' },
  EXPIRED:    { label: 'Expirada',   color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  PENDING_APPROVAL: { label: '⏳ Pendiente de aprobación', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'text-surface-600 dark:text-surface-400', bg: 'bg-surface-100 dark:bg-surface-700/40' };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color} ${cfg.bg}`}>{cfg.label}</span>;
}

// Columnas del kanban de Pedidos: solo son "droppable" DRAFT→CONFIRMED (sin datos extra) y
// CONFIRMED/PICKING→DISPATCHED (despacho total, mismo modal de confirmación que ya existía).
// El resto de estados los recalcula el backend automáticamente según cantidades despachadas/
// facturadas (`recalculateOrderStatus`) — arrastrar una tarjeta ahí sería simular una transición
// que el sistema no expone como endpoint manual, así que quedan de solo lectura.
const ORDER_KANBAN_COLUMNS: KanbanColumnDef[] = [
  { id: 'DRAFT', label: STATUS_CONFIG.DRAFT.label, droppable: false, hint: 'Estado inicial del pedido' },
  { id: 'CONFIRMED', label: STATUS_CONFIG.CONFIRMED.label },
  { id: 'PICKING', label: STATUS_CONFIG.PICKING.label, droppable: false, hint: 'Se asigna automáticamente al preparar el despacho' },
  { id: 'DISPATCHED', label: STATUS_CONFIG.DISPATCHED.label },
  { id: 'DELIVERED', label: STATUS_CONFIG.DELIVERED.label, droppable: false, hint: 'Se actualiza automáticamente según las cantidades entregadas' },
  { id: 'INVOICED', label: STATUS_CONFIG.INVOICED.label, droppable: false, hint: 'Se actualiza automáticamente al facturar' },
  { id: 'CANCELLED', label: STATUS_CONFIG.CANCELLED.label, droppable: false, hint: 'Cancelar pedidos aún no está disponible — pendiente de implementar' },
];

export default function SalesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(urlTab && VALID_TABS.includes(urlTab) ? urlTab : 'orders');

  useEffect(() => {
    if (urlTab && VALID_TABS.includes(urlTab) && urlTab !== tab) setTab(urlTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab]);
  const [orders, setOrders] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [ordersView, setOrdersView] = useState<'list' | 'kanban'>('list');

  const load = async () => {
    setLoading(true);
    try {
      const [ord, quo, cus, k] = await Promise.all([
        salesApi.getOrders(),
        salesApi.getQuotations(),
        salesApi.getCustomers(),
        salesApi.getKPIs(),
      ]);
      setOrders(ord.data);
      setQuotations(quo.data);
      setCustomers(cus.data);
      setKpis(k.data);
    } catch { /* noop */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  async function handleConfirm(orderId: string) {
    setActionLoading(orderId);
    try {
      await salesApi.confirmOrder(orderId);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al confirmar pedido');
    }
    setActionLoading(null);
  }

  async function handleDispatch(orderId: string) {
    const ok = await confirm({ title: 'Confirmar despacho', message: '¿Confirmar despacho? Se creará la factura automáticamente.', variant: 'default' });
    if (!ok) return;
    setActionLoading(orderId);
    try {
      await salesApi.dispatchOrder(orderId);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al despachar pedido');
    }
    setActionLoading(null);
  }

  async function handleApproveQuotation(quotationId: string) {
    setActionLoading(quotationId);
    try {
      await salesApi.approveQuotation(quotationId);
      toast.success('Cotización aprobada');
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al aprobar la cotización');
    }
    setActionLoading(null);
  }

  async function handleRejectQuotation(quotationId: string) {
    const reason = window.prompt('Motivo del rechazo:');
    if (!reason) return;
    setActionLoading(quotationId);
    try {
      await salesApi.rejectQuotation(quotationId, reason);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al rechazar la cotización');
    }
    setActionLoading(null);
  }

  async function handleApproveOrder(orderId: string) {
    setActionLoading(orderId);
    try {
      await salesApi.approveOrder(orderId);
      toast.success('Pedido aprobado');
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al aprobar el pedido');
    }
    setActionLoading(null);
  }

  async function handleRejectOrder(orderId: string) {
    const reason = window.prompt('Motivo del rechazo:');
    if (!reason) return;
    setActionLoading(orderId);
    try {
      await salesApi.rejectOrder(orderId, reason);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al rechazar el pedido');
    }
    setActionLoading(null);
  }

  async function handleConvertQuotation(quotationId: string) {
    setActionLoading(quotationId);
    try {
      const res = await salesApi.convertQuotation(quotationId);
      navigate(`/sales/orders/${res.data.id}`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al convertir cotización');
    }
    setActionLoading(null);
  }

  async function handleOrderKanbanMove(order: any, toColumnId: string) {
    if (order.status === 'DRAFT' && toColumnId === 'CONFIRMED') return handleConfirm(order.id);
    if ((order.status === 'CONFIRMED' || order.status === 'PICKING') && toColumnId === 'DISPATCHED') return handleDispatch(order.id);
    toast.error('Esa transición no está disponible arrastrando la tarjeta — ábrela desde el detalle del pedido.');
  }

  const filteredOrders = orders.filter(o =>
    o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    o.customer?.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredQuotations = quotations.filter(q =>
    q.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
    q.customer?.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.ruc || '').toLowerCase().includes(search.toLowerCase())
  );

  const money = (n: number) => `$${Number(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Dashboard colapsable */}
      {kpis && (
        <CollapsiblePanel id="sales-dashboard" title="Dashboard de Ventas" icon={ShoppingBag}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Ventas del mes" value={money(kpis.salesThisMonth ?? 0)} icon={<TrendingUp className="w-5 h-5" />} color="emerald" index={0} />
            <StatCard label="Pedidos" value={String(orders.length)} icon={<ShoppingBag className="w-5 h-5" />} color="brand" index={1} />
            <StatCard label="Cotizaciones" value={String(quotations.length)} icon={<FileText className="w-5 h-5" />} color="purple" index={2} />
            <StatCard label="Clientes" value={String(customers.length)} icon={<Users className="w-5 h-5" />} color="amber" index={3} />
          </div>
        </CollapsiblePanel>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-brand-600 dark:text-brand-400" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Ventas</h1>
            <p className="text-sm text-surface-500">Pedidos, cotizaciones y clientes</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link to="/ventas/rapida" className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-soft">
            ⚡ Venta rápida
          </Link>
          {tab === 'orders' && (
            <>
              <div className="flex bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg p-0.5">
                <button onClick={() => setOrdersView('list')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${ordersView === 'list' ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-white shadow-sm' : 'text-surface-500'}`}>
                  ☰ Lista
                </button>
                <button onClick={() => setOrdersView('kanban')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${ordersView === 'kanban' ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-white shadow-sm' : 'text-surface-500'}`}>
                  ▦ Kanban
                </button>
              </div>
              <Link to="/sales/orders/new" className="border border-surface-200 dark:border-surface-600 hover:border-surface-400 text-surface-600 dark:text-surface-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                + Nuevo Pedido
              </Link>
            </>
          )}
          {tab === 'quotations' && (
            <Link to="/sales/quotations/new" className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              + Nueva Cotización
            </Link>
          )}
          {tab === 'customers' && (
            <Link to="/sales/customers/new" className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              + Nuevo Cliente
            </Link>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-1 w-fit mb-6">
        {[
          { key: 'orders',     label: '📋 Pedidos' },
          { key: 'quotations', label: '📄 Cotizaciones' },
          { key: 'customers',  label: '👥 Clientes' },
          { key: 'dashboard',  label: '📊 Dashboard' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as Tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-brand-500 text-white' : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
            }`}>{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-surface-800 rounded-xl p-5 border border-surface-200 dark:border-surface-700 shadow-soft">
              <p className="text-surface-500 text-sm">Total Pedidos</p>
              <p className="text-3xl font-bold mt-1 text-surface-900 dark:text-white">{kpis?.totalOrders ?? 0}</p>
            </div>
            <div className="bg-white dark:bg-surface-800 rounded-xl p-5 border border-yellow-200 dark:border-yellow-800/50 shadow-soft">
              <p className="text-surface-500 text-sm">Pedidos Pendientes</p>
              <p className="text-3xl font-bold mt-1 text-yellow-600 dark:text-yellow-400">{kpis?.pendingOrders ?? 0}</p>
            </div>
            <div className="bg-white dark:bg-surface-800 rounded-xl p-5 border border-green-200 dark:border-green-800/50 shadow-soft">
              <p className="text-surface-500 text-sm">Ventas este Mes</p>
              <p className="text-3xl font-bold mt-1 text-green-600 dark:text-green-400">
                ${(kpis?.monthlyRevenue ?? 0).toLocaleString('es', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white dark:bg-surface-800 rounded-xl p-5 border border-surface-200 dark:border-surface-700 shadow-soft">
              <p className="text-surface-500 text-sm">Clientes Activos</p>
              <p className="text-3xl font-bold mt-1 text-surface-900 dark:text-white">{kpis?.totalCustomers ?? 0}</p>
            </div>
          </div>

          {/* Search */}
          {tab !== 'dashboard' && (
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Buscar ${tab === 'orders' ? 'pedidos' : tab === 'quotations' ? 'cotizaciones' : 'clientes'}...`}
              className="w-full mb-4 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          )}

          {/* ── PEDIDOS ── */}
          {tab === 'orders' && ordersView === 'kanban' && (
            <KanbanBoard
              columns={ORDER_KANBAN_COLUMNS}
              items={filteredOrders.filter((o) => ORDER_KANBAN_COLUMNS.some((c) => c.id === o.status))}
              getId={(o) => o.id}
              getColumnId={(o) => o.status}
              onMove={handleOrderKanbanMove}
              emptyLabel="Sin pedidos"
              renderCard={(order, isDragging) => (
                <div className={`bg-white dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700 p-3 shadow-sm cursor-grab active:cursor-grabbing ${isDragging ? 'shadow-lg ring-2 ring-brand-400' : ''}`}>
                  <p className="font-mono text-xs font-medium text-brand-600 dark:text-brand-400 mb-1">{order.orderNumber}</p>
                  <p className="text-sm font-medium text-surface-800 dark:text-white mb-1 line-clamp-2">{order.customer?.name}</p>
                  <p className="font-mono text-xs text-green-600 dark:text-green-400">
                    ${Number(order.total).toLocaleString('es', { minimumFractionDigits: 2 })}
                  </p>
                  <Link to={`/sales/orders/${order.id}`} onClick={(e) => e.stopPropagation()}
                    className="block mt-2 text-xs text-brand-500 hover:text-brand-700 dark:hover:text-brand-300 font-medium">
                    Ver detalle →
                  </Link>
                </div>
              )}
            />
          )}
          {tab === 'orders' && ordersView === 'list' && (
            <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase border-b border-surface-200 dark:border-surface-700">
                    <th className="text-left px-4 py-3">PEDIDO</th>
                    <th className="text-left px-4 py-3">CLIENTE</th>
                    <th className="text-left px-4 py-3">ESTADO</th>
                    <th className="text-right px-4 py-3">TOTAL</th>
                    <th className="text-left px-4 py-3">FECHA</th>
                    <th className="text-right px-4 py-3">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {filteredOrders.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-12 text-surface-500">
                      No hay pedidos. <Link to="/sales/orders/new" className="text-brand-600 dark:text-brand-400 hover:underline">Crear el primero →</Link>
                    </td></tr>
                  )}
                  {filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30">
                      <td className="px-4 py-3">
                        <Link to={`/sales/orders/${order.id}`} className="text-brand-600 dark:text-brand-400 hover:underline font-mono font-medium">
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-surface-700 dark:text-surface-300">{order.customer?.name}</td>
                      <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-green-600 dark:text-green-400">
                        ${Number(order.total).toLocaleString('es', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-surface-500 text-xs">
                        {new Date(order.createdAt).toLocaleDateString('es')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          {order.status === 'PENDING_APPROVAL' && (
                            <>
                              <button
                                onClick={() => handleApproveOrder(order.id)}
                                disabled={actionLoading === order.id}
                                className="text-xs px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded-lg disabled:opacity-50"
                              >
                                {actionLoading === order.id ? '⏳' : '✓ Aprobar'}
                              </button>
                              <button
                                onClick={() => handleRejectOrder(order.id)}
                                disabled={actionLoading === order.id}
                                className="text-xs px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-50"
                              >
                                ✕ Rechazar
                              </button>
                            </>
                          )}
                          {order.status === 'DRAFT' && (
                            <button
                              onClick={() => handleConfirm(order.id)}
                              disabled={actionLoading === order.id}
                              className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50"
                            >
                              {actionLoading === order.id ? '⏳' : '✓ Confirmar'}
                            </button>
                          )}
                          {(order.status === 'CONFIRMED' || order.status === 'PICKING') && (
                            <button
                              onClick={() => handleDispatch(order.id)}
                              disabled={actionLoading === order.id}
                              className="text-xs px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:opacity-50"
                            >
                              {actionLoading === order.id ? '⏳' : '📤 Despachar'}
                            </button>
                          )}
                          <Link to={`/sales/orders/${order.id}`} className="text-xs px-3 py-1 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700">
                            Ver
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── COTIZACIONES ── */}
          {tab === 'quotations' && (
            <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase border-b border-surface-200 dark:border-surface-700">
                    <th className="text-left px-4 py-3">COTIZACIÓN</th>
                    <th className="text-left px-4 py-3">CLIENTE</th>
                    <th className="text-left px-4 py-3">ESTADO</th>
                    <th className="text-right px-4 py-3">TOTAL</th>
                    <th className="text-left px-4 py-3">VENCE</th>
                    <th className="text-right px-4 py-3">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {filteredQuotations.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-12 text-surface-500">
                      No hay cotizaciones. <Link to="/sales/quotations/new" className="text-purple-600 dark:text-purple-400 hover:underline">Crear la primera →</Link>
                    </td></tr>
                  )}
                  {filteredQuotations.map(q => (
                    <tr key={q.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30">
                      <td className="px-4 py-3 font-mono font-medium text-purple-600 dark:text-purple-400">{q.quoteNumber}</td>
                      <td className="px-4 py-3 text-surface-700 dark:text-surface-300">{q.customer?.name}</td>
                      <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-green-600 dark:text-green-400">
                        ${Number(q.total).toLocaleString('es', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-surface-500 text-xs">
                        {q.validUntil ? new Date(q.validUntil).toLocaleDateString('es') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {q.status === 'PENDING_APPROVAL' && (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleApproveQuotation(q.id)}
                              disabled={actionLoading === q.id}
                              className="text-xs px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded-lg disabled:opacity-50"
                            >
                              {actionLoading === q.id ? '⏳' : '✓ Aprobar'}
                            </button>
                            <button
                              onClick={() => handleRejectQuotation(q.id)}
                              disabled={actionLoading === q.id}
                              className="text-xs px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-50"
                            >
                              ✕ Rechazar
                            </button>
                          </div>
                        )}
                        {!q.salesOrder && q.status === 'DRAFT' && (
                          <button
                            onClick={() => handleConvertQuotation(q.id)}
                            disabled={actionLoading === q.id}
                            className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50"
                          >
                            {actionLoading === q.id ? '⏳' : '→ Pedido'}
                          </button>
                        )}
                        {q.salesOrder && (
                          <Link to={`/sales/orders/${q.salesOrder.id}`} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                            Ver pedido →
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── CLIENTES ── */}
          {tab === 'customers' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCustomers.length === 0 && (
                <div className="col-span-3 text-center py-16 text-surface-500">
                  No hay clientes. <Link to="/sales/customers/new" className="text-green-600 dark:text-green-400 hover:underline">Agregar el primero →</Link>
                </div>
              )}
              {filteredCustomers.map(c => (
                <div key={c.id} className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-5 shadow-soft hover:border-surface-300 dark:hover:border-surface-600 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-surface-900 dark:text-white font-semibold">{c.name}</h3>
                      {c.ruc && <p className="text-surface-500 text-xs mt-0.5">RUC: {c.ruc}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.isActive ? 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30' : 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30'}`}>
                      {c.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-surface-500">
                    {c.email && <p>📧 {c.email}</p>}
                    {c.phone && <p>📱 {c.phone}</p>}
                    {c.city && <p>📍 {c.city}</p>}
                  </div>
                  <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700 flex justify-between items-center">
                    <span className="text-xs text-surface-500">
                      Crédito: <span className="text-surface-900 dark:text-white">${Number(c.creditLimit).toFixed(0)}</span>
                    </span>
                    <Link to={`/sales/customers/${c.id}`} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                      Ver →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── DASHBOARD ── */}
          {tab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-5">
                <h3 className="font-semibold text-surface-900 dark:text-white mb-4">Top Clientes por Ventas</h3>
                {kpis?.topCustomers?.length > 0 ? (
                  <div className="space-y-3">
                    {kpis.topCustomers.map((tc: any, i: number) => (
                      <div key={tc.customerId} className="flex items-center gap-3">
                        <span className="text-surface-400 text-sm w-5">{i + 1}.</span>
                        <div className="flex-1">
                          <p className="text-surface-900 dark:text-white text-sm">{tc.customer?.name || 'Cliente'}</p>
                          <div className="h-1.5 bg-surface-100 dark:bg-surface-700 rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(100, (Number(tc._sum.total) / Number(kpis.topCustomers[0]._sum.total)) * 100)}%` }} />
                          </div>
                        </div>
                        <span className="text-green-600 dark:text-green-400 text-sm font-mono">
                          ${Number(tc._sum.total).toLocaleString('es', { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-surface-400 text-sm text-center py-8">Sin datos de ventas aún</p>
                )}
              </div>

              <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-5">
                <h3 className="font-semibold text-surface-900 dark:text-white mb-4">Estado de Pedidos</h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(
                    orders.reduce((acc: Record<string, number>, o) => {
                      acc[o.status] = (acc[o.status] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([status, count]) => {
                    const cfg = STATUS_CONFIG[status] || { label: status, color: 'text-surface-600 dark:text-surface-400', bg: 'bg-surface-100 dark:bg-surface-700/40' };
                    return (
                      <div key={status} className={`rounded-lg px-3 py-2.5 ${cfg.bg}`}>
                        <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
                        <p className="text-surface-900 dark:text-white text-2xl font-bold mt-0.5">{String(count)}</p>
                      </div>
                    );
                  })}
                  {orders.length === 0 && <p className="col-span-2 text-surface-400 text-sm text-center py-8">Sin pedidos aún</p>}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
