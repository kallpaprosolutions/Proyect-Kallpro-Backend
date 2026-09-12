import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { requisitionsApi } from '../../api/requisitions';

const LEVEL_TABS = [
  { key: 'PENDING_L1', label: 'Nivel 1',   color: 'text-brand-600 dark:text-brand-400',   dot: 'bg-cyan-500' },
  { key: 'PENDING_L2', label: 'Nivel 2',   color: 'text-yellow-400', dot: 'bg-yellow-500' },
  { key: 'PENDING_L3', label: 'Gerencia',  color: 'text-red-400',    dot: 'bg-red-500' },
  { key: 'HISTORY',    label: 'Historial', color: 'text-surface-500',   dot: 'bg-gray-500' },
];

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-900/50 text-red-400 border-red-800 dark:bg-red-900/50 dark:text-red-400 dark:border-red-800',
  HIGH:   'bg-orange-900/50 text-orange-400 border-orange-800 dark:bg-orange-900/50 dark:text-orange-400 dark:border-orange-800',
  NORMAL: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800',
  LOW:    'bg-surface-100 dark:bg-surface-700 text-surface-500 border-surface-200 dark:border-surface-600',
};

type SortKey = 'date' | 'amount' | 'priority' | 'sla';

function slaStyle(days: number) {
  if (days <= 2) return { color: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800', label: `${days}d`, pulse: false };
  if (days <= 5) return { color: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800', label: `${days}d`, pulse: false };
  return { color: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800', label: `${days}d`, pulse: true };
}

const PRIORITY_ORDER: Record<string, number> = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 };

export default function ApprovalDashboard() {
  const [activeTab, setActiveTab]   = useState('PENDING_L1');
  const [items, setItems]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [counts, setCounts]         = useState<Record<string, number>>({});
  const [approving, setApproving]   = useState('');
  const [rejectId, setRejectId]     = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [notes, setNotes]           = useState('');
  const [error, setError]           = useState('');

  // Nuevas: búsqueda, sort, bulk
  const [search, setSearch]         = useState('');
  const [sortKey, setSortKey]       = useState<SortKey>('sla');
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen]     = useState(false);
  const [bulkNotes, setBulkNotes]   = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ ok: number; fail: number } | null>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    setError('');
    const statuses = ['PENDING_L1', 'PENDING_L2', 'PENDING_L3', 'APPROVED', 'REJECTED'];
    const results = await Promise.allSettled(statuses.map(s => requisitionsApi.getAll(s)));
    const allFailed = results.every(r => r.status === 'rejected');
    if (allFailed) {
      setError('No se pudo conectar al servidor. Verifica que el backend esté en línea.');
      setLoading(false);
      return;
    }
    const countMap: Record<string, number> = {};
    statuses.forEach((s, i) => {
      const r = results[i];
      if (r.status === 'fulfilled') countMap[s] = r.value.data.length;
    });
    setCounts(countMap);
    setLoading(false);
    await loadTab(activeTab);
  }

  async function loadTab(tab: string) {
    setLoading(true);
    setItems([]);
    setSelected(new Set());
    const statuses = tab === 'HISTORY'
      ? ['APPROVED', 'REJECTED', 'PO_CREATED', 'QUOTED']
      : [tab];

    const results = await Promise.allSettled(statuses.map(s => requisitionsApi.getAll(s)));
    const allFailed = results.every(r => r.status === 'rejected');
    if (allFailed) {
      setError('No se pudo conectar al servidor. Verifica que el backend esté en línea.');
      setLoading(false);
      return;
    }
    const all: any[] = [];
    results.forEach(r => { if (r.status === 'fulfilled') all.push(...r.value.data); });
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setItems(all);
    setLoading(false);
  }

  async function handleApprove(id: string, level: number) {
    setApproving(id);
    setError('');
    try {
      await requisitionsApi.approve(id, level, notes || undefined);
      setNotes('');
      await loadAll();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al aprobar');
    }
    setApproving('');
  }

  async function handleReject() {
    if (!rejectId || !rejectReason.trim()) return;
    setError('');
    try {
      await requisitionsApi.reject(rejectId, rejectReason);
      setRejectId('');
      setRejectReason('');
      await loadAll();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al rechazar');
    }
  }

  function approvalLevel(status: string) {
    if (status === 'PENDING_L1') return 1;
    if (status === 'PENDING_L2') return 2;
    if (status === 'PENDING_L3') return 3;
    return 0;
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function runBulkApprove() {
    setBulkRunning(true);
    setError('');
    const targets = items.filter((i) => selected.has(i.id) && approvalLevel(i.status) > 0);
    const promises = targets.map((i) => requisitionsApi.approve(i.id, approvalLevel(i.status), bulkNotes || undefined));
    const results = await Promise.allSettled(promises);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fail = results.length - ok;
    setBulkResult({ ok, fail });
    setBulkRunning(false);
    setSelected(new Set());
    setBulkNotes('');
    await loadAll();
    setTimeout(() => { setBulkResult(null); setBulkOpen(false); }, 2500);
  }

  const filteredItems = useMemo(() => {
    let list = items.slice();
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        (r.reqNumber || '').toLowerCase().includes(q) ||
        (r.title || '').toLowerCase().includes(q) ||
        (r.department?.name || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const ad = Math.floor((Date.now() - new Date(a.createdAt).getTime()) / 86400000);
      const bd = Math.floor((Date.now() - new Date(b.createdAt).getTime()) / 86400000);
      switch (sortKey) {
        case 'amount':   return Number(b.totalEstimated || 0) - Number(a.totalEstimated || 0);
        case 'priority': return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
        case 'sla':      return bd - ad;
        default:         return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return list;
  }, [items, search, sortKey]);

  const selectablePending = filteredItems.filter((r) => approvalLevel(r.status) > 0);
  const allSelected = selectablePending.length > 0 && selectablePending.every((r) => selected.has(r.id));

  function toggleSelectAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectablePending.map((r) => r.id)));
  }

  const pendingTotal = (counts['PENDING_L1'] ?? 0) + (counts['PENDING_L2'] ?? 0) + (counts['PENDING_L3'] ?? 0);
  const isHistory = activeTab === 'HISTORY';

  return (
    <div className="max-w-7xl mx-auto pb-24">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">✅</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">
              Aprobaciones
              {pendingTotal > 0 && (
                <span className="ml-2 text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">{pendingTotal}</span>
              )}
            </h1>
            <p className="text-sm text-surface-500">Bandeja de aprobaciones de requisiciones</p>
          </div>
        </div>
        <Link to="/purchases" className="text-sm px-4 py-2 border border-surface-200 dark:border-surface-600 hover:border-surface-400 text-surface-600 dark:text-surface-300 rounded-lg font-medium transition-colors">
          ← Volver a Compras
        </Link>
      </div>

      <div className="max-w-5xl">
        {error && (
          <div className="mb-4 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
            <span className="text-red-500 text-lg">⚠️</span>
            <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
            <button onClick={() => { setError(''); loadAll(); }} className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline flex-shrink-0">
              Reintentar
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-1 mb-4">
          {LEVEL_TABS.map(tab => {
            const count = tab.key === 'HISTORY'
              ? (counts['APPROVED'] ?? 0) + (counts['REJECTED'] ?? 0) + (counts['PO_CREATED'] ?? 0)
              : counts[tab.key] ?? 0;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); loadTab(tab.key); }}
                className={`flex-1 py-2.5 text-sm rounded-lg font-medium transition-colors flex items-center justify-center gap-2
                  ${activeTab === tab.key ? 'bg-surface-100 dark:bg-surface-700 text-surface-900 dark:text-white' : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-300'}`}
              >
                <span className={`w-2 h-2 rounded-full ${tab.dot}`} />
                {tab.label}
                {count > 0 && (
                  <span className="text-xs bg-surface-200 dark:bg-surface-600 px-1.5 py-0.5 rounded-full">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Toolbar: search + sort + bulk */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Buscar por código, título o departamento..."
            className="flex-1 min-w-[240px] bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-4 py-2 text-sm text-surface-800 dark:text-white placeholder:text-surface-400 focus:outline-none focus:border-brand-500"
          />
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-700 dark:text-white">
            <option value="sla">Ordenar: SLA (más antiguo)</option>
            <option value="priority">Ordenar: Prioridad</option>
            <option value="amount">Ordenar: Monto</option>
            <option value="date">Ordenar: Fecha</option>
          </select>
          {!isHistory && selectablePending.length > 0 && (
            <button onClick={toggleSelectAll}
              className="text-sm px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-lg text-surface-600 dark:text-surface-300 hover:border-brand-400">
              {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
          )}
        </div>

        {/* Reject modal */}
        {rejectId && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-surface-800 border border-red-800 rounded-2xl p-6 w-full max-w-md">
              <h3 className="font-semibold text-red-400 mb-3">Rechazar Requisición</h3>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Motivo del rechazo (requerido)..."
                rows={3}
                className="w-full bg-surface-100 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-xl px-3 py-2.5 text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none"
              />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setRejectId('')} className="flex-1 py-2.5 border border-surface-200 dark:border-surface-600 text-surface-500 rounded-xl text-sm hover:border-surface-400 dark:hover:border-surface-500">Cancelar</button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim()}
                  className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  Confirmar Rechazo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk approve modal */}
        {bulkOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !bulkRunning && setBulkOpen(false)}>
            <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold text-surface-900 dark:text-white mb-1">Aprobar en lote</h3>
              <p className="text-sm text-surface-500 mb-4">
                Se aprobarán <strong>{selected.size}</strong> requisición{selected.size !== 1 ? 'es' : ''} pendientes en su nivel correspondiente.
              </p>
              {bulkResult ? (
                <div className={`p-4 rounded-xl border ${bulkResult.fail === 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'}`}>
                  <p className="text-sm">
                    ✅ <strong>{bulkResult.ok}</strong> aprobada(s)
                    {bulkResult.fail > 0 && <span className="ml-2">⚠️ <strong>{bulkResult.fail}</strong> con error</span>}
                  </p>
                </div>
              ) : (
                <>
                  <textarea
                    value={bulkNotes}
                    onChange={(e) => setBulkNotes(e.target.value)}
                    placeholder="Notas (opcional, aplicará a todas)..."
                    rows={3}
                    className="w-full bg-surface-100 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-xl px-3 py-2.5 text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none"
                  />
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => setBulkOpen(false)} disabled={bulkRunning} className="flex-1 py-2.5 border border-surface-200 dark:border-surface-600 text-surface-500 rounded-xl text-sm hover:border-surface-400 disabled:opacity-50">Cancelar</button>
                    <button onClick={runBulkApprove} disabled={bulkRunning}
                      className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                      {bulkRunning ? 'Procesando...' : `✓ Aprobar ${selected.size}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Items list */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-surface-500">Cargando...</div>
        ) : filteredItems.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-surface-400 text-sm">
            {items.length === 0
              ? (isHistory ? 'Sin historial reciente' : '✓ Sin pendientes en este nivel')
              : 'No hay resultados para la búsqueda actual'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map(req => {
              const daysWaiting = Math.floor((Date.now() - new Date(req.createdAt).getTime()) / 86400000);
              const level       = approvalLevel(req.status);
              const isPending   = level > 0;
              const sla = slaStyle(daysWaiting);
              const isSelected = selected.has(req.id);

              return (
                <div key={req.id} className={`bg-white dark:bg-surface-800 border rounded-2xl p-5 transition-colors ${
                  req.status === 'REJECTED' ? 'border-red-900/60'
                  : isSelected ? 'border-brand-500 ring-2 ring-brand-500/30'
                  : isPending ? 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                  : 'border-surface-200/50 dark:border-surface-700/50'
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {isPending && (
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelected(req.id)}
                          className="mt-1 w-4 h-4 accent-brand-500" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-brand-600 dark:text-brand-400">{req.reqNumber}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITY_COLORS[req.priority] ?? PRIORITY_COLORS.NORMAL}`}>
                            {req.priority}
                          </span>
                          {req.budgetExceeded && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900/50 text-orange-400 border border-orange-800">
                              Presupuesto excedido
                            </span>
                          )}
                          {isPending && (
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${sla.color} ${sla.pulse ? 'animate-pulse' : ''}`}>
                              ⏱ {sla.label}
                            </span>
                          )}
                        </div>
                        <p className="text-surface-900 dark:text-white font-medium mt-1">{req.title}</p>
                        <p className="text-surface-500 text-sm">
                          {req.department?.name ?? 'Sin departamento'} · ${Number(req.totalEstimated ?? 0).toFixed(2)}
                        </p>
                        <p className="text-surface-400 text-xs mt-1">
                          Creado hace {daysWaiting} día{daysWaiting !== 1 ? 's' : ''} ·
                          {req.items?.length ?? 0} ítems
                          {req.rejectionReason && <span className="text-red-400 ml-2">Razón: {req.rejectionReason}</span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link to={`/purchases/requisitions/${req.id}`} className="text-xs text-surface-500 hover:text-surface-600 dark:hover:text-surface-300 px-2 py-1.5 rounded-lg border border-surface-200 dark:border-surface-600 hover:border-surface-300 dark:hover:border-surface-500">
                        Ver detalle
                      </Link>
                      {isPending && (
                        <>
                          <input
                            type="text"
                            placeholder="Notas (opc.)"
                            value={approving === req.id ? notes : ''}
                            onChange={e => setNotes(e.target.value)}
                            onFocus={() => setApproving(req.id)}
                            className="bg-surface-100 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg px-2 py-1.5 text-xs text-surface-900 dark:text-white placeholder-surface-400 w-28 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                          />
                          <button
                            onClick={() => handleApprove(req.id, level)}
                            disabled={approving === req.id + '-loading'}
                            className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                          >
                            ✓ Aprobar L{level}
                          </button>
                          <button
                            onClick={() => setRejectId(req.id)}
                            className="text-xs px-3 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-red-900/50 text-surface-500 hover:text-red-400 rounded-lg border border-surface-200 dark:border-surface-600 hover:border-red-800 transition-colors"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Mini approval chain */}
                  {isPending && (
                    <div className="mt-3 flex gap-2 items-center text-xs text-surface-400">
                      {[1, 2, 3].map(l => {
                        const approved = l < level;
                        const active   = l === level;
                        if (l === 3 && !req.budgetExceeded && l > level) return null;
                        return (
                          <span key={l} className={`px-2 py-0.5 rounded-full ${
                            approved ? 'bg-green-900/40 text-green-400' :
                            active   ? 'bg-brand-900/40 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400' :
                            'bg-surface-100 dark:bg-surface-700 text-surface-400'
                          }`}>
                            L{l} {approved ? '✓' : active ? '⏳' : '○'}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky bulk action footer */}
      {!isHistory && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-surface-800 border border-brand-500 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-4">
          <span className="text-sm font-medium text-surface-700 dark:text-white">
            {selected.size} seleccionada{selected.size !== 1 ? 's' : ''}
          </span>
          <button onClick={() => setBulkOpen(true)}
            className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">
            ✓ Aprobar todas
          </button>
          <button onClick={() => setSelected(new Set())}
            className="text-sm px-3 py-2 text-surface-500 hover:text-surface-700 dark:hover:text-white">
            Limpiar
          </button>
        </div>
      )}
    </div>
  );
}
