import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { portalApi } from '../../api/portal';

export default function PortalRFQsPage() {
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalApi.getRFQs().then((r) => setRfqs(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Cargando...</div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link to="/portal/dashboard" className="text-gray-400 hover:text-gray-600">← Dashboard</Link>
          <h1 className="text-lg font-semibold text-gray-900">Solicitudes de Cotización</h1>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{rfqs.length} solicitudes</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-4">
        {rfqs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
            No hay solicitudes de cotización disponibles.
          </div>
        ) : rfqs.map((rfq) => {
          const responded = rfq.portalResponses?.length > 0;
          const response = rfq.portalResponses?.[0];
          return (
            <div key={rfq.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{rfq.reqNumber}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      responded ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {responded ? `✓ Cotizado (${response?.status})` : 'Pendiente'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      rfq.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                      rfq.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{rfq.priority}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{rfq.title}</p>
                </div>
                <Link to={`/portal/rfqs/${rfq.id}/quote`}
                  className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                    responded
                      ? 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}>
                  {responded ? 'Ver / Editar' : 'Cotizar'}
                </Link>
              </div>
              <div className="text-xs text-gray-500">
                {rfq.items?.length} ítem(s) · Creado: {new Date(rfq.createdAt).toLocaleDateString('es')}
              </div>
              {rfq.items?.slice(0, 3).map((item: any) => (
                <div key={item.id} className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5">
                  {item.description} — {Number(item.quantity)} {item.unit}
                </div>
              ))}
              {rfq.items?.length > 3 && (
                <p className="text-xs text-gray-400 mt-1">+{rfq.items.length - 3} más...</p>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
