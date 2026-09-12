import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { payrollApi } from '../../api/payroll';
import { financialApi } from '../../api/financial';
import { useToast } from '../../components/ui/Toast';
import CollapsiblePanel from '../../components/ui/CollapsiblePanel';
import StatCard from '../../components/ui/StatCard';
import { Banknote, Users, Receipt, TrendingDown } from 'lucide-react';

const money = (n: number) => `$${Number(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT:     { label: 'Borrador',       cls: 'bg-surface-100 dark:bg-surface-700 text-surface-500' },
  PROCESSED: { label: 'Calculado',      cls: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' },
  POSTED:    { label: 'Contabilizado',  cls: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' },
  PAID:      { label: 'Pagado',         cls: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300' },
};

const NOVELTY_LABELS: Record<string, string> = {
  HORAS_SUPLEMENTARIAS: 'Horas suplementarias (+50%)',
  HORAS_EXTRAORDINARIAS: 'Horas extraordinarias (+100%)',
  BONO: 'Bono', COMISION: 'Comisión', OTRO_INGRESO: 'Otro ingreso (no gravado)',
  ANTICIPO: 'Anticipo de sueldo',
  PRESTAMO_QUIROGRAFARIO: 'Préstamo quirografario IESS',
  PRESTAMO_HIPOTECARIO: 'Préstamo hipotecario IESS',
  PENSION_ALIMENTICIA: 'Pensión alimenticia',
  MULTA: 'Multa (tope 10%)', OTRO_DESCUENTO: 'Otro descuento',
};

const inputCls = 'bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

/** Participación de utilidades (15%, art. 97 CT): 10% por tiempo trabajado + 5% por cargas familiares, tope 24 SBU. Solo cálculo. */
function UtilidadesPanel({ defaultYear }: { defaultYear: number }) {
  const [uYear, setUYear] = useState(defaultYear);
  const [profit, setProfit] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const calculate = async () => {
    setBusy(true); setError(''); setResult(null);
    try { setResult((await payrollApi.getUtilidades(uYear, Number(profit))).data); }
    catch (e: any) { setError(e?.response?.data?.error || 'No se pudo calcular'); }
    finally { setBusy(false); }
  };

  return (
    <div className="mt-6">
      <CollapsiblePanel id="payroll-utilidades" title="Participación de utilidades (15%)" defaultOpen={false}>
        <p className="text-xs text-surface-500 mb-3">
          Art. 97 del Código del Trabajo: 10% entre todos los trabajadores en proporción al tiempo trabajado en el año y 5% en
          proporción a las cargas familiares registradas en la ficha de cada empleado. Tope individual de 24 SBU; el excedente va
          al IESS. Es un cálculo de referencia, no contabiliza.
        </p>
        <div className="flex items-end gap-3 flex-wrap mb-4">
          <div>
            <label className="block text-xs text-surface-500 mb-1">Ejercicio</label>
            <input type="number" value={uYear} onChange={(e) => setUYear(Number(e.target.value))} className={`${inputCls} w-28`} />
          </div>
          <div>
            <label className="block text-xs text-surface-500 mb-1">Utilidad líquida del ejercicio ($)</label>
            <input type="number" min={0} step="0.01" value={profit} onChange={(e) => setProfit(e.target.value)} className={`${inputCls} w-48`} placeholder="0.00" />
          </div>
          <button onClick={calculate} disabled={busy || profit === ''} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
            {busy ? 'Calculando…' : 'Calcular reparto'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {result && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-surface-50 dark:bg-surface-900 rounded-lg p-3"><p className="text-xs text-surface-500">15% a repartir</p><p className="font-semibold text-surface-900 dark:text-white">{money(result.participacionTotal)}</p></div>
              <div className="bg-surface-50 dark:bg-surface-900 rounded-lg p-3"><p className="text-xs text-surface-500">10% por tiempo</p><p className="font-semibold text-surface-900 dark:text-white">{money(result.fondo10)}</p></div>
              <div className="bg-surface-50 dark:bg-surface-900 rounded-lg p-3"><p className="text-xs text-surface-500">5% por cargas</p><p className="font-semibold text-surface-900 dark:text-white">{money(result.fondo5)}</p></div>
              <div className="bg-surface-50 dark:bg-surface-900 rounded-lg p-3"><p className="text-xs text-surface-500">Excedente al IESS (tope {money(result.topeIndividual)})</p><p className="font-semibold text-surface-900 dark:text-white">{money(result.totalExcedenteIess)}</p></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-surface-500 uppercase border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left py-2">Trabajador</th><th className="text-right">Días</th><th className="text-right">Cargas</th><th className="text-right">Por tiempo</th><th className="text-right">Por cargas</th><th className="text-right">A pagar</th>
                </tr></thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {result.lines.map((l: any) => (
                    <tr key={l.employeeId}>
                      <td className="py-2 text-surface-900 dark:text-white">{l.name}</td>
                      <td className="text-right text-surface-600 dark:text-surface-400">{l.daysWorked}</td>
                      <td className="text-right text-surface-600 dark:text-surface-400">{l.familyBurdens}</td>
                      <td className="text-right font-mono">{money(l.porTiempo)}</td>
                      <td className="text-right font-mono">{money(l.porCargas)}</td>
                      <td className="text-right font-mono font-semibold text-surface-900 dark:text-white">{money(l.neto)}{l.excedenteIess > 0 && <span className="text-xs text-amber-600 ml-1" title="Excedente sobre 24 SBU al IESS">⚠</span>}</td>
                    </tr>
                  ))}
                  {result.lines.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-surface-400">Sin trabajadores con relación laboral en ese ejercicio.</td></tr>}
                </tbody>
                <tfoot><tr className="border-t border-surface-200 dark:border-surface-700 font-semibold"><td className="py-2" colSpan={5}>Total a pagar</td><td className="text-right font-mono text-surface-900 dark:text-white">{money(result.totalNeto)}</td></tr></tfoot>
              </table>
            </div>
          </div>
        )}
      </CollapsiblePanel>
    </div>
  );
}

export default function PayrollPage() {
  const toast = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [periods, setPeriods] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [entryModal, setEntryModal] = useState<any>(null);

  // Formulario de novedades
  const [showNovelty, setShowNovelty] = useState(false);
  const [novelty, setNovelty] = useState({ employeeId: '', type: 'HORAS_SUPLEMENTARIAS', hours: '', amount: '', notes: '' });
  const [employees, setEmployees] = useState<any[]>([]);

  const loadPeriods = () => payrollApi.getPeriods().then((r) => setPeriods(r.data)).catch(() => {});

  useEffect(() => {
    loadPeriods();
    payrollApi.getEmployees().then((r) => setEmployees(r.data)).catch(() => {});
  }, []);

  // Al cambiar de período, carga el detalle si ya existe
  useEffect(() => {
    const p = periods.find((x) => x.year === year && x.month === month);
    if (p) payrollApi.getPeriod(p.id).then((r) => setDetail(r.data)).catch(() => setDetail(null));
    else setDetail(null);
  }, [year, month, periods]);

  const act = async (fn: () => Promise<any>, okMsg: string) => {
    setBusy(true);
    try {
      const res = await fn();
      toast.success(okMsg);
      await loadPeriods();
      if (res?.data?.period) setDetail(res.data.period);
      else if (res?.data?.id) setDetail(res.data);
      return res;
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Operación fallida');
    } finally { setBusy(false); }
  };

  const generate = () => act(() => payrollApi.generate(year, month), 'Rol de pagos calculado');
  const post = () => detail && act(() => payrollApi.postPeriod(detail.id), 'Período contabilizado — asiento generado');
  const pay = () => detail && act(() => payrollApi.payPeriod(detail.id), 'Pago registrado — asiento generado');

  const saveNovelty = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!detail) return;
    const isHours = novelty.type.startsWith('HORAS');
    try {
      await payrollApi.addNovelty({
        periodId: detail.id, employeeId: novelty.employeeId, type: novelty.type,
        hours: isHours ? Number(novelty.hours) : undefined,
        amount: !isHours ? Number(novelty.amount) : undefined,
        notes: novelty.notes || undefined,
      });
      toast.success('Novedad registrada' + (detail.status === 'PROCESSED' ? ' — rol recalculado' : ''));
      setShowNovelty(false);
      setNovelty({ employeeId: '', type: 'HORAS_SUPLEMENTARIAS', hours: '', amount: '', notes: '' });
      const r = await payrollApi.getPeriod(detail.id);
      setDetail(r.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'No se pudo registrar la novedad');
    }
  };

  const removeNovelty = async (id: string) => {
    try {
      await payrollApi.deleteNovelty(id);
      toast.success('Novedad eliminada');
      const r = await payrollApi.getPeriod(detail.id);
      setDetail(r.data);
    } catch (err: any) { toast.error(err?.response?.data?.error || 'No se pudo eliminar'); }
  };

  const openEntry = async (entryId: string) => {
    try {
      const { data } = await financialApi.getJournalEntry(entryId);
      setEntryModal(data);
    } catch { toast.error('No se pudo cargar el asiento'); }
  };

  const status = detail?.status ?? 'DRAFT';
  const meta = STATUS_META[status] ?? STATUS_META.DRAFT;
  const payslips = detail?.payslips ?? [];
  const totals = payslips.reduce((acc: any, p: any) => ({
    gross: acc.gross + Number(p.grossEarnings), other: acc.other + Number(p.otherEarnings),
    ded: acc.ded + Number(p.totalDeductions), net: acc.net + Number(p.netPay), emp: acc.emp + Number(p.employerCost),
  }), { gross: 0, other: 0, ded: 0, net: 0, emp: 0 });

  const canModify = status === 'DRAFT' || status === 'PROCESSED';

  return (
    <div className="max-w-6xl">
      {/* Dashboard colapsable */}
      <CollapsiblePanel id="payroll-dashboard" title="Dashboard de Nómina" icon={Banknote}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Empleados" value={String(employees.length)} icon={<Users className="w-5 h-5" />} color="brand" index={0} />
          <StatCard label="Neto del período" value={money(totals.net)} icon={<Banknote className="w-5 h-5" />} color="emerald" index={1} />
          <StatCard label="Deducciones" value={money(totals.ded)} icon={<TrendingDown className="w-5 h-5" />} color="amber" index={2} />
          <StatCard label="Costo empleador" value={money(totals.emp)} icon={<Receipt className="w-5 h-5" />} color="purple" index={3} />
        </div>
      </CollapsiblePanel>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">💵</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Rol de Pagos</h1>
            <p className="text-sm text-surface-500">Nómina mensual · normativa Ecuador (IESS, décimos, fondos de reserva, IR)</p>
          </div>
        </div>
        <Link to="/nomina/empleados" className="text-sm px-4 py-2 border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700">🧑‍💼 Empleados</Link>
      </div>

      {/* Selector de período + acciones */}
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-4 mb-6 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-surface-500 mb-1">Mes</label>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={inputCls}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Año</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputCls}>
            {[year - 1, year, year + 1].filter((v, i, a) => a.indexOf(v) === i).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${meta.cls}`}>{meta.label}</span>
        <div className="flex-1" />
        {canModify && (
          <button onClick={generate} disabled={busy}
            className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
            {status === 'PROCESSED' ? '↻ Recalcular rol' : '▶ Generar rol de pagos'}
          </button>
        )}
        {status === 'PROCESSED' && (
          <button onClick={post} disabled={busy}
            className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium">
            📒 Contabilizar
          </button>
        )}
        {status === 'POSTED' && (
          <button onClick={pay} disabled={busy}
            className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium">
            💸 Registrar pago
          </button>
        )}
        {detail?.journalEntryId && (
          <button onClick={() => openEntry(detail.journalEntryId)} className="text-xs text-brand-500 hover:underline">Ver asiento devengo</button>
        )}
        {detail?.paymentEntryId && (
          <button onClick={() => openEntry(detail.paymentEntryId)} className="text-xs text-brand-500 hover:underline">Ver asiento pago</button>
        )}
      </div>

      {/* Totales */}
      {payslips.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Ingresos gravados', value: totals.gross },
            { label: 'Beneficios en rol', value: totals.other },
            { label: 'Descuentos', value: totals.ded },
            { label: 'Neto a pagar', value: totals.net, hi: true },
            { label: 'Costo patronal', value: totals.emp },
          ].map((k) => (
            <div key={k.label} className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-3 shadow-soft">
              <p className="text-[11px] text-surface-500 uppercase tracking-wider">{k.label}</p>
              <p className={`text-lg font-bold font-mono ${k.hi ? 'text-green-600 dark:text-green-400' : 'text-surface-900 dark:text-white'}`}>{money(k.value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Novedades */}
      {detail && canModify && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300">
              Novedades del período ({detail.novelties?.length ?? 0})
            </h3>
            <button onClick={() => setShowNovelty((v) => !v)} className="text-xs px-3 py-1.5 bg-surface-100 dark:bg-surface-700 rounded-lg text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600">
              + Agregar novedad
            </button>
          </div>
          {showNovelty && (
            <form onSubmit={saveNovelty} className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4 mb-3 flex gap-3 flex-wrap items-end">
              <div>
                <label className="block text-xs text-surface-500 mb-1">Empleado *</label>
                <select required value={novelty.employeeId} onChange={(e) => setNovelty({ ...novelty, employeeId: e.target.value })} className={inputCls}>
                  <option value="">Selecciona…</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Tipo *</label>
                <select value={novelty.type} onChange={(e) => setNovelty({ ...novelty, type: e.target.value })} className={inputCls}>
                  {Object.entries(NOVELTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {novelty.type.startsWith('HORAS') ? (
                <div>
                  <label className="block text-xs text-surface-500 mb-1">Horas *</label>
                  <input required type="number" step="0.5" min="0.5" value={novelty.hours} onChange={(e) => setNovelty({ ...novelty, hours: e.target.value })} className={`${inputCls} w-24`} />
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-surface-500 mb-1">Monto *</label>
                  <input required type="number" step="0.01" min="0.01" value={novelty.amount} onChange={(e) => setNovelty({ ...novelty, amount: e.target.value })} className={`${inputCls} w-28`} />
                </div>
              )}
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs text-surface-500 mb-1">Notas</label>
                <input value={novelty.notes} onChange={(e) => setNovelty({ ...novelty, notes: e.target.value })} className={`${inputCls} w-full`} />
              </div>
              <button type="submit" className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium">Guardar</button>
            </form>
          )}
          {(detail.novelties ?? []).length > 0 && (
            <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft divide-y divide-surface-100 dark:divide-surface-700">
              {detail.novelties.map((n: any) => (
                <div key={n.id} className="px-4 py-2 flex items-center gap-3 text-sm">
                  <span className="font-medium text-surface-800 dark:text-white">{n.employee.firstName} {n.employee.lastName}</span>
                  <span className="text-surface-500">{NOVELTY_LABELS[n.type] ?? n.type}</span>
                  <span className="font-mono text-surface-700 dark:text-surface-300">{n.hours ? `${Number(n.hours)}h` : money(Number(n.amount))}</span>
                  {n.notes && <span className="text-xs text-surface-400 truncate">{n.notes}</span>}
                  <button onClick={() => removeNovelty(n.id)} className="ml-auto text-xs text-red-500 hover:underline">Eliminar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Roles individuales */}
      {!detail && (
        <p className="text-center text-surface-400 text-sm py-14">
          No hay rol generado para {MONTHS[month - 1]} {year}. Registra empleados y pulsa “Generar rol de pagos”.
        </p>
      )}
      {payslips.length > 0 && (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                <th className="text-left px-4 py-2.5">Empleado</th>
                <th className="text-left px-4 py-2.5">Departamento</th>
                <th className="text-right px-4 py-2.5">Gravado IESS</th>
                <th className="text-right px-4 py-2.5">Beneficios</th>
                <th className="text-right px-4 py-2.5">Descuentos</th>
                <th className="text-right px-4 py-2.5">Neto</th>
                <th className="text-right px-4 py-2.5">Costo patronal</th>
                <th className="px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {payslips.map((p: any) => (
                <Fragment key={p.id}>
                  <tr onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                    className="hover:bg-surface-50 dark:hover:bg-surface-700/30 cursor-pointer">
                    <td className="px-4 py-3">
                      <p className="font-medium text-surface-800 dark:text-white">{p.employee.firstName} {p.employee.lastName}</p>
                      <p className="text-xs text-surface-400">{p.employee.position}</p>
                    </td>
                    <td className="px-4 py-3 text-surface-500">{p.employee.department?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(Number(p.grossEarnings))}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(Number(p.otherEarnings))}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400">−{money(Number(p.totalDeductions))}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-green-600 dark:text-green-400">{money(Number(p.netPay))}</td>
                    <td className="px-4 py-3 text-right font-mono text-surface-500">{money(Number(p.employerCost))}</td>
                    <td className="px-2 text-surface-400">{expanded === p.id ? '▲' : '▼'}</td>
                  </tr>
                  {expanded === p.id && (
                    <tr>
                      <td colSpan={8} className="bg-surface-50 dark:bg-surface-900/40 px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm">
                          {(['EARNING', 'DEDUCTION', 'EMPLOYER'] as const).map((kind) => (
                            <div key={kind}>
                              <p className="text-xs font-semibold uppercase text-surface-400 mb-2">
                                {kind === 'EARNING' ? '➕ Ingresos' : kind === 'DEDUCTION' ? '➖ Descuentos' : '🏢 Costo patronal (provisiones)'}
                              </p>
                              <ul className="space-y-1">
                                {p.lines.filter((l: any) => l.kind === kind).map((l: any) => (
                                  <li key={l.id} className="flex justify-between gap-3">
                                    <span className="text-surface-600 dark:text-surface-300">{l.label}</span>
                                    <span className="font-mono text-surface-800 dark:text-white">{money(Number(l.amount))}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UtilidadesPanel defaultYear={year - 1} />

      {/* Modal asiento contable */}
      {entryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEntryModal(null)}>
          <div className="bg-white dark:bg-surface-800 rounded-xl shadow-xl max-w-2xl w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-surface-900 dark:text-white">
                {entryModal.entryNumber} · {entryModal.description}
              </h3>
              <button onClick={() => setEntryModal(null)} className="text-surface-400 hover:text-surface-600 text-lg">×</button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-xs uppercase text-surface-500 border-b border-surface-200 dark:border-surface-700">
                <th className="text-left py-2">Cuenta</th><th className="text-right py-2">Debe</th><th className="text-right py-2">Haber</th>
              </tr></thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {entryModal.lines?.map((l: any) => (
                  <tr key={l.id}>
                    <td className="py-2 text-surface-700 dark:text-surface-300"><span className="font-mono text-xs text-brand-500">{l.accountCode}</span> {l.accountName}</td>
                    <td className="py-2 text-right font-mono">{Number(l.debit) > 0 ? money(Number(l.debit)) : '—'}</td>
                    <td className="py-2 text-right font-mono">{Number(l.credit) > 0 ? money(Number(l.credit)) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
