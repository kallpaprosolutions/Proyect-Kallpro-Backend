import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { requisitionsApi } from '../../api/requisitions';
import { companyApi } from '../../api/company';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../hooks/useConfirm';
import { WeightedComparisonMatrix, type RankingEntry } from '../../components/purchases/WeightedComparisonMatrix';
import FlowGuideBanner from '../../components/purchases/FlowGuideBanner';
import { CRITERIA_CATALOG, DEFAULT_CRITERIA, isManualCriterion, getCriterionDef, type Criterion } from '../../data/scoringCriteria';

export default function QuotationComparePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const confirmAction = useConfirm();
  const [req, setReq] = useState<any>(null);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  const [criteria, setCriteria] = useState<Criterion[]>(DEFAULT_CRITERIA);
  const [originalCriteria, setOriginalCriteria] = useState<string | null>(null); // snapshot de los criterios de la requisición
  const [manual, setManual] = useState<Record<string, Record<string, number>>>({}); // quotationId → { QUALITY: 80 }
  const [advanceReq, setAdvanceReq] = useState<Record<string, number>>({}); // quotationId → %
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [minQuotations, setMinQuotations] = useState(3);

  useEffect(() => {
    companyApi.getSettings()
      .then((r) => setMinQuotations(r.data?.settings?.purchases?.minQuotations ?? 3))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([requisitionsApi.getOne(id), requisitionsApi.getQuotations(id)])
      .then(([r, q]) => {
        setReq(r.data);
        setQuotations(q.data);
        if (Array.isArray(r.data.scoringCriteria) && r.data.scoringCriteria.length) {
          setCriteria(r.data.scoringCriteria);
          setOriginalCriteria(JSON.stringify(r.data.scoringCriteria));
        }
        // precargar scores manuales y anticipos exigidos existentes
        const m: Record<string, Record<string, number>> = {};
        const adv: Record<string, number> = {};
        for (const quote of q.data) {
          if (quote.manualScores) m[quote.id] = quote.manualScores;
          if (quote.advanceRequiredPct != null) adv[quote.id] = quote.advanceRequiredPct;
        }
        setManual(m);
        setAdvanceReq(adv);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const weightSum = criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0);
  const manualCriteria = criteria.filter((c) => isManualCriterion(c.key));
  const hasPayment = criteria.some((c) => c.key === 'PAYMENT');
  // Los criterios se definieron en la requisición; modificarlos con cotizaciones ya cargadas altera el comparativo
  const criteriaModified = originalCriteria !== null && JSON.stringify(criteria) !== originalCriteria && quotations.length > 0;

  function toggleCriterion(key: string) {
    setCriteria((prev) => {
      if (prev.some((c) => c.key === key)) return prev.filter((c) => c.key !== key);
      const def = getCriterionDef(key)!;
      return [...prev, { key, label: def.label, weight: 0, direction: def.direction }];
    });
  }
  function setWeight(key: string, weight: number) {
    setCriteria((prev) => prev.map((c) => c.key === key ? { ...c, weight } : c));
  }

  async function handleEvaluate() {
    if (!id) return;
    if (Math.abs(weightSum - 100) > 0.01) { toast.error(`Los pesos deben sumar 100 (actual: ${weightSum})`); return; }
    if (criteriaModified && !await confirmAction({
      title: 'Modificar criterios',
      message: 'Estás modificando los criterios/pesos definidos en la requisición con cotizaciones ya cargadas. Esto cambia las reglas del comparativo para todos los proveedores. ¿Continuar y recalcular?',
    })) return;
    setEvaluating(true);
    try {
      // 1) guardar criterios
      await requisitionsApi.saveCriteria(id, criteria);
      // 2) guardar scores manuales + anticipo exigido por cotización
      await Promise.all(quotations.map((q) =>
        requisitionsApi.saveManualScores(id, q.id, manual[q.id] ?? {}, advanceReq[q.id]),
      ));
      // 3) evaluar
      const { data } = await requisitionsApi.evaluate(id);
      setRanking(data.ranking);
      setWinnerId(data.winnerQuotationId);
      setOriginalCriteria(JSON.stringify(criteria)); // los criterios guardados pasan a ser los vigentes
      toast.success('Comparativo ponderado calculado');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al calcular el comparativo');
    } finally {
      setEvaluating(false);
    }
  }

  async function handleSelectWinner(quotationId: string, supplierName: string) {
    if (quotations.length < minQuotations) {
      toast.error(`Se requieren al menos ${minQuotations} cotizaciones para elegir un ganador (${quotations.length}/${minQuotations})`);
      return;
    }
    const isTop = quotationId === winnerId;
    let overrideReason: string | undefined;
    if (!isTop) {
      const r = window.prompt(`${supplierName} no es la mejor opción por puntaje. Indica el motivo para elegirlo igual:`);
      if (r === null) return;
      overrideReason = r;
    } else if (!await confirmAction({ title: 'Generar orden de compra', message: `¿Generar la Orden de Compra con ${supplierName} (mejor opción)?` })) {
      return;
    }
    setSaving(true);
    try {
      const { data } = await requisitionsApi.selectWinner(id!, quotationId, overrideReason);
      toast.success(`OC ${data.purchaseOrder.poNumber} generada`);
      navigate(`/purchases/${data.purchaseOrder.id}`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al seleccionar ganador');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-surface-500">Cargando...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">⚖️</div>
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Comparativo Ponderado de Proveedores</h1>
          <p className="text-sm text-surface-500">{req?.reqNumber} — {req?.title}</p>
        </div>
      </div>

      {/* Guía del flujo */}
      <FlowGuideBanner
        step={3}
        nextLabel={ranking.length === 0
          ? 'Ajusta los pesos si hace falta y pulsa "Calcular comparativo"'
          : 'Elige al ganador en la matriz para generar la Orden de Compra'}
      />

      {/* Progreso de cotizaciones: mínimo configurable de proveedores para elegir ganador */}
      <div className={`flex items-center gap-3 rounded-2xl border px-5 py-4 ${quotations.length >= minQuotations
        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'}`}>
        <div className="flex gap-2">
          {Array.from({ length: minQuotations }).map((_, i) => {
            const filled = i < quotations.length;
            return (
              <div key={i}
                className={`flex items-center justify-center w-9 h-9 rounded-lg border text-sm font-bold ${filled
                  ? 'bg-green-100 dark:bg-green-500/20 border-green-300 dark:border-green-600 text-green-700 dark:text-green-400'
                  : 'bg-white/60 dark:bg-surface-900/50 border-dashed border-amber-300 dark:border-amber-600 text-amber-500'}`}>
                {filled ? '✓' : i + 1}
              </div>
            );
          })}
        </div>
        <p className={`text-sm font-medium ${quotations.length >= minQuotations ? 'text-green-700 dark:text-green-400' : 'text-amber-800 dark:text-amber-300'}`}>
          {quotations.length >= minQuotations
            ? `${minQuotations} cotizaciones cargadas — puedes calcular el comparativo y elegir al ganador.`
            : `${quotations.length}/${minQuotations} cotizaciones — ${minQuotations - quotations.length === 1 ? 'falta 1 proveedor' : `faltan ${minQuotations - quotations.length} proveedores`}. No se puede elegir ganador hasta completar ${minQuotations}.`}
        </p>
      </div>

      {/* Panel de criterios y pesos */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-surface-900 dark:text-white">Criterios de evaluación (pesos)</h2>
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${Math.abs(weightSum - 100) < 0.01 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>
            Suma: {weightSum}% {Math.abs(weightSum - 100) < 0.01 ? '✓' : '(debe ser 100)'}
          </span>
        </div>

        {criteriaModified && (
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl px-4 py-3">
            <span className="text-amber-500">⚠️</span>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Estás modificando los criterios definidos en la requisición con cotizaciones ya cargadas.
              Al recalcular, las nuevas reglas aplican a todos los proveedores por igual.
            </p>
          </div>
        )}

        {/* Selección de criterios */}
        <div className="flex flex-wrap gap-2">
          {CRITERIA_CATALOG.map((def) => {
            const active = criteria.some((c) => c.key === def.key);
            return (
              <button key={def.key} onClick={() => toggleCriterion(def.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${active
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-surface-50 dark:bg-surface-900/50 text-surface-600 dark:text-surface-300 border-surface-200 dark:border-surface-700 hover:border-brand-400'}`}>
                {def.icon} {def.label}
              </button>
            );
          })}
        </div>

        {/* Sliders de peso por criterio activo */}
        <div className="space-y-3">
          {criteria.map((c) => {
            const def = getCriterionDef(c.key);
            return (
              <div key={c.key} className="flex items-center gap-3">
                <div className="w-44 flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
                  <span>{def?.icon}</span><span className="truncate">{c.label}</span>
                </div>
                <input type="range" min={0} max={100} step={5} value={c.weight}
                  onChange={(e) => setWeight(c.key, Number(e.target.value))}
                  className="flex-1 accent-brand-500" />
                <input type="number" min={0} max={100} value={c.weight}
                  onChange={(e) => setWeight(c.key, Number(e.target.value))}
                  className="w-16 text-right bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1 text-sm text-surface-900 dark:text-white" />
                <span className="text-xs text-surface-400 w-4">%</span>
              </div>
            );
          })}
        </div>

        {def_help_text(criteria)}
      </div>

      {/* Datos manuales por cotización (calidad, anticipo exigido) */}
      {(manualCriteria.length > 0 || hasPayment) && quotations.length > 0 && (
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5">
          <h2 className="font-semibold text-surface-900 dark:text-white mb-3">Datos por proveedor</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-surface-500 border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left py-2 px-2">Proveedor</th>
                  {manualCriteria.map((c) => <th key={c.key} className="text-center py-2 px-2">{getCriterionDef(c.key)?.icon} {c.label} (0-100)</th>)}
                  {hasPayment && <th className="text-center py-2 px-2">💳 Anticipo exigido (%)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {quotations.map((q) => (
                  <tr key={q.id}>
                    <td className="py-2 px-2 font-medium text-surface-800 dark:text-white">{q.supplier?.name}</td>
                    {manualCriteria.map((c) => (
                      <td key={c.key} className="py-2 px-2 text-center">
                        <input type="number" min={0} max={100} value={manual[q.id]?.[c.key] ?? ''}
                          onChange={(e) => setManual((m) => ({ ...m, [q.id]: { ...(m[q.id] ?? {}), [c.key]: Number(e.target.value) } }))}
                          className="w-20 text-center bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1 text-surface-900 dark:text-white" />
                      </td>
                    ))}
                    {hasPayment && (
                      <td className="py-2 px-2 text-center">
                        <input type="number" min={0} max={100} value={advanceReq[q.id] ?? ''}
                          onChange={(e) => setAdvanceReq((a) => ({ ...a, [q.id]: Number(e.target.value) }))}
                          className="w-20 text-center bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1 text-surface-900 dark:text-white" />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <button onClick={handleEvaluate} disabled={evaluating || quotations.length === 0}
          className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold disabled:opacity-50 transition-colors flex items-center gap-2">
          {evaluating && <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
          ⚖️ Calcular comparativo
        </button>
      </div>

      {quotations.length === 0 ? (
        <div className="text-center py-12 text-surface-400">No hay cotizaciones para comparar.</div>
      ) : (
        <div className="overflow-x-auto">
          <WeightedComparisonMatrix
            criteria={criteria}
            ranking={ranking}
            winnerQuotationId={winnerId}
            canSelect={req?.status === 'QUOTED' && quotations.length >= minQuotations}
            onSelectWinner={saving ? undefined : handleSelectWinner}
          />
        </div>
      )}
    </div>
  );
}

function def_help_text(criteria: Criterion[]) {
  const hasManual = criteria.some((c) => isManualCriterion(c.key));
  if (!hasManual) return null;
  return (
    <p className="text-xs text-surface-400 border-t border-surface-100 dark:border-surface-700 pt-3">
      Los criterios manuales (ej. Calidad) requieren que ingreses una calificación 0-100 por proveedor en la tabla siguiente.
    </p>
  );
}
