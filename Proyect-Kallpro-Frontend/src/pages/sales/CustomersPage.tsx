import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { salesApi } from '../../api/sales';

const PERSON_FILTERS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'NATURAL', label: '👤 Persona Natural' },
  { value: 'JURIDICA', label: '🏢 Persona Jurídica' },
];

const KYC_FILTERS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'COMPLETE', label: '✓ KYC completo' },
  { value: 'PENDING', label: '⚠ KYC pendiente' },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [personFilter, setPersonFilter] = useState('ALL');
  const [kycFilter, setKycFilter] = useState('ALL');

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    setError('');
    salesApi.getCustomers()
      .then((r) => setCustomers(r.data))
      .catch(() => setError('No se pudo cargar clientes. Verifica que el backend esté corriendo.'))
      .finally(() => setLoading(false));
  }

  const filtered = useMemo(() => {
    let list = customers.slice();
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.razonSocial || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.ruc || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q)
      );
    }
    if (personFilter !== 'ALL') list = list.filter((c) => c.personType === personFilter);
    if (kycFilter === 'COMPLETE') list = list.filter((c) => !!c.kycCompletedAt);
    if (kycFilter === 'PENDING') list = list.filter((c) => !c.kycCompletedAt);
    return list;
  }, [customers, search, personFilter, kycFilter]);

  const kycCompleteCount = customers.filter((c) => c.kycCompletedAt).length;
  const totalBalance = customers.reduce((s, c) => s + Number(c.balance || 0), 0);
  const totalCreditLimit = customers.reduce((s, c) => s + Number(c.creditLimit || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">👥</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Clientes</h1>
            <p className="text-sm text-surface-500">
              {filtered.length} de {customers.length} clientes · {kycCompleteCount} con KYC UAFE completo
            </p>
          </div>
        </div>
        <Link to="/sales/customers/new"
          className="text-sm px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors">
          + Nuevo Cliente (UAFE)
        </Link>
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
          { label: 'Total Clientes',    value: customers.length, color: 'text-surface-800 dark:text-white' },
          { label: 'KYC completo',      value: kycCompleteCount, color: 'text-green-600 dark:text-green-400' },
          { label: 'Saldo total AR',    value: `$${totalBalance.toLocaleString('es', { minimumFractionDigits: 2 })}`, color: 'text-yellow-600 dark:text-yellow-400', small: true },
          { label: 'Línea crédito total', value: `$${totalCreditLimit.toLocaleString('es', { minimumFractionDigits: 0 })}`, color: 'text-brand-600 dark:text-brand-400', small: true },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700 shadow-soft">
            <p className="text-xs text-surface-500 uppercase tracking-wider">{kpi.label}</p>
            <p className={`${kpi.small ? 'text-xl' : 'text-3xl'} font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Buscar cliente por nombre, RUC, email o ciudad..."
          className="flex-1 min-w-[240px] bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-4 py-2 text-sm text-surface-800 dark:text-white placeholder:text-surface-400 focus:outline-none focus:border-brand-500"
        />
        <select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)}
          className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-700 dark:text-white">
          {PERSON_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={kycFilter} onChange={(e) => setKycFilter(e.target.value)}
          className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-700 dark:text-white">
          {KYC_FILTERS.map((o) => <option key={o.value} value={o.value}>KYC: {o.label}</option>)}
        </select>
      </div>

      {/* Lista */}
      <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden shadow-soft">
        <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700">
          <h2 className="font-semibold text-surface-800 dark:text-white">Listado de clientes</h2>
        </div>
        {filtered.length === 0 ? (
          <p className="text-center py-12 text-surface-400">
            {customers.length === 0 ? 'No hay clientes. Crea el primero.' : 'Sin clientes que coincidan con los filtros.'}
          </p>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-700">
            {filtered.map((c) => (
              <Link key={c.id} to={`/sales/customers/${c.id}`}
                className="block px-5 py-4 hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                <div className="flex justify-between items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-surface-800 dark:text-white">{c.razonSocial || c.name}</p>
                      {c.personType && (
                        <span className="text-[10px] bg-surface-100 dark:bg-surface-700 text-surface-500 px-1.5 py-0.5 rounded-full">
                          {c.personType === 'NATURAL' ? '👤 PN' : '🏢 PJ'}
                        </span>
                      )}
                      {c.kycCompletedAt ? (
                        <span className="text-[10px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                          ✓ KYC
                        </span>
                      ) : (
                        <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full font-medium">
                          ⚠ KYC pendiente
                        </span>
                      )}
                      {c.isPEP && (
                        <span className="text-[10px] bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
                          PEP
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-surface-500 truncate">
                      {[c.ruc, c.email, c.phone, c.city].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-right">
                    {Number(c.balance || 0) > 0 && (
                      <div>
                        <p className="text-xs text-surface-500">Saldo</p>
                        <p className="font-mono text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                          ${Number(c.balance).toLocaleString('es', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    )}
                    <span className="text-brand-500 text-sm font-medium">Ver →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
