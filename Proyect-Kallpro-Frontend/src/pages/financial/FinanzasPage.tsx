import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import FinancialExecutivePage from './FinancialExecutivePage';
import FinancialAnalyticsPage from './FinancialAnalyticsPage';
import GerencialDashboardPage from '../gerencial/GerencialDashboardPage';
import BudgetWorksheet from '../../components/budget/BudgetWorksheet';
import { ArAgingView, ApAgingView, CashFlowForecastView } from '../../components/finance/AgingViews';
import CollectionRadar from '../../components/finance/CollectionRadar';
import IncomeExpenseReport from '../../components/finance/IncomeExpenseReport';

/**
 * Módulo FINANCIERO unificado — separado de Contabilidad (misma DB).
 * Dashboard ejecutivo · Cartera (CxC) · Pagos (CxP) · Presupuestos · Flujo de caja
 * + Análisis y Gerencial en modo Experto. Escala de pyme (Básico) a senior (Experto).
 */

type TabKey = 'dashboard' | 'cartera' | 'pagos' | 'presupuesto' | 'flujo' | 'resultados' | 'analisis' | 'gerencial';

const TABS: { key: TabKey; label: string; icon: string; expert?: boolean }[] = [
  { key: 'dashboard',   label: 'Dashboard',     icon: '📊' },
  { key: 'cartera',     label: 'Cartera (CxC)', icon: '📥' },
  { key: 'pagos',       label: 'Pagos (CxP)',   icon: '📤' },
  { key: 'presupuesto', label: 'Presupuestos',  icon: '🎯' },
  { key: 'flujo',       label: 'Flujo de Caja', icon: '💧' },
  { key: 'resultados',  label: 'Ingresos & Egresos', icon: '📈' },
  { key: 'analisis',    label: 'Análisis',      icon: '🔬', expert: true },
  { key: 'gerencial',   label: 'Gerencial',     icon: '👔', expert: true },
];

// Tabs legacy → nuevos (compatibilidad con enlaces antiguos)
const LEGACY_TABS: Record<string, TabKey> = { resumen: 'dashboard', operacion: 'cartera' };

const MODE_KEY = 'kallpa-finance-mode';

export default function FinanzasPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab') ?? 'dashboard';
  const tab: TabKey = (LEGACY_TABS[raw] ?? raw) as TabKey;
  const setTab = (t: TabKey) => setParams({ tab: t }, { replace: true });
  const [expert, setExpert] = useState(() => localStorage.getItem(MODE_KEY) === 'expert');

  useEffect(() => { localStorage.setItem(MODE_KEY, expert ? 'expert' : 'basic'); }, [expert]);

  const visibleTabs = TABS.filter((t) => expert || !t.expert);
  const activeTab: TabKey = visibleTabs.some((t) => t.key === tab) ? tab : 'dashboard';

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">💼</div>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Financiero</h1>
          <p className="text-sm text-surface-500">Valoración de cartera, pagos, presupuestos, flujo de caja y KPIs</p>
        </div>
        {/* Toggle Básico / Experto */}
        <div className="flex items-center bg-surface-100 dark:bg-surface-800 rounded-lg p-0.5 text-xs font-medium">
          <button onClick={() => setExpert(false)}
            className={`px-3 py-1.5 rounded-md transition-colors ${!expert ? 'bg-white dark:bg-surface-600 text-surface-900 dark:text-white shadow-soft' : 'text-surface-500'}`}>
            Básico
          </button>
          <button onClick={() => setExpert(true)}
            className={`px-3 py-1.5 rounded-md transition-colors ${expert ? 'bg-brand-500 text-white shadow-soft' : 'text-surface-500'}`}>
            Experto
          </button>
        </div>
        <Link to="/contabilidad" className="text-sm px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-lg text-surface-600 dark:text-surface-300 hover:border-brand-400">
          📒 Contabilidad →
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-100 dark:bg-surface-800 rounded-lg p-1 w-fit flex-wrap">
        {visibleTabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === t.key ? 'bg-brand-500 text-white' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <FinancialExecutivePage />
          <MiniAgingCards />
        </div>
      )}
      {activeTab === 'cartera' && (
        <div className="space-y-6">
          <CollectionRadar />
          <ArAgingView />
        </div>
      )}
      {activeTab === 'pagos' && <ApAgingView />}
      {activeTab === 'presupuesto' && <BudgetWorksheet />}
      {activeTab === 'flujo' && <CashFlowForecastView />}
      {activeTab === 'resultados' && <IncomeExpenseReport />}
      {activeTab === 'analisis' && expert && <FinancialAnalyticsPage />}
      {activeTab === 'gerencial' && expert && <GerencialDashboardPage />}
    </div>
  );
}

/** Mini-resumen de cartera y pagos para el dashboard, con CTA a sus tabs */
function MiniAgingCards() {
  const [ar, setAr] = useState<any>(null);
  const [ap, setAp] = useState<any>(null);
  const [, setParams] = useSearchParams();
  useEffect(() => {
    import('../../api/financial').then(({ financialApi }) => {
      financialApi.getArAging().then((r) => setAr(r.data)).catch(() => {});
      financialApi.getApAging().then((r) => setAp(r.data)).catch(() => {});
    });
  }, []);
  const money = (n: number) => `$${Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2 })}`;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <button onClick={() => setParams({ tab: 'cartera' }, { replace: true })}
        className="text-left bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-4 shadow-soft hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-surface-900 dark:text-white">📥 Cartera por cobrar</p>
          <span className="text-brand-500 text-sm">Ver →</span>
        </div>
        <div className="mt-2 flex items-baseline gap-4">
          <span className="text-2xl font-bold font-mono text-surface-900 dark:text-white">{ar ? money(ar.total) : '—'}</span>
          {ar && ar.overdue > 0 && <span className="text-sm font-mono text-red-600 dark:text-red-400">vencido: {money(ar.overdue)}</span>}
        </div>
      </button>
      <button onClick={() => setParams({ tab: 'pagos' }, { replace: true })}
        className="text-left bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-4 shadow-soft hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-surface-900 dark:text-white">📤 Pagos a proveedores</p>
          <span className="text-brand-500 text-sm">Ver →</span>
        </div>
        <div className="mt-2 flex items-baseline gap-4">
          <span className="text-2xl font-bold font-mono text-surface-900 dark:text-white">{ap ? money(ap.total) : '—'}</span>
          {ap && ap.overdue > 0 && <span className="text-sm font-mono text-red-600 dark:text-red-400">vencido: {money(ap.overdue)}</span>}
        </div>
      </button>
    </div>
  );
}
