import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { DataTable } from '../components/ui/DataTable';
import { useToast } from '../components/ui/Toast';
import { Palette, ShoppingCart, DollarSign, Package, Clock } from 'lucide-react';

interface Order {
  poNumber: string;
  supplier: string;
  status: 'DRAFT' | 'PENDING_L2' | 'APPROVED' | 'RECEIVED' | 'REJECTED';
  total: number;
  date: string;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT:      { label: 'Borrador',     cls: 'bg-surface-100 dark:bg-surface-700 text-surface-500' },
  PENDING_L2: { label: 'Pendiente L2', cls: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400' },
  APPROVED:   { label: 'Aprobada',     cls: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' },
  RECEIVED:   { label: 'Recibida',     cls: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' },
  REJECTED:   { label: 'Rechazada',    cls: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' },
};

const MOCK: Order[] = [
  { poNumber: 'OC-0001', supplier: 'Aceros del Pacífico', status: 'RECEIVED', total: 12450.5, date: '2026-05-02' },
  { poNumber: 'OC-0002', supplier: 'Distribuidora Andina', status: 'APPROVED', total: 3280.0, date: '2026-05-08' },
  { poNumber: 'OC-0003', supplier: 'Importadora Quito', status: 'PENDING_L2', total: 8740.25, date: '2026-05-11' },
  { poNumber: 'OC-0004', supplier: 'Suministros Sierra', status: 'DRAFT', total: 540.0, date: '2026-05-12' },
  { poNumber: 'OC-0005', supplier: 'Ferretería Central', status: 'REJECTED', total: 21500.0, date: '2026-05-14' },
  { poNumber: 'OC-0006', supplier: 'Aceros del Pacífico', status: 'APPROVED', total: 67200.0, date: '2026-05-18' },
  { poNumber: 'OC-0007', supplier: 'TecnoInsumos', status: 'RECEIVED', total: 1890.75, date: '2026-05-20' },
  { poNumber: 'OC-0008', supplier: 'Distribuidora Andina', status: 'PENDING_L2', total: 4320.0, date: '2026-05-22' },
  { poNumber: 'OC-0009', supplier: 'Importadora Quito', status: 'RECEIVED', total: 9650.0, date: '2026-05-25' },
  { poNumber: 'OC-0010', supplier: 'Suministros Sierra', status: 'APPROVED', total: 2100.0, date: '2026-05-28' },
  { poNumber: 'OC-0011', supplier: 'Ferretería Central', status: 'DRAFT', total: 780.0, date: '2026-05-30' },
  { poNumber: 'OC-0012', supplier: 'TecnoInsumos', status: 'RECEIVED', total: 15400.0, date: '2026-06-01' },
];

export default function UiKitShowcase() {
  const toast = useToast();
  const columns = useMemo<ColumnDef<Order, any>[]>(() => [
    { accessorKey: 'poNumber', header: 'Orden', cell: (c) => <span className="font-mono font-medium">{c.getValue()}</span> },
    { accessorKey: 'supplier', header: 'Proveedor' },
    {
      accessorKey: 'status', header: 'Estado',
      cell: (c) => {
        const s = STATUS[c.getValue() as string];
        return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
      },
    },
    {
      accessorKey: 'total', header: 'Total',
      cell: (c) => <span className="font-mono">${Number(c.getValue()).toLocaleString('es', { minimumFractionDigits: 2 })}</span>,
    },
    {
      accessorKey: 'date', header: 'Fecha',
      cell: (c) => new Date(c.getValue() as string).toLocaleDateString('es-EC'),
    },
  ], []);

  const totalMonto = MOCK.reduce((s, o) => s + o.total, 0);
  const recibidas = MOCK.filter((o) => o.status === 'RECEIVED').length;
  const pendientes = MOCK.filter((o) => o.status.startsWith('PENDING')).length;

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 p-6">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="UI Kit — DataTable"
          subtitle="Componente de tabla reutilizable (TanStack) con orden, búsqueda y paginación"
          icon={<Palette className="w-5 h-5" />}
          actions={<button className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">+ Nueva Orden</button>}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Órdenes" value={MOCK.length} icon={<ShoppingCart className="w-5 h-5" />} color="brand" />
          <StatCard label="Monto total" value={`$${totalMonto.toLocaleString('es', { maximumFractionDigits: 0 })}`} icon={<DollarSign className="w-5 h-5" />} color="emerald" trend={{ value: '12% vs mes anterior', positive: true }} />
          <StatCard label="Recibidas" value={recibidas} icon={<Package className="w-5 h-5" />} color="blue" />
          <StatCard label="Pendientes" value={pendientes} icon={<Clock className="w-5 h-5" />} color="amber" />
        </div>

        <DataTable
          columns={columns}
          data={MOCK}
          searchPlaceholder="Buscar orden o proveedor..."
          pageSize={8}
          onRowClick={(row) => toast.info(`Orden ${row.poNumber} — ${row.supplier}`)}
          emptyMessage="No hay órdenes registradas."
        />
      </div>
    </div>
  );
}
