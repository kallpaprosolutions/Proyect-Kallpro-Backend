import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { portalApi } from '../../api/portal';
import { usePortalStore } from '../../store/portal.store';

export default function PortalDashboard() {
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const { supplier, logout } = usePortalStore();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      portalApi.getRFQs(),
      portalApi.getMyQuotations(),
      portalApi.getMyOrders(),
    ]).then(([r, q, o]) => {
      setRfqs(r.data);
      setQuotes(q.data);
      setOrders(o.data);
    }).catch(() => {
      logout();
      navigate('/portal/login');
    });
  }, []);

  const pendingRFQs = rfqs.filter((r) => !r.portalResponses?.length);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">K</div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">KallpaPro — Portal Proveedores</p>
              <p className="text-xs text-gray-500">{supplier?.name}</p>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/portal/login'); }}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors">
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'RFQs Pendientes', value: pendingRFQs.length, color: 'text-orange-600', bg: 'bg-orange-50', link: '/portal/rfqs' },
            { label: 'Cotizaciones Enviadas', value: quotes.length, color: 'text-blue-600', bg: 'bg-blue-50', link: '/portal/quotes' },
            { label: 'Órdenes de Compra', value: orders.length, color: 'text-green-600', bg: 'bg-green-50', link: '/portal/orders' },
          ].map((kpi) => (
            <Link key={kpi.label} to={kpi.link}
              className={`${kpi.bg} rounded-xl p-5 border border-gray-100 hover:shadow-sm transition-shadow`}>
              <p className="text-sm text-gray-600">{kpi.label}</p>
              <p className={`text-3xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
            </Link>
          ))}
        </div>

        {/* RFQs pendientes */}
        {pendingRFQs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">📋 Solicitudes de Cotización Pendientes</h2>
              <Link to="/portal/rfqs" className="text-sm text-blue-600 hover:text-blue-700">Ver todas →</Link>
            </div>
            <div className="divide-y divide-gray-100">
              {pendingRFQs.slice(0, 3).map((rfq) => (
                <div key={rfq.id} className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{rfq.reqNumber} — {rfq.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {rfq.items?.length} ítem(s) · {new Date(rfq.createdAt).toLocaleDateString('es')}
                    </p>
                  </div>
                  <Link to={`/portal/rfqs/${rfq.id}/quote`}
                    className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg transition-colors">
                    Cotizar
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Órdenes recientes */}
        {orders.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">🛒 Últimas Órdenes de Compra</h2>
              <Link to="/portal/orders" className="text-sm text-blue-600 hover:text-blue-700">Ver todas →</Link>
            </div>
            <div className="divide-y divide-gray-100">
              {orders.slice(0, 3).map((o) => (
                <div key={o.id} className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{o.poNumber}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{new Date(o.createdAt).toLocaleDateString('es')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-800">${Number(o.totalAmount).toFixed(2)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      o.status === 'RECEIVED' ? 'bg-green-100 text-green-700' :
                      o.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{o.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
