import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { logisticsApi, SHIPMENT_STATUS_META, CARRIERS } from '../../api/logistics';
import TrackingTimeline from './TrackingTimeline';
import { useToast } from '../ui/Toast';

/**
 * Card "Envío" para el detalle de un pedido de venta u orden de compra.
 * Sin envío → CTA "Crear guía". Con envío → mini-timeline + link al tracking.
 */
export default function ShipmentCard({ orderType, orderId, enabled = true }: {
  orderType: 'SALES' | 'PURCHASE';
  orderId: string;
  /** mostrar CTA de creación (p. ej. solo cuando el pedido está despachado/aprobado) */
  enabled?: boolean;
}) {
  const toast = useToast();
  const [shipment, setShipment] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [carrier, setCarrier] = useState('PROPIO');
  const [carrierGuide, setCarrierGuide] = useState('');
  const [freightCost, setFreightCost] = useState('');

  const load = () => {
    logisticsApi.byOrder(orderType, orderId)
      .then((r) => setShipment(r.data))
      .catch(() => {})
      .finally(() => setLoaded(true));
  };
  useEffect(() => { load(); }, [orderType, orderId]);

  async function createGuide() {
    setCreating(true);
    try {
      await logisticsApi.create({ orderType, orderId, carrier, carrierGuide: carrierGuide || undefined, freightCost: freightCost ? Number(freightCost) : undefined });
      toast.success('Guía de envío creada');
      setShowForm(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo crear la guía');
    } finally { setCreating(false); }
  }

  if (!loaded) return null;

  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 shadow-soft">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-surface-800 dark:text-white">🚚 Envío</h3>
        {shipment && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SHIPMENT_STATUS_META[shipment.status]?.tone}`}>
            {SHIPMENT_STATUS_META[shipment.status]?.icon} {SHIPMENT_STATUS_META[shipment.status]?.label}
          </span>
        )}
      </div>

      {shipment ? (
        <>
          <p className="text-sm mb-3">
            Guía <Link to={`/logistica/${shipment.id}`} className="font-mono text-brand-600 dark:text-brand-400 hover:underline">{shipment.trackingNumber}</Link>
            {shipment.carrier && <span className="text-surface-400"> · {shipment.carrier}</span>}
          </p>
          <TrackingTimeline events={shipment.events} compact />
          <Link to={`/logistica/${shipment.id}`} className="inline-block mt-3 text-sm text-brand-500 hover:underline">Ver tracking completo →</Link>
        </>
      ) : !enabled ? (
        <p className="text-sm text-surface-400">El envío se podrá crear cuando la orden esté lista para despacho.</p>
      ) : showForm ? (
        <div className="space-y-2">
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)}
            className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white">
            {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={carrierGuide} onChange={(e) => setCarrierGuide(e.target.value)}
            placeholder="Nº de guía del courier (opcional)"
            className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white placeholder:text-surface-400" />
          <input type="number" min={0} step="0.01" value={freightCost} onChange={(e) => setFreightCost(e.target.value)}
            placeholder="Costo del flete $ (opcional — margen real de la entrega)"
            className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white placeholder:text-surface-400" />
          <div className="flex gap-2">
            <button onClick={createGuide} disabled={creating}
              className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {creating ? 'Creando…' : 'Crear guía'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-3 text-sm text-surface-400 hover:text-surface-600">Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="text-center py-3">
          <p className="text-sm text-surface-400 mb-3">Sin guía de envío para esta orden.</p>
          <button onClick={() => setShowForm(true)}
            className="text-sm px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors">
            + Crear guía de envío
          </button>
        </div>
      )}
    </div>
  );
}
