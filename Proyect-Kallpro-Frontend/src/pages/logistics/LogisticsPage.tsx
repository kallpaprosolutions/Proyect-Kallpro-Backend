import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import { logisticsApi, SHIPMENT_STATUS_META } from '../../api/logistics';
import { DataTable } from '../../components/ui/DataTable';
import CollapsiblePanel from '../../components/ui/CollapsiblePanel';
import StatCard from '../../components/ui/StatCard';
import { Truck, PackageCheck, PackageX, Clock } from 'lucide-react';

/**
 * Logística — seguimiento de envíos de ventas (salientes) y compras (entrantes),
 * estilo courier. La lista se refresca sola cada 30 s (polling).
 */

const POLL_MS = 30_000;

export default function LogisticsPage() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'ALL' | 'SALES' | 'PURCHASE'>('ALL');
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = (silent = false) => {
    if (!silent) { setLoading(true); setError(''); }
    Promise.all([
      logisticsApi.list(tab === 'ALL' ? undefined : { orderType: tab }),
      logisticsApi.getKpis(),
    ])
      .then(([s, k]) => { setShipments(s.data); setKpis(k.data); setLastSync(new Date()); })
      .catch(() => { if (!silent) setError('No se pudo cargar logística. Verifica el backend.'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tab]);
  useEffect(() => {
    const t = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(t);
  }, [tab]);

  const columns = useMemo<ColumnDef<any, any>[]>(() => [
    {
      accessorKey: 'trackingNumber', header: 'Guía',
      cell: ({ row }) => (
        <div>
          <span className="font-mono font-medium text-brand-600 dark:text-brand-400">{row.original.trackingNumber}</span>
          {row.original.carrierGuide && <p className="text-xs text-surface-400 font-mono">{row.original.carrier}: {row.original.carrierGuide}</p>}
        </div>
      ),
    },
    {
      id: 'order', accessorFn: (s) => s.order?.number ?? '', header: 'Orden',
      cell: ({ row }) => (
        <div>
          <span className="font-mono text-sm">{row.original.order?.number ?? '—'}</span>
          <p className="text-xs text-surface-400">{row.original.orderType === 'SALES' ? '🎯 Venta' : '🛒 Compra'}</p>
        </div>
      ),
    },
    {
      id: 'party', accessorFn: (s) => s.recipientName ?? s.order?.party ?? '', header: 'Destinatario / Proveedor',
      cell: ({ getValue }) => <span className="text-surface-700 dark:text-surface-200">{(getValue() as string) || '—'}</span>,
    },
    {
      accessorKey: 'carrier', header: 'Courier',
      cell: ({ getValue }) => <span className="text-xs text-surface-500">{(getValue() as string) || 'Propio'}</span>,
    },
    {
      accessorKey: 'status', header: 'Estado',
      cell: ({ getValue }) => {
        const meta = SHIPMENT_STATUS_META[getValue() as string];
        return <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${meta?.tone ?? ''}`}>{meta?.icon} {meta?.label ?? getValue()}</span>;
      },
    },
    {
      id: 'lastEvent', accessorFn: (s) => s.lastEvent?.eventTime ?? '', header: 'Último evento',
      cell: ({ row }) => {
        const e = row.original.lastEvent;
        if (!e) return <span className="text-surface-400 text-xs">—</span>;
        return (
          <div className="text-xs text-surface-500">
            {new Date(e.eventTime).toLocaleDateString('es')} {new Date(e.eventTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
            {e.location && <p>📍 {e.location}</p>}
          </div>
        );
      },
    },
    {
      id: 'actions', header: '', enableSorting: false,
      cell: () => <span className="text-brand-500 text-sm font-medium whitespace-nowrap">Ver tracking →</span>,
    },
  ], []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🚚</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Logística</h1>
            <p className="text-sm text-surface-500">Seguimiento de envíos de ventas y compras en tiempo real</p>
          </div>
        </div>
        {lastSync && (
          <span className="text-xs text-surface-400">
            Actualizado {lastSync.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · refresco cada 30 s
            <button onClick={() => load()} className="ml-2 text-brand-500 hover:underline">↻ Actualizar</button>
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          <span className="text-red-500 text-lg">⚠️</span>
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button onClick={() => load()} className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline">Reintentar</button>
        </div>
      )}

      {/* Dashboard colapsable */}
      <CollapsiblePanel id="logistics-dashboard" title="Dashboard de Logística" icon={Truck}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="En tránsito" value={String(kpis?.inTransit ?? 0)} icon={<Truck className="w-5 h-5" />} color="brand" index={0} />
          <StatCard label="Por despachar" value={String(kpis?.pending ?? 0)} icon={<Clock className="w-5 h-5" />} color="purple" index={1} />
          <StatCard label="Entregados hoy" value={String(kpis?.deliveredToday ?? 0)} icon={<PackageCheck className="w-5 h-5" />} color="emerald" index={2} />
          <StatCard label="Fallidos" value={String(kpis?.failed ?? 0)} icon={<PackageX className="w-5 h-5" />} color="red" index={3} />
        </div>
      </CollapsiblePanel>

      {/* Tabs ventas/compras */}
      <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 rounded-lg p-1 w-fit">
        {([['ALL', 'Todos'], ['SALES', '🎯 Ventas'], ['PURCHASE', '🛒 Compras']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === key ? 'bg-brand-500 text-white' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={shipments}
        loading={loading}
        searchPlaceholder="🔍 Buscar por nº de guía, courier o destinatario…"
        onRowClick={(s: any) => navigate(`/logistica/${s.id}`)}
        emptyIcon="🚚"
        emptyMessage='No hay envíos aún. Crea una guía desde el detalle de un pedido de venta u orden de compra (card "Envío").'
        pageSize={10}
      />
    </div>
  );
}
