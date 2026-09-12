import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import { purchasesApi } from '../../api/purchases';
import { DataTable } from '../../components/ui/DataTable';

const PAYMENT_TERMS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'CONTADO', label: 'Contado' },
  { value: '15_DIAS', label: '15 días' },
  { value: '30_DIAS', label: '30 días' },
  { value: '60_DIAS', label: '60 días' },
  { value: '90_DIAS', label: '90 días' },
];

const KYC_FILTERS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'COMPLETE', label: '✓ KYC completo' },
  { value: 'PENDING', label: '⚠ KYC pendiente' },
];

export default function SuppliersPage() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [termsFilter, setTermsFilter] = useState('');
  const [kycFilter, setKycFilter] = useState('ALL');

  const load = () => {
    setLoadError('');
    setLoading(true);
    purchasesApi.getSuppliers()
      .then((r) => setSuppliers(r.data))
      .catch(() => setLoadError('No se pudo cargar proveedores. Verifica el backend.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  // Filtros estructurados (términos de pago + KYC). La búsqueda de texto la maneja el DataTable.
  const filtered = useMemo(() => {
    let list = suppliers.slice();
    if (termsFilter) list = list.filter((s) => s.paymentTerms === termsFilter);
    if (kycFilter === 'COMPLETE') list = list.filter((s) => !!s.kycCompletedAt);
    if (kycFilter === 'PENDING') list = list.filter((s) => !s.kycCompletedAt);
    return list;
  }, [suppliers, termsFilter, kycFilter]);

  const kycCompleteCount = suppliers.filter((s) => s.kycCompletedAt).length;

  const columns = useMemo<ColumnDef<any, any>[]>(() => [
    {
      id: 'name',
      accessorFn: (s) => s.razonSocial || s.name || '',
      header: 'Proveedor',
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-surface-800 dark:text-white">{s.razonSocial || s.name}</span>
              {s.personType && (
                <span className="text-[10px] bg-surface-100 dark:bg-surface-700 text-surface-500 px-1.5 py-0.5 rounded-full">
                  {s.personType === 'NATURAL' ? '👤 PN' : '🏢 PJ'}
                </span>
              )}
              {s.isPEP && (
                <span className="text-[10px] bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">PEP</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: 'contacto',
      accessorFn: (s) => [s.ruc, s.email, s.phone, s.city].filter(Boolean).join(' '),
      header: 'Contacto',
      cell: ({ row }) => {
        const s = row.original;
        const txt = [s.ruc, s.email, s.phone, s.city].filter(Boolean).join(' · ');
        return <span className="text-surface-500">{txt || 'Sin datos de contacto'}</span>;
      },
    },
    {
      accessorKey: 'paymentTerms',
      header: 'Pago',
      cell: ({ getValue }) => {
        const v = getValue() as string | undefined;
        return v
          ? <span className="text-xs bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 px-2 py-1 rounded-full whitespace-nowrap">💳 {v.replace('_', ' ')}</span>
          : <span className="text-surface-300">—</span>;
      },
    },
    {
      id: 'kyc',
      accessorFn: (s) => (s.kycCompletedAt ? 'completo' : 'pendiente'),
      header: 'KYC UAFE',
      cell: ({ row }) => row.original.kycCompletedAt
        ? <span className="text-[10px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">✓ Completo</span>
        : <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">⚠ Pendiente</span>,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="flex items-center gap-2 justify-end flex-shrink-0">
            {!s.kycCompletedAt && (
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/purchases/suppliers/${s.id}/edit`); }}
                className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/60 font-medium">
                Completar KYC
              </button>
            )}
            <span className="text-brand-500 text-sm font-medium whitespace-nowrap">Ver →</span>
          </div>
        );
      },
    },
  ], [navigate]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🏭</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Proveedores</h1>
            <p className="text-sm text-surface-500">
              {filtered.length} de {suppliers.length} proveedores · {kycCompleteCount} con KYC UAFE completo
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/purchases/suppliers/ranking" className="text-sm px-4 py-2 border border-surface-200 dark:border-surface-600 hover:border-surface-400 text-surface-600 dark:text-surface-300 rounded-lg font-medium transition-colors">
            🏅 Ranking
          </Link>
          <Link to="/purchases/suppliers/new"
            className="text-sm px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors">
            + Nuevo Proveedor (UAFE)
          </Link>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          <span className="text-red-500 text-lg">⚠️</span>
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{loadError}</p>
          <button onClick={load} className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline flex-shrink-0">Reintentar</button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        searchPlaceholder="🔍 Buscar por nombre, email, ciudad, RUC..."
        onRowClick={(s) => navigate(`/purchases/suppliers/${s.id}`)}
        emptyIcon="🏭"
        emptyMessage={suppliers.length === 0 ? 'No hay proveedores. Crea el primero.' : 'Sin proveedores que coincidan con los filtros.'}
        toolbar={
          <div className="flex gap-2 flex-wrap">
            <select value={termsFilter} onChange={(e) => setTermsFilter(e.target.value)}
              className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-700 dark:text-white">
              {PAYMENT_TERMS_OPTIONS.map((o) => <option key={o.value} value={o.value}>Pago: {o.label}</option>)}
            </select>
            <select value={kycFilter} onChange={(e) => setKycFilter(e.target.value)}
              className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-700 dark:text-white">
              {KYC_FILTERS.map((o) => <option key={o.value} value={o.value}>KYC: {o.label}</option>)}
            </select>
          </div>
        }
      />
    </div>
  );
}
