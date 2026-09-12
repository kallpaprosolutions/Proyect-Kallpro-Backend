import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { portalApi } from '../../api/portal';

export default function PortalQuotePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rfq, setRfq] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [itemPrices, setItemPrices] = useState<Record<string, { unitPrice: string; deliveryDays: string; notes: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    portalApi.getRFQs().then((r) => {
      const found = r.data.find((rfq: any) => rfq.id === id);
      if (!found) { navigate('/portal/rfqs'); return; }
      setRfq(found);

      // Pre-fill from existing response
      const existing = found.portalResponses?.[0];
      if (existing) {
        setNotes(existing.notes || '');
        setValidUntil(existing.validUntil ? existing.validUntil.split('T')[0] : '');
      }

      // Init price fields
      const init: Record<string, any> = {};
      found.items.forEach((item: any) => {
        if (item.product) {
          init[item.product.id] = { unitPrice: '', deliveryDays: '', notes: '' };
        }
      });
      setItemPrices(init);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const items = rfq.items
        .filter((item: any) => item.product && itemPrices[item.product.id]?.unitPrice)
        .map((item: any) => ({
          productId: item.product.id,
          quantity: Number(item.quantity),
          unitPrice: parseFloat(itemPrices[item.product.id].unitPrice),
          deliveryDays: itemPrices[item.product.id].deliveryDays
            ? parseInt(itemPrices[item.product.id].deliveryDays)
            : undefined,
          notes: itemPrices[item.product.id].notes || undefined,
        }));

      if (items.length === 0) { setError('Debes ingresar al menos un precio'); setSaving(false); return; }

      await portalApi.submitQuotation(id!, { notes, validUntil: validUntil || undefined, items });
      navigate('/portal/rfqs');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al enviar cotización');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Cargando...</div>;
  if (!rfq) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link to="/portal/rfqs" className="text-gray-400 hover:text-gray-600">← RFQs</Link>
          <h1 className="text-lg font-semibold text-gray-900">Cotizar: {rfq.reqNumber}</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* RFQ info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="font-semibold text-blue-900">{rfq.title}</p>
            <p className="text-sm text-blue-700 mt-1">{rfq.notes || 'Sin notas adicionales'}</p>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}

          {/* Encabezado cotización */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas de cotización</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Condiciones, garantías, notas..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Válido hasta</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                <span className="col-span-4">Producto</span>
                <span className="col-span-2 text-right">Cant. Requerida</span>
                <span className="col-span-2">Precio Unit. *</span>
                <span className="col-span-2">Días Entrega</span>
                <span className="col-span-2">Notas</span>
              </div>
            </div>
            {rfq.items.map((item: any) => (
              <div key={item.id} className="px-5 py-3 border-b border-gray-100">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <p className="font-medium text-sm text-gray-900">{item.description}</p>
                    {item.product && <p className="text-xs text-gray-400">{item.product.sku || item.product.name}</p>}
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="text-sm font-semibold text-gray-800">{Number(item.quantity)} {item.unit}</span>
                  </div>
                  {item.product ? (
                    <>
                      <div className="col-span-2">
                        <input
                          type="number" min="0" step="0.01"
                          value={itemPrices[item.product.id]?.unitPrice || ''}
                          onChange={(e) => setItemPrices((p) => ({ ...p, [item.product.id]: { ...p[item.product.id], unitPrice: e.target.value } }))}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="$0.00"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number" min="0" step="1"
                          value={itemPrices[item.product.id]?.deliveryDays || ''}
                          onChange={(e) => setItemPrices((p) => ({ ...p, [item.product.id]: { ...p[item.product.id], deliveryDays: e.target.value } }))}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="días"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          value={itemPrices[item.product.id]?.notes || ''}
                          onChange={(e) => setItemPrices((p) => ({ ...p, [item.product.id]: { ...p[item.product.id], notes: e.target.value } }))}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="opcional"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="col-span-6 text-xs text-gray-400">Ítem sin producto vinculado</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg transition-colors">
              {saving ? 'Enviando...' : '✓ Enviar Cotización'}
            </button>
            <Link to="/portal/rfqs"
              className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium transition-colors">
              Cancelar
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
