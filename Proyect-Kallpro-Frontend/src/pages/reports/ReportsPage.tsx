import { useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '../../api/reports';
import { useToast } from '../../components/ui/Toast';

interface ReportCard {
  id: string;
  icon: string;
  title: string;
  description: string;
  type: 'excel' | 'pdf-list';
  hasDateRange?: boolean;
  action: (from?: string, to?: string) => Promise<void> | void;
}

const REPORTS: ReportCard[] = [
  {
    id: 'inventory',
    icon: '📦',
    title: 'Inventario',
    description: 'Stock actual, costos, valoración y alertas por bodega',
    type: 'excel',
    action: () => reportsApi.inventoryExcel(),
  },
  {
    id: 'purchases',
    icon: '🛒',
    title: 'Compras',
    description: 'Órdenes de compra, proveedores, totales y estado',
    type: 'excel',
    hasDateRange: true,
    action: (f, t) => reportsApi.purchasesExcel(f, t),
  },
  {
    id: 'sales',
    icon: '💰',
    title: 'Ventas',
    description: 'Órdenes de venta, clientes y totales',
    type: 'excel',
    hasDateRange: true,
    action: (f, t) => reportsApi.salesExcel(f, t),
  },
  {
    id: 'suppliers',
    icon: '🏢',
    title: 'Proveedores',
    description: 'Ranking, scores, historial OCs y contactos',
    type: 'excel',
    action: () => reportsApi.suppliersExcel(),
  },
  {
    id: 'gl',
    icon: '📑',
    title: 'Asientos Contables (GL)',
    description: 'Todos los asientos DR/CR del período',
    type: 'excel',
    hasDateRange: true,
    action: (f, t) => reportsApi.glExcel(f, t),
  },
  {
    id: 'production',
    icon: '⚙️',
    title: 'Producción',
    description: 'Órdenes de producción, eficiencia y consumo',
    type: 'excel',
    hasDateRange: true,
    action: (f, t) => reportsApi.productionExcel(f, t),
  },
];

export default function ReportsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [dates, setDates] = useState<Record<string, { from: string; to: string }>>({});

  const handleDownload = async (card: ReportCard) => {
    setLoading((l) => ({ ...l, [card.id]: true }));
    try {
      const d = dates[card.id] || {};
      await card.action(d.from, d.to);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al generar reporte');
    } finally {
      setLoading((l) => ({ ...l, [card.id]: false }));
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">📊</div>
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Reportes</h1>
          <p className="text-sm text-surface-500">Genera reportes Excel de todas las áreas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((card) => (
          <div key={card.id} className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-5 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{card.icon}</span>
              <div>
                <p className="font-semibold text-surface-900 dark:text-white">{card.title}</p>
                <p className="text-xs text-surface-500 mt-0.5">{card.description}</p>
              </div>
            </div>

            {card.hasDateRange && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-surface-500 mb-0.5">Desde</label>
                  <input type="date"
                    value={dates[card.id]?.from || ''}
                    onChange={(e) => setDates((d) => ({ ...d, [card.id]: { ...d[card.id], from: e.target.value } }))}
                    className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs text-surface-500 mb-0.5">Hasta</label>
                  <input type="date"
                    value={dates[card.id]?.to || ''}
                    onChange={(e) => setDates((d) => ({ ...d, [card.id]: { ...d[card.id], to: e.target.value } }))}
                    className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
            )}

            <button
              onClick={() => handleDownload(card)}
              disabled={loading[card.id]}
              className="mt-auto w-full py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading[card.id] ? (
                <><span className="animate-spin">⏳</span> Generando...</>
              ) : (
                <><span>📊</span> Descargar Excel</>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* PDF section */}
      <div className="mt-8">
        <h2 className="font-semibold mb-4 text-surface-700 dark:text-surface-300">📄 PDFs de Documentos</h2>
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-5">
          <p className="text-sm text-surface-500">
            Los PDFs de Órdenes de Compra y Requisiciones están disponibles directamente en el detalle de cada documento
            (botón <strong className="text-surface-900 dark:text-white">📄 PDF</strong> en el header de la página).
          </p>
          <div className="mt-4 flex gap-3">
            <Link to="/purchases" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
              Ir a Compras →
            </Link>
            <Link to="/purchases/requisitions" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
              Ir a Requisiciones →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
