import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { treasuryApi } from '../../api/treasury';
import { useToast } from '../../components/ui/Toast';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const inputCls = 'bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

/**
 * Asistencia biométrica: importa las marcaciones del reloj (CSV) y convierte
 * el resumen mensual en novedades de horas extras del rol de pagos.
 * Formato CSV esperado (una línea por día y empleado):
 *   cedula;fecha(YYYY-MM-DD);entrada(HH:mm);salida(HH:mm)
 */
export default function AttendancePage() {
  const toast = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [showImport, setShowImport] = useState(false);

  const load = () => {
    setLoading(true);
    treasuryApi.getAttendanceSummary(year, month)
      .then((r) => setSummary(r.data))
      .catch(() => toast.error('Error al cargar la asistencia'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [year, month]);

  const parseCsv = (text: string) => {
    return text.split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.toLowerCase().startsWith('cedula'))
      .map((l) => {
        const [cedula, date, checkIn, checkOut] = l.split(/[;,\t]/).map((x) => x?.trim());
        return { cedula, date, checkIn, checkOut };
      })
      .filter((r) => r.cedula && r.date && r.checkIn && r.checkOut);
  };

  const importCsv = async () => {
    const records = parseCsv(csvText);
    if (records.length === 0) { toast.error('No se encontraron registros válidos (formato: cedula;fecha;entrada;salida)'); return; }
    setBusy(true);
    try {
      const { data } = await treasuryApi.importAttendance(records);
      toast.success(`${data.imported} marcaciones importadas${data.skipped.length ? ` · ${data.skipped.length} omitidas` : ''}`);
      if (data.skipped.length) console.warn('Omitidas:', data.skipped);
      setCsvText(''); setShowImport(false); load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al importar');
    } finally { setBusy(false); }
  };

  const applyToPayroll = async () => {
    setBusy(true);
    try {
      const { data } = await treasuryApi.applyOvertime(year, month);
      toast.success(`${data.noveltiesCreated} novedades de horas extras generadas en el rol de ${MONTHS[month - 1]}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'No se pudo aplicar a nómina');
    } finally { setBusy(false); }
  };

  const totals = summary.reduce((acc, s) => ({
    sup: acc.sup + s.supplementary, ext: acc.ext + s.extraordinary,
  }), { sup: 0, ext: 0 });

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🕐</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Asistencia (Biométrico)</h1>
            <p className="text-sm text-surface-500">Marcaciones → horas suplementarias (+50%) y extraordinarias (+100%) del rol</p>
          </div>
        </div>
        <Link to="/nomina" className="text-sm px-4 py-2 border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700">💵 Rol de Pagos</Link>
      </div>

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
        <div className="flex-1" />
        <button onClick={() => setShowImport((v) => !v)} className="px-4 py-2 text-sm bg-surface-100 dark:bg-surface-700 rounded-lg text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600">
          📥 Importar marcaciones
        </button>
        {summary.length > 0 && (totals.sup > 0 || totals.ext > 0) && (
          <button onClick={applyToPayroll} disabled={busy}
            className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
            ⚡ Generar novedades en nómina
          </button>
        )}
      </div>

      {showImport && (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4 mb-6 space-y-3">
          <p className="text-sm text-surface-600 dark:text-surface-300">
            Pega el export del reloj biométrico (ZKTeco o similar). Una línea por día:
            <code className="block bg-surface-100 dark:bg-surface-900 rounded px-2 py-1 mt-1 text-xs">cedula;fecha;entrada;salida → 1710002220;2026-07-06;08:00;18:30</code>
          </p>
          <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={6}
            className={`${inputCls} w-full font-mono text-xs`} placeholder={'1710002220;2026-07-06;08:00;18:30\n1710002220;2026-07-11;09:00;13:00'} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm border border-surface-300 dark:border-surface-600 rounded-lg text-surface-600 dark:text-surface-300">Cancelar</button>
            <button onClick={importCsv} disabled={busy} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
              {busy ? 'Importando…' : 'Importar'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-14"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
              <th className="text-left px-4 py-2.5">Empleado</th>
              <th className="text-center px-4 py-2.5">Días marcados</th>
              <th className="text-right px-4 py-2.5">Horas totales</th>
              <th className="text-right px-4 py-2.5">Suplementarias (+50%)</th>
              <th className="text-right px-4 py-2.5">Extraordinarias (+100%)</th>
            </tr></thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {summary.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-surface-400">Sin marcaciones en {MONTHS[month - 1]} {year}. Importa el archivo del biométrico.</td></tr>}
              {summary.map((s: any) => (
                <tr key={s.employee.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30">
                  <td className="px-4 py-3">
                    <p className="font-medium text-surface-800 dark:text-white">{s.employee.firstName} {s.employee.lastName}</p>
                    <p className="text-xs text-surface-400">{s.employee.cedula}</p>
                  </td>
                  <td className="px-4 py-3 text-center">{s.days}</td>
                  <td className="px-4 py-3 text-right font-mono">{s.totalHours.toFixed(2)}h</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-600 dark:text-amber-400">{s.supplementary > 0 ? `${s.supplementary.toFixed(2)}h` : '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400">{s.extraordinary > 0 ? `${s.extraordinary.toFixed(2)}h` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
