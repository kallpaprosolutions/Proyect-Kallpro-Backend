import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { financialApi } from '../../api/financial';

const STATUS_COLORS: Record<string, string> = {
  POSTED:   'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-300 dark:border-green-800',
  DRAFT:    'bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400 border-surface-300 dark:border-surface-600',
  REVERSED: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  POSTED: 'Contabilizado', DRAFT: 'Borrador', REVERSED: 'Reversado',
};

const ENTITY_LABELS: Record<string, string> = {
  PURCHASE_ORDER: 'Compra', SALES_ORDER: 'Venta', INVOICE: 'Factura',
  SRI_DOCUMENT: 'Retención', INVENTORY: 'Inventario', MANUAL: 'Manual', REVERSAL: 'Reversa',
  PAYROLL: 'Nómina', TREASURY: 'Tesorería',
};

export default function JournalEntriesPage() {
  // Los smart buttons (A4) llegan con ?entityType=…&entityId=… para ver los
  // asientos de UNA entidad concreta (OC, pedido o factura).
  const [searchParams, setSearchParams] = useSearchParams();
  const entityId = searchParams.get('entityId') ?? '';

  const [entries, setEntries]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter]     = useState({ entityType: searchParams.get('entityType') ?? '', from: '', to: '' });

  useEffect(() => { load(); }, [entityId]);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter.entityType) params.entityType = filter.entityType;
      if (entityId)          params.entityId   = entityId;
      if (filter.from) params.from = filter.from;
      if (filter.to)   params.to   = filter.to;
      const res = await financialApi.getJournalEntries(Object.keys(params).length ? params : undefined);
      setEntries(res.data);
    } catch {}
    setLoading(false);
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">📑</div>
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Asientos Contables</h1>
          <p className="text-sm text-surface-500">Registro GL de débitos y créditos</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Filters */}
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-soft p-4 flex gap-3 flex-wrap">
          <select
            value={filter.entityType}
            onChange={e => setFilter(f => ({ ...f, entityType: e.target.value }))}
            className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-3 py-2 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
          >
            <option value="">Todos los tipos</option>
            <option value="PURCHASE_ORDER">Órdenes de Compra</option>
            <option value="INVOICE">Facturas</option>
            <option value="INVENTORY">Inventario</option>
          </select>
          <input type="date" value={filter.from} onChange={e => setFilter(f => ({ ...f, from: e.target.value }))}
            className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-3 py-2 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
          <input type="date" value={filter.to} onChange={e => setFilter(f => ({ ...f, to: e.target.value }))}
            className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-3 py-2 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
          <button onClick={load} className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-xl font-medium transition-colors">Filtrar</button>
          {entityId && (
            <span className="flex items-center gap-2 px-3 py-2 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-700 rounded-xl text-sm text-brand-700 dark:text-brand-300">
              Asientos de un documento
              <button
                onClick={() => setSearchParams({})}
                className="text-brand-400 hover:text-brand-600 dark:hover:text-brand-200 font-bold"
                title="Quitar filtro"
              >
                ×
              </button>
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-surface-400 text-sm">Sin asientos contables</div>
        ) : (
          <div className="space-y-2">
            {entries.map(entry => (
              <div key={entry.id} className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-soft rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors text-left"
                >
                  <span className="text-xs font-mono text-brand-600 dark:text-brand-400 flex-shrink-0">{entry.entryNumber}</span>
                  <span className="text-xs text-surface-500">{new Date(entry.entryDate).toLocaleDateString('es-EC')}</span>
                  <span className="text-sm text-surface-900 dark:text-white flex-1 truncate">{entry.description}</span>
                  {entry.entityType && (
                    <span className="text-xs text-surface-500 bg-surface-100 dark:bg-surface-700 px-2 py-0.5 rounded-full">{ENTITY_LABELS[entry.entityType] ?? entry.entityType}</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[entry.status] ?? STATUS_COLORS.POSTED}`}>
                    {STATUS_LABELS[entry.status] ?? entry.status}
                  </span>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-mono text-green-600 dark:text-green-400">${Number(entry.totalDebit).toFixed(2)}</p>
                  </div>
                  <span className="text-surface-400">{expanded === entry.id ? '▲' : '▼'}</span>
                </button>

                {expanded === entry.id && (
                  <div className="border-t border-surface-100 dark:border-surface-700 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                          <th className="text-left px-5 py-2.5">Cuenta</th>
                          <th className="text-left px-4 py-2.5">Descripción</th>
                          <th className="text-right px-4 py-2.5">Débito</th>
                          <th className="text-right px-5 py-2.5">Crédito</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
                        {(entry.lines ?? []).map((line: any) => (
                          <tr key={line.id}>
                            <td className="px-5 py-2.5">
                              <span className="font-mono text-xs text-brand-600 dark:text-brand-400">{line.accountCode}</span>
                              <span className="ml-2 text-surface-700 dark:text-surface-300 text-xs">{line.accountName}</span>
                            </td>
                            <td className="px-4 py-2.5 text-surface-500 text-xs">{line.description ?? '—'}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-sm">
                              {Number(line.debit) > 0 ? (
                                <span className="text-blue-600 dark:text-blue-400">${Number(line.debit).toFixed(2)}</span>
                              ) : '—'}
                            </td>
                            <td className="px-5 py-2.5 text-right font-mono text-sm">
                              {Number(line.credit) > 0 ? (
                                <span className="text-green-600 dark:text-green-400">${Number(line.credit).toFixed(2)}</span>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50">
                          <td colSpan={2} className="px-5 py-2.5 text-xs text-surface-500 font-medium">TOTALES</td>
                          <td className="px-4 py-2.5 text-right font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                            ${Number(entry.totalDebit).toFixed(2)}
                          </td>
                          <td className="px-5 py-2.5 text-right font-mono text-sm font-bold text-green-600 dark:text-green-400">
                            ${Number(entry.totalCredit).toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
