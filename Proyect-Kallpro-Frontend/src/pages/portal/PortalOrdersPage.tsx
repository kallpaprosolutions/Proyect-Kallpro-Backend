import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { portalApi } from '../../api/portal';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  DRAFT:    { label: 'Borrador',   color: 'bg-gray-100 text-gray-600' },
  APPROVED: { label: 'Aprobada',   color: 'bg-blue-100 text-blue-700' },
  SENT:     { label: 'Enviada',    color: 'bg-purple-100 text-purple-700' },
  RECEIVED: { label: 'Recibida',   color: 'bg-green-100 text-green-700' },
  PARTIAL:  { label: 'Parcial',    color: 'bg-yellow-100 text-yellow-700' },
  CANCELLED:{ label: 'Cancelada',  color: 'bg-red-100 text-red-700' },
};

export default function PortalOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalApi.getMyOrders().then((r) => setOrders(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Cargando...</div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link to="/portal/dashboard" className="text-gray-400 hover:text-gray-600">← Dashboard</Link>
          <h1 className="text-lg font-semibold text-gray-900">Mis Órdenes de Compra</h1>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{orders.length}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-4">
        {orders.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
            No tienes órdenes de compra registradas.
          </div>
        ) : orders.map((o) => {
          const st = STATUS_LABEL[o.status] || { label: o.status, color: 'bg-gray-100 text-gray-600' };
          return (
            <div key={o.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{o.poNumber}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(o.createdAt).toLocaleDateString('es')}
                    {o.deliveryDate && ` · Entrega: ${new Date(o.deliveryDate).toLocaleDateString('es')}`}
                  </p>
                </div>
                <p className="text-xl font-bold text-gray-900">${Number(o.totalAmount).toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                {o.items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm text-gray-600 bg-gray-50 rounded px-3 py-1.5">
                    <span>{item.product?.name || 'Producto'}</span>
                    <span>{Number(item.quantity)} × ${Number(item.unitPrice).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
