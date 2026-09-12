import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import { sriApi } from '../../api/sriDocuments';
import { DataTable } from '../../components/ui/DataTable';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../hooks/useConfirm';
import { PenLine } from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  PENDING_REVIEW: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  CONFIRMED: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  REJECTED: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
};
const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'Pendiente',
  CONFIRMED: 'Confirmado',
  REJECTED: 'Rechazado',
};

export default function SriDocumentsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirmAction = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>(null);
  const [tab, setTab] = useState<'ALL' | 'PENDING_REVIEW' | 'CONFIRMED' | 'REJECTED'>('ALL');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => {
    const status = tab === 'ALL' ? undefined : tab;
    Promise.all([sriApi.list(status), sriApi.kpis()]).then(([d, k]) => {
      setDocs(d.data);
      setKpis(k.data);
    });
  };

  useEffect(() => { load(); }, [tab]);

  const handleFile = async (file: File) => {
    if (!file) return;
    const allowed = ['application/pdf', 'application/xml', 'text/xml'];
    if (!allowed.includes(file.type) && !file.name.endsWith('.xml') && !file.name.endsWith('.pdf')) {
      setUploadError('Solo se permiten archivos PDF o XML');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const res = await sriApi.upload(file);
      navigate(`/sri/${res.data.document.id}`, { state: { possibleDuplicates: res.data.possibleDuplicates } });
    } catch (e: any) {
      setUploadError(e.response?.data?.error || 'Error al procesar el archivo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!await confirmAction({ title: 'Eliminar documento', message: '¿Eliminar este documento? Solo se puede eliminar si no está confirmado.', variant: 'danger' })) return;
    setDeletingId(id);
    try {
      await sriApi.delete(id);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const columns = useMemo<ColumnDef<any, any>[]>(() => [
    {
      accessorKey: 'numeroDoc',
      header: 'N° Comprobante',
      cell: ({ getValue }) => <span className="font-mono text-brand-600 dark:text-brand-400">{(getValue() as string) || '—'}</span>,
    },
    {
      id: 'emisor',
      accessorFn: (d) => `${d.razonSocialEmisor || ''} ${d.rucEmisor || ''}`,
      header: 'Emisor',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-sm text-surface-900 dark:text-white">{row.original.razonSocialEmisor}</div>
          <div className="text-surface-500 text-xs">{row.original.rucEmisor}</div>
        </div>
      ),
    },
    {
      accessorKey: 'fechaEmision',
      header: 'Fecha',
      cell: ({ getValue }) => <span className="text-surface-500 text-sm">{new Date(getValue() as string).toLocaleDateString('es')}</span>,
    },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ getValue }) => <span className="font-mono font-medium text-surface-900 dark:text-white">${Number(getValue()).toFixed(2)}</span>,
    },
    {
      accessorKey: 'iva',
      header: 'IVA',
      cell: ({ getValue }) => <span className="font-mono text-purple-600 dark:text-purple-400">${Number(getValue()).toFixed(2)}</span>,
    },
    {
      id: 'supplier',
      accessorFn: (d) => d.supplier?.name || '',
      header: 'Proveedor',
      cell: ({ row }) => row.original.supplier
        ? <span className="text-green-600 dark:text-green-400 text-sm">{row.original.supplier.name}</span>
        : <span className="text-surface-400 text-sm">Sin asignar</span>,
    },
    {
      id: 'oc',
      accessorFn: (d) => d.purchaseOrder?.poNumber || '',
      header: 'OC',
      cell: ({ row }) => row.original.purchaseOrder
        ? <span className="text-brand-600 dark:text-brand-400 text-sm">{row.original.purchaseOrder.poNumber}</span>
        : <span className="text-surface-400 text-sm">—</span>,
    },
    {
      accessorKey: 'parseConfidence',
      header: 'Confianza',
      cell: ({ getValue }) => {
        const c = getValue() as number | null;
        if (c == null) return null;
        return <span className={`text-xs font-medium ${c >= 80 ? 'text-green-600 dark:text-green-400' : c >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>{c}%</span>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[s] || ''}`}>{STATUS_LABELS[s] || s}</span>;
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const doc = row.original;
        return (
          <div className="flex items-center gap-3 justify-end">
            <Link to={`/sri/${doc.id}`} onClick={(e) => e.stopPropagation()} className="text-brand-600 dark:text-brand-400 hover:underline text-sm whitespace-nowrap">Revisar →</Link>
            {doc.status !== 'CONFIRMED' && (
              <button onClick={(e) => { e.stopPropagation(); handleDelete(doc.id, e); }} disabled={deletingId === doc.id}
                className="text-red-500 hover:text-red-400 text-xs disabled:opacity-40" title="Eliminar documento">
                {deletingId === doc.id ? '...' : '🗑'}
              </button>
            )}
          </div>
        );
      },
    },
  ], [deletingId]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">📑</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Documentos SRI</h1>
            <p className="text-sm text-surface-500">Gestión de facturas electrónicas del SRI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/sri/new"
            className="inline-flex items-center gap-1.5 border border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <PenLine className="w-4 h-4" /> Registrar manualmente
          </Link>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {uploading ? 'Procesando...' : '+ Cargar Factura'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.xml" className="hidden" onChange={onFileChange} />
      </div>

      <div className="space-y-6">
        {uploadError && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            {uploadError}
          </div>
        )}

        {/* Zona de drop */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !uploading && fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
            ${dragging ? 'border-brand-400 bg-brand-50 dark:bg-brand-500/10' : 'border-surface-300 dark:border-surface-600 hover:border-surface-400 dark:hover:border-surface-500'}
            ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          {uploading ? (
            <div className="space-y-2">
              <div className="text-2xl">⚙️</div>
              <p className="text-brand-600 dark:text-brand-400 font-medium">Analizando documento SRI...</p>
              <p className="text-surface-500 text-sm">Extrayendo datos, buscando proveedor y OC correspondiente</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-3xl text-surface-400">📄</div>
              <p className="text-surface-700 dark:text-surface-300 font-medium">Arrastra tu factura SRI aquí</p>
              <p className="text-surface-500 text-sm">PDF (RIDE) o XML — máximo 10 MB</p>
              <p className="text-brand-600 dark:text-brand-400 text-xs mt-2">Extracción automática de datos, validación y match con OC</p>
              <p className="text-surface-400 text-xs mt-1">¿No tienes el PDF/XML? <Link to="/sri/new" onClick={(e) => e.stopPropagation()} className="text-brand-600 dark:text-brand-400 hover:underline">Regístrala manualmente →</Link></p>
            </div>
          )}
        </div>

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Docs', value: kpis.total, color: 'text-surface-900 dark:text-white' },
              { label: 'Pendientes', value: kpis.pendientes, color: 'text-yellow-600 dark:text-yellow-400' },
              { label: 'Confirmados', value: kpis.confirmados, color: 'text-green-600 dark:text-green-400' },
              { label: 'Rechazados', value: kpis.rechazados, color: 'text-red-600 dark:text-red-400' },
              { label: 'Total Compras', value: `$${kpis.totalCompras?.toFixed(2)}`, color: 'text-brand-600 dark:text-brand-400' },
              { label: 'IVA Crédito', value: `$${kpis.totalIVACreditoFiscal?.toFixed(2)}`, color: 'text-purple-600 dark:text-purple-400' },
            ].map((k) => (
              <div key={k.label} className="bg-white dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700 shadow-soft">
                <p className="text-surface-500 text-xs">{k.label}</p>
                <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['ALL', 'PENDING_REVIEW', 'CONFIRMED', 'REJECTED'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? 'bg-brand-500 text-white' : 'border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700'
              }`}
            >
              {t === 'ALL' ? 'Todos' : STATUS_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Tabla */}
        <DataTable
          columns={columns}
          data={docs}
          searchPlaceholder="🔍 Buscar por comprobante, emisor, RUC, proveedor, OC..."
          onRowClick={(doc) => navigate(`/sri/${doc.id}`)}
          emptyIcon="🧾"
          emptyMessage="No hay documentos. Carga tu primera factura SRI o regístrala manualmente."
        />
      </div>
    </div>
  );
}
