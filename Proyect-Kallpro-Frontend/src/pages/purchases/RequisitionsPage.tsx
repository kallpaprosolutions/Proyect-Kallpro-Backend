import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { requisitionsApi } from '../../api/requisitions';
import { KanbanBoard, KanbanColumnDef } from '../../components/kanban/KanbanBoard';
import { useToast } from '../../components/ui/Toast';

const STATUS_STYLES: Record<string, string> = {
  DRAFT:      'bg-surface-100 dark:bg-surface-700 text-surface-500',
  PENDING_L1: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  PENDING_L2: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400',
  PENDING_L3: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
  APPROVED:   'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  QUOTED:     'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400',
  PO_CREATED: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  REJECTED:   'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING_L1: 'Pendiente Aprobación L1',
  PENDING_L2: 'Pendiente Aprobación L2',
  PENDING_L3: 'Pendiente Gerencia',
  APPROVED: 'Aprobada',
  QUOTED: 'En Cotización',
  PO_CREATED: 'OC Generada',
  REJECTED: 'Rechazada',
};
const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'text-surface-400', NORMAL: 'text-surface-700 dark:text-surface-300', HIGH: 'text-yellow-600 dark:text-yellow-400', URGENT: 'text-red-600 dark:text-red-400',
};
const PRIORITY_LABELS: Record<string, string> = {
  URGENT: 'Urgente', HIGH: 'Alta', NORMAL: 'Normal', LOW: 'Baja',
};
const PRIORITIES = ['ALL', 'URGENT', 'HIGH', 'NORMAL', 'LOW'];

const TABS = ['TODOS', 'PENDING_L1', 'PENDING_L2', 'PENDING_L3', 'APPROVED', 'QUOTED', 'PO_CREATED', 'REJECTED'];

// Columnas del kanban: solo son "droppable" los pasos de aprobación por nivel (approve sin
// formulario adicional). Rechazar (exige motivo), cotizar y elegir ganador (exigen formulario)
// NO son un simple drag — se hacen desde el detalle, como ya funcionaba.
const KANBAN_COLUMNS: KanbanColumnDef[] = [
  { id: 'PENDING_L1', label: STATUS_LABELS.PENDING_L1 },
  { id: 'PENDING_L2', label: STATUS_LABELS.PENDING_L2 },
  { id: 'PENDING_L3', label: STATUS_LABELS.PENDING_L3 },
  { id: 'APPROVED', label: STATUS_LABELS.APPROVED },
  { id: 'QUOTED', label: STATUS_LABELS.QUOTED, droppable: false, hint: 'Se agrega una cotización desde el detalle' },
  { id: 'PO_CREATED', label: STATUS_LABELS.PO_CREATED, droppable: false, hint: 'Elegir ganador y generar OC se hace desde el detalle' },
  { id: 'REJECTED', label: STATUS_LABELS.REJECTED, droppable: false, hint: 'Rechazar exige un motivo — hazlo desde el detalle' },
];

/** Próxima columna válida al soltar una tarjeta (arrastrar solo avanza un paso de aprobación). */
function nextApprovalColumn(r: any): string | null {
  if (r.status === 'PENDING_L1') return 'PENDING_L2';
  if (r.status === 'PENDING_L2') return r.budgetExceeded ? 'PENDING_L3' : 'APPROVED';
  if (r.status === 'PENDING_L3') return 'APPROVED';
  return null;
}
function approvalLevelFor(status: string): 1 | 2 | 3 | null {
  if (status === 'PENDING_L1') return 1;
  if (status === 'PENDING_L2') return 2;
  if (status === 'PENDING_L3') return 3;
  return null;
}

