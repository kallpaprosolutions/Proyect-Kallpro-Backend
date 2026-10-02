import { useEffect, useState } from 'react';
import { financialApi } from '../../api/financial';
import { AccountSelect } from './ChartOfAccountsTree';
import { useToast } from '../ui/Toast';

/**
 * Réplica llenable del Formulario 101 oficial del SRI (2026-10-01) — mismo patrón exacto que
 * `Form103OfficialReplica.tsx`/`Form104OfficialReplica.tsx`, adaptado a período ANUAL (año
 * fiscal) y con las tarifas de Impuesto a la Renta Sociedades configurables (la ley las cambia
 * por ejercicio).
 */
const money = (n: number) => `$${Number(n ?? 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface MappedAccount { code: string; name: string; sign: 1 | -1 }
interface CasillaResult {
  code: string; label: string; section: string; column: string; kind: 'leaf' | 'formula'; style?: string;
  suggested: number; override: number | null; value: number; accounts: MappedAccount[];
}
interface Replica {
  period: string;
  rates: { tarifaGeneral: number; tarifaReinversion: number };
  bySection: { section: string; casillas: CasillaResult[] }[];
  resultado: { casilla: string; label: string; value: number };
}

export default function Form101OfficialReplica({ year }: { year: number }) {
  const toast = useToast();
  const period = String(year);
  const [tarifaGeneral, setTarifaGeneral] = useState(25);
  const [tarifaReinversion, setTarifaReinversion] = useState(25);
  const [replica, setReplica] = useState<Replica | null>(null);
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const load = () => {
    setLoading(true);
    financialApi.getForm101Replica(period, { tarifaGeneral: tarifaGeneral / 100, tarifaReinversion: tarifaReinversion / 100 })
      .then((r) => setReplica(r.data)).catch(() => setReplica(null)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [period, tarifaGeneral, tarifaReinversion]);

  async function saveOverride(code: string) {
    const num = Number(editValue);
    if (!Number.isFinite(num)) { toast.error('Valor inválido', 'Error'); return; }
    try {
      await financialApi.saveForm101ReplicaOverride(period, code, num);
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'No se pudo guardar', 'Error');
    }
  }

  async function clearOverride(code: string) {
    await financialApi.deleteForm101ReplicaOverride(period, code).catch(() => {});
    load();
  }

  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between flex-wrap gap-3">
        <div>
          <span className="font-semibold text-surface-900 dark:text-white">Sistema de declaración de impuestos — Formulario 101</span>
          <p className="text-xs text-surface-500">Réplica del formulario oficial de Impuesto a la Renta Sociedades (ejercicio {year}) · asigna cuentas a cada casilla, o edítala a mano antes de presentar.</p>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-[10px] text-surface-400 mb-0.5">Tarifa general (%)</label>
            <input type="number" step="0.5" value={tarifaGeneral} onChange={(e) => setTarifaGeneral(Number(e.target.value))}
              className="w-20 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1 text-sm text-surface-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-[10px] text-surface-400 mb-0.5">Tarifa reinversión (%)</label>
            <input type="number" step="0.5" value={tarifaReinversion} onChange={(e) => setTarifaReinversion(Number(e.target.value))}
              className="w-20 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1 text-sm text-surface-900 dark:text-white" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>
      ) : !replica ? (
        <p className="text-sm text-surface-500 p-4">No se pudo cargar la réplica del formulario.</p>
      ) : (
        <>
          <div className="divide-y divide-surface-100 dark:divide-surface-700">
            {replica.bySection.map((sec) => (
              <div key={sec.section}>
                <div className="bg-blue-600 dark:bg-blue-900/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white">{sec.section}</div>
                {sec.casillas.map((c) => (
                  <div key={c.code} className={`flex items-center gap-2 px-4 py-2 text-sm ${c.style === 'total' ? 'font-semibold bg-amber-50/60 dark:bg-amber-900/10' : c.style === 'resultado' ? 'font-bold bg-blue-50 dark:bg-blue-900/20' : c.style === 'informativo' ? 'opacity-70' : ''}`}>
                    <span className="font-mono text-xs text-surface-400 w-14 shrink-0">{c.code}</span>
                    <span className="flex-1 text-surface-700 dark:text-surface-300">{c.label}</span>

                    {c.kind === 'leaf' && (
                      <button type="button" onClick={() => setConfiguring(configuring === c.code ? null : c.code)}
                        className="text-xs text-surface-400 hover:text-brand-500" title="Asignar cuenta(s) contable(s)">
                        {c.accounts.length > 0 ? `⚙ ${c.accounts.length} cuenta(s)` : '⚙ sin cuenta'}
                      </button>
                    )}

                    {editing === c.code ? (
                      <div className="flex items-center gap-1">
                        <input autoFocus type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          className="w-28 font-mono text-right bg-surface-50 dark:bg-surface-900 border border-brand-400 rounded px-2 py-0.5 text-sm text-surface-900 dark:text-white" />
                        <button onClick={() => saveOverride(c.code)} className="text-green-600 dark:text-green-400 text-xs">✓</button>
                        <button onClick={() => setEditing(null)} className="text-surface-400 text-xs">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {c.override !== null && (
                          <span className="text-[10px] text-surface-400 line-through font-mono" title="Valor sugerido por el Mayor">{money(c.suggested)}</span>
                        )}
                        <span className={`font-mono ${c.override !== null ? 'text-amber-600 dark:text-amber-400' : 'text-surface-900 dark:text-white'}`}>{money(c.value)}</span>
                        {c.kind === 'leaf' && (
                          <>
                            <button onClick={() => { setEditing(c.code); setEditValue(String(c.value)); }} className="text-xs text-surface-400 hover:text-brand-500" title="Editar a mano">✎</button>
                            {c.override !== null && <button onClick={() => clearOverride(c.code)} className="text-xs text-surface-400 hover:text-red-500" title="Volver al sugerido">↺</button>}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="px-4 py-3 flex items-center justify-between border-t-2 border-blue-300 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20">
            <span className="font-semibold text-surface-900 dark:text-white">{replica.resultado.label}</span>
            <span className="font-mono font-bold text-lg text-blue-700 dark:text-blue-400">{money(replica.resultado.value)}</span>
          </div>

          {configuring && (
            <CasillaAccountsPanel
              casilla={replica.bySection.flatMap((s) => s.casillas).find((c) => c.code === configuring)!}
              onClose={() => setConfiguring(null)}
              onSaved={() => { setConfiguring(null); load(); }}
            />
          )}
        </>
      )}
    </div>
  );
}

function CasillaAccountsPanel({ casilla, onClose, onSaved }: { casilla: CasillaResult; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [accounts, setAccounts] = useState<MappedAccount[]>(casilla.accounts.length ? casilla.accounts : [{ code: '', name: '', sign: 1 }]);
  const [saving, setSaving] = useState(false);

  async function save() {
    const clean = accounts.filter((a) => a.code);
    setSaving(true);
    try {
      await financialApi.saveForm101ReplicaMapping(casilla.code, clean);
      toast.success(`Casilla ${casilla.code} configurada`, '✓ Guardado');
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'No se pudo guardar', 'Error');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-surface-800 rounded-xl shadow-2xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-surface-900 dark:text-white mb-1">Casilla {casilla.code} · {casilla.label}</h3>
        <p className="text-xs text-surface-500 mb-4">
          Asigna la(s) cuenta(s) del plan que alimentan esta casilla. Para las casillas 6999/7999
          (puente con el Estado de Resultados) mapea los rangos de cuentas de ingresos y de
          costos/gastos respectivamente, con signo + (crédito − débito) para ingresos y
          − (débito − crédito) para costos y gastos.
        </p>
        <div className="space-y-3">
          {accounts.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1"><AccountSelect value={a.code} onChange={(code, name) => setAccounts((prev) => prev.map((x, xi) => xi === i ? { ...x, code, name } : x))} /></div>
              <select value={a.sign} onChange={(e) => setAccounts((prev) => prev.map((x, xi) => xi === i ? { ...x, sign: Number(e.target.value) as 1 | -1 } : x))}
                className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-2 text-sm text-surface-900 dark:text-white">
                <option value={1}>+ (crédito − débito)</option>
                <option value={-1}>− (débito − crédito)</option>
              </select>
              <button onClick={() => setAccounts((prev) => prev.filter((_, xi) => xi !== i))} className="text-surface-400 hover:text-red-500 text-sm">✕</button>
            </div>
          ))}
          <button onClick={() => setAccounts((prev) => [...prev, { code: '', name: '', sign: 1 }])} className="text-sm text-brand-600 dark:text-brand-400">+ Agregar otra cuenta</button>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-surface-600 dark:text-surface-300">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
