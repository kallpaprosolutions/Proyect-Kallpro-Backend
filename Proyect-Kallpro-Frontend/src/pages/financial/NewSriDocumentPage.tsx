import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { sriApi } from '../../api/sriDocuments';
import { purchasesApi } from '../../api/purchases';
import { ollamaApi } from '../../api/ollama';
import { useToast } from '../../components/ui/Toast';
import { Sparkles, Plus, Trash2, ArrowLeft } from 'lucide-react';

/**
 * Ingreso de un documento SRI (factura, nota de crédito o nota de débito) SIN depender de
 * subir un PDF/XML. Cubre los otros dos casos junto al de carga automática de archivo
 * (SriDocumentsPage): manual puro (el usuario escribe todo) y semi-automático (pega el
 * texto de la factura, la IA local pre-llena el formulario, el usuario revisa y completa
 * lo que falte — la tarifa de IVA por ítem, por ejemplo, la IA no la puede inferir con
 * certeza). Ambos casos terminan en el MISMO formulario editable; lo único que cambia es
 * si arrancó vacío o pre-llenado.
 */

const inputCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500';
const labelCls = 'block text-xs font-medium text-surface-500 mb-1';
const money = (n: number) => `$${(Number(n) || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TIPO_TABS: { value: string; label: string }[] = [
  { value: 'FACTURA', label: 'Factura' },
  { value: 'NOTA_CREDITO', label: 'Nota de crédito' },
  { value: 'NOTA_DEBITO', label: 'Nota de débito' },
];

interface ItemRow {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  descuento: string;
  codigoTarifa: string;
  tarifaIva: number;
}

const emptyItem = (defaultTarifa: { codigo: string; porcentaje: number }): ItemRow => ({
  descripcion: '', cantidad: '1', precioUnitario: '', descuento: '0',
  codigoTarifa: defaultTarifa.codigo, tarifaIva: defaultTarifa.porcentaje,
});

// Réplica en cliente del motor del backend (sri-manual-entry.engine.ts) — solo para feedback
// inmediato en pantalla; el backend recalcula y es la fuente de verdad.
function computeTotals(items: ItemRow[]) {
  const buckets: Record<string, number> = { '0': 0, '8': 0, '12': 0, '15': 0, NO_OBJETO: 0, EXENTO: 0 };
  let iva = 0;
  const lines = items.map((it) => {
    const cantidad = Number(it.cantidad) || 0;
    const precioUnitario = Number(it.precioUnitario) || 0;
    const descuento = Number(it.descuento) || 0;
    const precioTotal = Math.max(0, Math.round((cantidad * precioUnitario - descuento) * 100) / 100);
    const valorIva = Math.round(precioTotal * (it.tarifaIva / 100) * 100) / 100;
    if (buckets[it.codigoTarifa] != null) buckets[it.codigoTarifa] += precioTotal;
    iva += valorIva;
    return { precioTotal, valorIva };
  });
  iva = Math.round(iva * 100) / 100;
  const subtotalSum = Object.values(buckets).reduce((s, v) => s + v, 0);
  const total = Math.round((subtotalSum + iva) * 100) / 100;
  return { lines, buckets, iva, total };
}

export default function NewSriDocumentPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [tipoDocumento, setTipoDocumento] = useState('FACTURA');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [rucEmisor, setRucEmisor] = useState('');
  const [razonSocialEmisor, setRazonSocialEmisor] = useState('');
  const [numeroDoc, setNumeroDoc] = useState('');
  const [fechaEmision, setFechaEmision] = useState(() => new Date().toISOString().slice(0, 10));
  const [formaPago, setFormaPago] = useState('');

  const [confirmedDocs, setConfirmedDocs] = useState<any[]>([]);
  const [docModificadoId, setDocModificadoId] = useState('');
  const [docModificadoManual, setDocModificadoManual] = useState({ numero: '', fecha: '' });

  const [ivaTariffs, setIvaTariffs] = useState<{ codigo: string; descripcion: string; porcentaje: number }[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);

  const [showAi, setShowAi] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiSource, setAiSource] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const defaultTarifa = useMemo(() => {
    const active = ivaTariffs.filter((t) => t.codigo !== 'NO_OBJETO' && t.codigo !== 'EXENTO');
    return active.sort((a, b) => b.porcentaje - a.porcentaje)[0] ?? { codigo: '15', porcentaje: 15 };
  }, [ivaTariffs]);

  useEffect(() => {
    purchasesApi.getSuppliers().then((r) => setSuppliers((r.data ?? []).filter((s: any) => s.isActive !== false))).catch(() => {});
    sriApi.catalogs().then((r) => setIvaTariffs(r.data?.ivaTariffs ?? [])).catch(() => {});
    sriApi.list('CONFIRMED').then((r) => setConfirmedDocs(r.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (items.length === 0 && ivaTariffs.length > 0) setItems([emptyItem(defaultTarifa)]);
  }, [ivaTariffs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const isNota = tipoDocumento === 'NOTA_CREDITO' || tipoDocumento === 'NOTA_DEBITO';
  const facturasDelProveedor = useMemo(
    () => confirmedDocs.filter((d) => d.tipoDocumento === 'FACTURA' && (!supplierId || d.supplierId === supplierId)),
    [confirmedDocs, supplierId],
  );

  const onSupplierChange = (id: string) => {
    setSupplierId(id);
    const s = suppliers.find((x) => x.id === id);
    if (s) { setRucEmisor(s.ruc ?? ''); setRazonSocialEmisor(s.razonSocial ?? s.name ?? ''); }
    setDocModificadoId('');
  };

  const onDocModificadoChange = (id: string) => {
    setDocModificadoId(id);
    const d = confirmedDocs.find((x) => x.id === id);
    if (d) setDocModificadoManual({ numero: d.numeroDoc ?? '', fecha: (d.fechaEmision ?? '').slice(0, 10) });
  };

  const updateItem = (i: number, patch: Partial<ItemRow>) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItems((prev) => [...prev, emptyItem(defaultTarifa)]);
  const removeItem = (i: number) => setItems((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

  const onTarifaChange = (i: number, codigo: string) => {
    const t = ivaTariffs.find((x) => x.codigo === codigo);
    updateItem(i, { codigoTarifa: codigo, tarifaIva: t?.porcentaje ?? 0 });
  };

  const runAiExtract = async () => {
    if (aiText.trim().length < 10) { setAiError('Pega el texto de la factura (mínimo 10 caracteres)'); return; }
    setAiLoading(true); setAiError('');
    try {
      const res = await ollamaApi.extractInvoice(aiText);
      const r = res.data as any;
      setRucEmisor(r.rucEmisor ?? '');
      setRazonSocialEmisor(r.razonSocialEmisor ?? '');
      setNumeroDoc(r.numeroDoc ?? '');
      if (r.fechaEmision) setFechaEmision(r.fechaEmision);
      if (Array.isArray(r.items) && r.items.length > 0) {
        setItems(r.items.map((it: any) => ({
          descripcion: it.description ?? '', cantidad: String(it.quantity ?? 1),
          precioUnitario: String(it.unitPrice ?? 0), descuento: '0',
          codigoTarifa: defaultTarifa.codigo, tarifaIva: defaultTarifa.porcentaje,
        })));
      }
      setAiConfidence(r.confidence ?? null);
      setAiSource(true);
      toast.success('Datos pre-llenados. Revisa cada campo antes de guardar — la IA puede equivocarse, sobre todo en la tarifa de IVA por ítem.', '✨');
    } catch (e: any) {
      setAiError(e?.response?.data?.error || 'No se pudo extraer. ¿Está Ollama corriendo?');
    } finally {
      setAiLoading(false);
    }
  };

  const totals = useMemo(() => computeTotals(items), [items]);
  const itemsValid = items.length > 0 && items.every((it) => it.descripcion.trim() && Number(it.cantidad) > 0 && Number(it.precioUnitario) >= 0);

  const submit = async () => {
    setError('');
    if (!rucEmisor.trim() || !razonSocialEmisor.trim()) { setError('El RUC y la razón social del emisor son obligatorios'); return; }
    if (!fechaEmision) { setError('La fecha de emisión es obligatoria'); return; }
    if (!itemsValid) { setError('Revisa los ítems: cada uno necesita descripción, cantidad mayor a cero y precio unitario'); return; }
    if (isNota && !docModificadoManual.numero.trim()) { setError('Indica qué documento modifica esta nota'); return; }

    setSubmitting(true);
    try {
      const res = await sriApi.createManual({
        tipoDocumento,
        supplierId: supplierId || undefined,
        rucEmisor: rucEmisor.trim(),
        razonSocialEmisor: razonSocialEmisor.trim(),
        numeroDoc: numeroDoc.trim() || undefined,
        fechaEmision,
        formaPago: formaPago || undefined,
        docModificadoTipo: isNota ? 'FACTURA' : undefined,
        docModificadoNumero: isNota ? docModificadoManual.numero.trim() : undefined,
        docModificadoFecha: isNota ? (docModificadoManual.fecha || undefined) : undefined,
        items: items.map((it) => ({
          descripcion: it.descripcion.trim(),
          cantidad: Number(it.cantidad),
          precioUnitario: Number(it.precioUnitario),
          descuento: Number(it.descuento) || 0,
          codigoTarifa: it.codigoTarifa,
          tarifaIva: it.tarifaIva,
        })),
        source: aiSource ? 'IA' : 'MANUAL',
        aiConfidence: aiSource ? (aiConfidence ?? undefined) : undefined,
      });
      toast.success('Documento registrado — revísalo y confírmalo para contabilizarlo', '✓');
      navigate(`/sri/${res.data.document.id}`, { state: { possibleDuplicates: res.data.possibleDuplicates } });
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo registrar el documento');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <Link to="/sri" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 mb-4">
        <ArrowLeft className="w-4 h-4" /> Documentos SRI
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Registrar documento manualmente</h1>
        <p className="text-sm text-surface-500 mt-0.5">
          Para cuando no tienes el PDF/XML del SRI a la mano: escribe los datos tú mismo, o pega el texto
          de la factura y deja que la IA pre-llene el formulario para que solo lo revises y completes.
        </p>
      </div>

      <div className="space-y-5">
        {/* Tipo de documento */}
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-4">
          <p className={labelCls}>Tipo de documento</p>
          <div className="flex gap-2 flex-wrap">
            {TIPO_TABS.map((t) => (
              <button key={t.value} type="button" onClick={() => setTipoDocumento(t.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${tipoDocumento === t.value ? 'bg-brand-500 border-brand-500 text-white' : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Asistente IA */}
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-4">
          <button type="button" onClick={() => setShowAi((v) => !v)} className="flex items-center gap-2 text-sm font-medium text-brand-600 dark:text-brand-400">
            <Sparkles className="w-4 h-4" /> {showAi ? 'Ocultar asistente de IA' : 'Pegar texto y pre-llenar con IA (opcional)'}
          </button>
          {showAi && (
            <div className="mt-3 space-y-3">
              <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} rows={6}
                placeholder={'Pega aquí el texto de la factura, tal como aparece en el PDF o la foto transcrita…'}
                className={`${inputCls} font-mono text-xs`} />
              {aiError && <p className="text-xs text-red-600 dark:text-red-400">{aiError}</p>}
              <button type="button" onClick={runAiExtract} disabled={aiLoading}
                className="text-sm px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
                {aiLoading ? 'Extrayendo…' : 'Extraer y pre-llenar formulario'}
              </button>
              {aiConfidence != null && (
                <p className="text-xs text-surface-500">Confianza de la extracción: <b>{aiConfidence}%</b> — completa o corrige lo que falte abajo, especialmente la tarifa de IVA de cada ítem.</p>
              )}
            </div>
          )}
        </div>

        {/* Proveedor */}
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-4 space-y-3">
          <p className="text-sm font-semibold text-surface-700 dark:text-surface-300">Proveedor</p>
          <div>
            <label className={labelCls}>Proveedor registrado (opcional — autocompleta RUC y razón social)</label>
            <select value={supplierId} onChange={(e) => onSupplierChange(e.target.value)} className={inputCls}>
              <option value="">Sin seleccionar — escribir manualmente abajo</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.razonSocial || s.name} {s.ruc ? `· ${s.ruc}` : ''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>RUC del emisor</label>
              <input value={rucEmisor} onChange={(e) => setRucEmisor(e.target.value)} placeholder="1792146739001" className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>Razón social</label>
              <input value={razonSocialEmisor} onChange={(e) => setRazonSocialEmisor(e.target.value)} placeholder="Ferretería El Constructor S.A." className={inputCls} />
            </div>
          </div>
        </div>

        {/* Datos del comprobante */}
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-4 space-y-3">
          <p className="text-sm font-semibold text-surface-700 dark:text-surface-300">Datos del comprobante</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>N° de comprobante</label>
              <input value={numeroDoc} onChange={(e) => setNumeroDoc(e.target.value)} placeholder="001-001-000004521" className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>Fecha de emisión</label>
              <input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Forma de pago (opcional)</label>
              <select value={formaPago} onChange={(e) => setFormaPago(e.target.value)} className={inputCls}>
                <option value="">Sin especificar</option>
                <option value="EFECTIVO">Efectivo</option>
                <option value="CREDITO">Crédito</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="TARJETA">Tarjeta</option>
              </select>
            </div>
          </div>
        </div>

        {/* Documento modificado (solo NC/ND) */}
        {isNota && (
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-4 space-y-3">
            <p className="text-sm font-semibold text-surface-700 dark:text-surface-300">Documento que modifica esta nota</p>
            {facturasDelProveedor.length > 0 && (
              <div>
                <label className={labelCls}>Buscar en facturas confirmadas {supplierId ? 'de este proveedor' : ''}</label>
                <select value={docModificadoId} onChange={(e) => onDocModificadoChange(e.target.value)} className={inputCls}>
                  <option value="">No está en el sistema — escribir manualmente</option>
                  {facturasDelProveedor.map((d) => <option key={d.id} value={d.id}>{d.numeroDoc} · {new Date(d.fechaEmision).toLocaleDateString('es')} · {money(Number(d.total))}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>N° de la factura modificada</label>
                <input value={docModificadoManual.numero} onChange={(e) => setDocModificadoManual((p) => ({ ...p, numero: e.target.value }))} placeholder="001-001-000004521" className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className={labelCls}>Fecha de esa factura</label>
                <input type="date" value={docModificadoManual.fecha} onChange={(e) => setDocModificadoManual((p) => ({ ...p, fecha: e.target.value }))} className={inputCls} />
              </div>
            </div>
          </div>
        )}

        {/* Ítems */}
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
          <div className="px-4 py-2.5 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
            <p className="text-sm font-semibold text-surface-700 dark:text-surface-300">Ítems</p>
            <button type="button" onClick={addItem} className="text-xs px-2.5 py-1.5 border border-surface-200 dark:border-surface-700 rounded-lg text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Agregar ítem
            </button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-[10px] uppercase">
              <th className="text-left px-3 py-2">Descripción</th>
              <th className="text-right px-2 py-2 w-20">Cant.</th>
              <th className="text-right px-2 py-2 w-24">P. unit.</th>
              <th className="text-right px-2 py-2 w-20">Desc.</th>
              <th className="text-left px-2 py-2 w-32">Tarifa IVA</th>
              <th className="text-right px-3 py-2 w-24">Total</th>
              <th className="w-8"></th>
            </tr></thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5"><input value={it.descripcion} onChange={(e) => updateItem(i, { descripcion: e.target.value })} placeholder="Descripción del ítem" className={inputCls} /></td>
                  <td className="px-2 py-1.5"><input type="number" min="0" step="0.01" value={it.cantidad} onChange={(e) => updateItem(i, { cantidad: e.target.value })} className={`${inputCls} text-right`} /></td>
                  <td className="px-2 py-1.5"><input type="number" min="0" step="0.01" value={it.precioUnitario} onChange={(e) => updateItem(i, { precioUnitario: e.target.value })} className={`${inputCls} text-right`} /></td>
                  <td className="px-2 py-1.5"><input type="number" min="0" step="0.01" value={it.descuento} onChange={(e) => updateItem(i, { descuento: e.target.value })} className={`${inputCls} text-right`} /></td>
                  <td className="px-2 py-1.5">
                    <select value={it.codigoTarifa} onChange={(e) => onTarifaChange(i, e.target.value)} className={inputCls}>
                      {ivaTariffs.map((t) => <option key={t.codigo} value={t.codigo}>{t.descripcion} ({t.porcentaje}%)</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-surface-900 dark:text-white">{money(totals.lines[i]?.precioTotal ?? 0)}</td>
                  <td className="px-2 py-1.5 text-center">
                    <button type="button" onClick={() => removeItem(i)} className="text-surface-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-surface-100 dark:border-surface-700 px-4 py-3 flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              {Object.entries(totals.buckets).filter(([, v]) => v > 0).map(([k, v]) => (
                <div key={k} className="flex justify-between text-surface-500"><span>Subtotal {k}</span><span className="font-mono">{money(v)}</span></div>
              ))}
              <div className="flex justify-between text-surface-500"><span>IVA</span><span className="font-mono">{money(totals.iva)}</span></div>
              <div className="flex justify-between font-semibold text-surface-900 dark:text-white border-t border-surface-100 dark:border-surface-700 pt-1"><span>Total</span><span className="font-mono">{money(totals.total)}</span></div>
            </div>
          </div>
        </div>

        {error && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>}

        <div className="flex gap-3 justify-end">
          <Link to="/sri" className="px-4 py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 text-sm font-medium hover:bg-surface-50 dark:hover:bg-surface-700">Cancelar</Link>
          <button type="button" onClick={submit} disabled={submitting}
            className="px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium">
            {submitting ? 'Guardando…' : 'Guardar y revisar'}
          </button>
        </div>
      </div>
    </div>
  );
}