export default function RequisitionsPage() {
  const toast = useToast();
  const [reqs, setReqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [activeTab, setActiveTab] = useState('TODOS');
  const [search, setSearch]   = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [view, setView] = useState<'list' | 'kanban'>('list');

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    setError('');
    requisitionsApi.getAll()
      .then((r) => setReqs(r.data))
      .catch(() => setError('No se pudo cargar las requisiciones. Verifica el backend.'))
      .finally(() => setLoading(false));
  }

  // Lista única de departamentos
  const departments = useMemo(() => {
    const set = new Set<string>();
    reqs.forEach((r) => { if (r.department?.name) set.add(r.department.name); });
    return Array.from(set).sort();
  }, [reqs]);

  const filtered = useMemo(() => {
    let list = reqs.slice();
    if (activeTab !== 'TODOS') list = list.filter((r) => r.status === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        (r.reqNumber || '').toLowerCase().includes(q) ||
        (r.title || '').toLowerCase().includes(q) ||
        (r.department?.name || '').toLowerCase().includes(q)
      );
    }
    if (deptFilter !== 'ALL') list = list.filter((r) => r.department?.name === deptFilter);
    if (priorityFilter !== 'ALL') list = list.filter((r) => r.priority === priorityFilter);
    return list;
  }, [reqs, activeTab, search, deptFilter, priorityFilter]);

  async function handleKanbanMove(r: any, toColumnId: string) {
    const expected = nextApprovalColumn(r);
    if (toColumnId !== expected) {
      toast.error('Las requisiciones solo avanzan un paso de aprobación a la vez. Suéltala en la siguiente columna habilitada.');
      return;
    }
    const level = approvalLevelFor(r.status);
    if (!level) return;
    try {
      await requisitionsApi.approve(r.id, level);
      toast.success(`${r.reqNumber} aprobada (nivel ${level})`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'No se pudo aprobar la requisición');
    }
  }

  const pending = reqs.filter((r) => ['PENDING_L1', 'PENDING_L2', 'PENDING_L3'].includes(r.status)).length;
  const approved = reqs.filter((r) => r.status === 'APPROVED').length;
  const poCreated = reqs.filter((r) => r.status === 'PO_CREATED').length;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">📄</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Requisiciones de Materiales</h1>
            <p className="text-sm text-surface-500">{filtered.length} de {reqs.length} requisiciones</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg p-0.5">
            <button onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-white shadow-sm' : 'text-surface-500'}`}>
              ☰ Lista
            </button>
            <button onClick={() => setView('kanban')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'kanban' ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-white shadow-sm' : 'text-surface-500'}`}>
              ▦ Kanban
            </button>
          </div>
          <Link to="/purchases/requisitions/new"
            className="text-sm px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors">
            + Nueva Requisición
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          <span className="text-red-500 text-lg">⚠️</span>
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button onClick={load} className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline flex-shrink-0">Reintentar</button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Requisiciones', value: reqs.length, color: 'text-surface-800 dark:text-white' },
          { label: 'Pendientes Aprobación', value: pending, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Aprobadas', value: approved, color: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'OCs Generadas', value: poCreated, color: 'text-green-600 dark:text-green-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white dark:bg-surface-800 rounded-xl p-5 border border-surface-200 dark:border-surface-700 shadow-soft">
            <p className="text-surface-500 text-sm">{kpi.label}</p>
            <p className={`text-3xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Buscar por código, título o departamento..."
          className="flex-1 min-w-[240px] bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-4 py-2 text-sm text-surface-800 dark:text-white placeholder:text-surface-400 focus:outline-none focus:border-brand-500"
        />
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
          className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-700 dark:text-white">
          <option value="ALL">Todos los departamentos</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
          className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-700 dark:text-white">
          {PRIORITIES.map((p) => <option key={p} value={p}>{p === 'ALL' ? 'Todas las prioridades' : PRIORITY_LABELS[p] ?? p}</option>)}
        </select>
        {(search || deptFilter !== 'ALL' || priorityFilter !== 'ALL' || activeTab !== 'TODOS') && (
          <button onClick={() => { setSearch(''); setDeptFilter('ALL'); setPriorityFilter('ALL'); setActiveTab('TODOS'); }}
            className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-white underline">
            Limpiar
          </button>
        )}
      </div>

      {view === 'list' ? (
      <>
      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors
              ${activeTab === tab ? 'bg-brand-500 text-white' : 'bg-surface-100 dark:bg-surface-700 text-surface-500 hover:text-surface-800 dark:hover:text-white'}`}>
            {tab === 'TODOS' ? 'Todos' : STATUS_LABELS[tab]}
            {tab !== 'TODOS' && (
              <span className="ml-1 text-xs opacity-70">
                ({reqs.filter((r) => r.status === tab).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700 text-surface-500 text-xs uppercase">
              <th className="text-left px-4 py-3">N° Req</th>
              <th className="text-left px-4 py-3">Título</th>
              <th className="text-left px-4 py-3">Departamento</th>
              <th className="text-left px-4 py-3">Prioridad</th>
              <th className="text-right px-4 py-3">Estimado</th>
              <th className="text-center px-4 py-3">Estado</th>
              <th className="text-left px-4 py-3">Fecha</th>
              <th className="text-left px-4 py-3">Necesaria</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-surface-400">
                {reqs.length === 0 ? 'No hay requisiciones. Crea la primera.' : 'No hay requisiciones que coincidan con los filtros.'}
              </td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors">
                <td className="px-4 py-3 font-mono font-medium text-brand-600 dark:text-brand-400">{r.reqNumber}</td>
                <td className="px-4 py-3 font-medium text-surface-800 dark:text-white">{r.title}</td>
                <td className="px-4 py-3 text-surface-500 text-sm">{r.department?.name ?? '—'}</td>
                <td className={`px-4 py-3 text-sm font-medium ${PRIORITY_STYLES[r.priority]}`}>{PRIORITY_LABELS[r.priority] ?? r.priority}</td>
                <td className="px-4 py-3 text-right font-mono text-surface-700 dark:text-surface-300">
                  ${Number(r.totalEstimated).toLocaleString('es', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                  {r.budgetExceeded && (
                    <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">⚠ Presupuesto</span>
                  )}
                </td>
                <td className="px-4 py-3 text-surface-500 text-sm">{new Date(r.createdAt).toLocaleDateString('es')}</td>
                <td className="px-4 py-3 text-sm">
                  {r.neededBy ? (() => {
                    const overdue = new Date(r.neededBy) < new Date() && !['PO_CREATED', 'REJECTED'].includes(r.status);
                    return (
                      <span className={overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-surface-500'}>
                        {new Date(r.neededBy).toLocaleDateString('es')}{overdue && ' ⚠'}
                      </span>
                    );
                  })() : <span className="text-surface-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <Link to={`/purchases/requisitions/${r.id}`} className="text-brand-500 hover:text-brand-700 dark:hover:text-brand-300 text-sm font-medium">Ver →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      ) : (
        <KanbanBoard
          columns={KANBAN_COLUMNS}
          items={filtered.filter((r) => KANBAN_COLUMNS.some((c) => c.id === r.status))}
          getId={(r) => r.id}
          getColumnId={(r) => r.status}
          onMove={handleKanbanMove}
          emptyLabel="Sin requisiciones"
          renderCard={(r, isDragging) => (
            <div className={`bg-white dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700 p-3 shadow-sm cursor-grab active:cursor-grabbing ${isDragging ? 'shadow-lg ring-2 ring-brand-400' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-medium text-brand-600 dark:text-brand-400">{r.reqNumber}</span>
                <span className={`text-xs font-medium ${PRIORITY_STYLES[r.priority]}`}>{PRIORITY_LABELS[r.priority] ?? r.priority}</span>
              </div>
              <p className="text-sm font-medium text-surface-800 dark:text-white mb-1 line-clamp-2">{r.title}</p>
              <p className="text-xs text-surface-500 mb-1">{r.department?.name ?? '—'}</p>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-surface-600 dark:text-surface-300">
                  ${Number(r.totalEstimated).toLocaleString('es', { minimumFractionDigits: 2 })}
                </span>
                {r.budgetExceeded && <span className="text-xs text-red-600 dark:text-red-400">⚠ Presupuesto</span>}
              </div>
              <Link to={`/purchases/requisitions/${r.id}`} onClick={(e) => e.stopPropagation()}
                className="block mt-2 text-xs text-brand-500 hover:text-brand-700 dark:hover:text-brand-300 font-medium">
                Ver detalle →
              </Link>
            </div>
          )}
        />
      )}
    </div>
  );
}
