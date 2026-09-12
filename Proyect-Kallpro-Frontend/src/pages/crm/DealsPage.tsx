import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { crmApi } from '../../api/crm';
import { inventoryApi } from '../../api/inventory';
import { useToast } from '../../components/ui/Toast';
import PageHeader from '../../components/ui/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Briefcase, Target } from 'lucide-react';
import { SkeletonTable } from '../../components/ui/Skeleton';

const STAGES = ['', 'LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
const STAGE_LABELS: Record<string, string> = {
  LEAD: 'Lead', QUALIFIED: 'Calificado', PROPOSAL: 'Propuesta',
  NEGOTIATION: 'Negociación', WON: 'Ganado', LOST: 'Perdido',
};

export default function DealsPage() {
  const queryClient = useQueryClient();
  const [stageFilter, setStageFilter] = useState('');
  const [openDeal, setOpenDeal] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['crm-deals', stageFilter],
    queryFn: () => crmApi.listDeals({ stage: stageFilter || undefined, limit: 100 }).then(r => r.data),
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => crmApi.updateDealStage(id, stage),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-deals'] }),
  });

  const deals = data?.deals ?? [];
  const total = deals.reduce((s: number, d: any) => s + Number(d.amountUsd ?? d.value ?? 0), 0);

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Oportunidades"
        subtitle={`${data?.total ?? 0} deals · Total: $${total.toLocaleString()}`}
        icon={<Briefcase className="w-5 h-5" />}
        actions={
          <Link to="/crm/pipeline">
            <Button size="sm" icon={<Target className="w-4 h-4" />}>Ver Kanban</Button>
          </Link>
        }
      />

      {/* Stage filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STAGES.map(stage => (
          <button
            key={stage}
            onClick={() => setStageFilter(stage)}
            className={[
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              stageFilter === stage
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700',
            ].join(' ')}
          >
            {stage ? STAGE_LABELS[stage] ?? stage : 'Todos'}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
        {isLoading ? (
          <SkeletonTable rows={6} cols={4} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Deal</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide hidden md:table-cell">Empresa</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Valor</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Etapa</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Prob.</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {deals.map((deal: any) => (
                <tr key={deal.id} className="hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-surface-800 dark:text-white">{deal.name ?? deal.title}</p>
                    <p className="text-xs text-surface-400">
                      {deal.contact?.firstName} {deal.contact?.lastName ?? ''}
                    </p>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell text-surface-600 dark:text-surface-300">
                    {deal.crmCompany?.legalName ?? deal.crmCompany?.name ?? '—'}
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-surface-900 dark:text-white">
                    ${Number(deal.amountUsd ?? deal.value ?? 0).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <select
                      value={deal.stage}
                      onChange={e => stageMutation.mutate({ id: deal.id, stage: e.target.value })}
                      className="text-xs px-2 py-1 rounded-full font-medium bg-surface-100 dark:bg-surface-700 border-0 cursor-pointer text-surface-700 dark:text-surface-200 focus:outline-none"
                    >
                      {STAGES.filter(Boolean).map(s => (
                        <option key={s} value={s}>{STAGE_LABELS[s] ?? s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <Badge variant={deal.probability >= 70 ? 'success' : deal.probability >= 40 ? 'warning' : 'neutral'}>
                      {deal.probability ?? 0}%
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-center">
                    {deal.salesQuotationId ? (
                      <Link to="/sales/quotations" className="text-xs text-green-600 dark:text-green-400 font-medium hover:underline">✓ Cotización generada</Link>
                    ) : (
                      <button onClick={() => setOpenDeal(deal)} className="text-xs text-brand-500 hover:text-brand-600 font-medium">Productos / Cotizar →</button>
                    )}
                  </td>
                </tr>
              ))}
              {deals.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-surface-400">Sin deals registrados</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {openDeal && (
        <DealProductsModal
          deal={openDeal}
          onClose={() => setOpenDeal(null)}
          onChanged={() => { queryClient.invalidateQueries({ queryKey: ['crm-deals'] }); }}
        />
      )}
    </div>
  );
}

/**
 * Puente CRM → Ventas: los productos conversados en la oportunidad. Al ganar el deal la
 * cotización se genera sola con estas líneas; el botón la genera a mano en cualquier etapa.
 */
function DealProductsModal({ deal, onClose, onChanged }: { deal: any; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [items, setItems] = useState<Array<{ productId: string; description: string; quantity: number; unitPrice: number }>>([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    inventoryApi.getProducts().then((r) => setProducts(Array.isArray(r.data) ? r.data : r.data?.products ?? [])).catch(() => setProducts([]));
    crmApi.getDealItems(deal.id).then((r) => setItems(r.data.map((i: any) => ({
      productId: i.productId, description: i.description ?? '', quantity: Number(i.quantity), unitPrice: Number(i.unitPrice),
    })))).catch(() => setItems([]));
  }, [deal.id]);

  const addLine = () => setItems((prev) => [...prev, { productId: '', description: '', quantity: 1, unitPrice: 0 }]);
  const update = (idx: number, patch: Partial<(typeof items)[number]>) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const remove = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const onPickProduct = (idx: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    update(idx, { productId, unitPrice: p ? Number(p.salePrice ?? 0) : 0 });
  };
  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const save = async () => {
    if (items.some((i) => !i.productId)) { toast.error('Selecciona un producto en cada línea', 'Faltan productos'); return false; }
    setSaving(true);
    try {
      await crmApi.setDealItems(deal.id, items.map((i) => ({ ...i, description: i.description || null })));
      toast.success('Productos de la oportunidad guardados', '✓');
      onChanged();
      return true;
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudieron guardar los productos', 'Error');
      return false;
    } finally { setSaving(false); }
  };

  const generate = async () => {
    if (!(await save())) return;
    setGenerating(true);
    try {
      const r = await crmApi.generateQuotation(deal.id);
      toast.success(`${r.data.quoteNumber}${r.data.customerCreated ? ' · cliente creado en Ventas' : ''}`, '✓ Cotización generada');
      onChanged();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo generar la cotización', 'Error');
    } finally { setGenerating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-surface-800 rounded-xl shadow-xl max-w-3xl w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="font-semibold text-surface-900 dark:text-white">Productos de "{deal.name ?? deal.title}"</h3>
          <p className="text-xs text-surface-500">Al marcar la oportunidad como <b>Ganada</b>, la cotización de venta se genera sola con estas líneas y el cliente se crea en Ventas si no existe.</p>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <select value={it.productId} onChange={(e) => onPickProduct(idx, e.target.value)}
                className="col-span-5 px-2 py-1.5 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white">
                <option value="">— Producto —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.sku ? `${p.sku} · ` : ''}{p.name}</option>)}
              </select>
              <input type="number" min={0.0001} step="any" value={it.quantity} onChange={(e) => update(idx, { quantity: Number(e.target.value) })}
                className="col-span-2 px-2 py-1.5 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white" placeholder="Cant." />
              <input type="number" min={0} step="0.01" value={it.unitPrice} onChange={(e) => update(idx, { unitPrice: Number(e.target.value) })}
                className="col-span-2 px-2 py-1.5 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white" placeholder="Precio" />
              <span className="col-span-2 text-right text-sm font-mono text-surface-700 dark:text-surface-300">${(it.quantity * it.unitPrice).toFixed(2)}</span>
              <button onClick={() => remove(idx)} className="col-span-1 text-surface-400 hover:text-red-500 text-sm">✕</button>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-surface-400 text-center py-4">Sin productos todavía.</p>}
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button onClick={addLine} className="text-sm text-brand-600 dark:text-brand-400 hover:underline">+ Agregar producto</button>
          <span className="text-sm font-semibold text-surface-900 dark:text-white">Total ${total.toFixed(2)}</span>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-surface-100 dark:border-surface-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300">Cerrar</button>
          <button onClick={save} disabled={saving || generating}
            className="px-4 py-2 text-sm rounded-lg border border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar productos'}
          </button>
          <button onClick={generate} disabled={saving || generating || items.length === 0}
            className="px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium disabled:opacity-50">
            {generating ? 'Generando…' : '🧾 Generar cotización en Ventas'}
          </button>
        </div>
      </div>
    </div>
  );
}
