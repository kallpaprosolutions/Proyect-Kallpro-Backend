import { useState, useEffect, useCallback } from 'react';
import { inventoryApi } from '../api/inventory';
import { ollamaApi } from '../api/ollama';
import { useNavigate } from 'react-router-dom';

interface ReorderSuggestion {
  productId: string;
  productName: string;
  sku?: string;
  unit: string;
  availableQty: number;
  daysOfStock: number;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  suggestedQty: number;
  estOrderValue: number;
}

interface ExpiringBatch {
  id: string;
  lotNumber?: string;
  expiryDate: string;
  remainingQty: number;
  product: { name: string };
  warehouse: { name: string };
}

interface AlertData {
  reorderSuggestions: ReorderSuggestion[];
  expiringBatches: ExpiringBatch[];
  aiRecommendation?: string;
  lastUpdated: Date;
}

const URGENCY_CONFIG = {
  CRITICAL: { label: 'CRÍTICO', color: 'text-red-400', bg: 'bg-red-900/30 border-red-800', dot: 'bg-red-500' },
  HIGH:     { label: 'ALTO',    color: 'text-orange-400', bg: 'bg-orange-900/30 border-orange-800', dot: 'bg-orange-500' },
  MEDIUM:   { label: 'MEDIO',  color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-800', dot: 'bg-yellow-500' },
};

export default function SmartAlertsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiTab, setAiTab] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reorderRes] = await Promise.all([
        inventoryApi.getReorderSuggestions(),
        inventoryApi.getPhysicalCounts(),
      ]);

      // Also load expiring batches via rotation API
      let expiringBatches: ExpiringBatch[] = [];
      try {
        const { default: client } = await import('../api/client');
        const expRes = await client.get('/rotation/expiring', { params: { days: 30 } });
        expiringBatches = expRes.data;
      } catch { /* optional */ }

      setData({
        reorderSuggestions: reorderRes.data || [],
        expiringBatches,
        lastUpdated: new Date(),
      });
    } catch { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // poll every 60s
    return () => clearInterval(interval);
  }, [load]);

  async function loadAiRecommendation() {
    if (data?.aiRecommendation) { setAiTab(true); return; }
    setAiTab(true);
    try {
      const res = await ollamaApi.getReorderRecommendations();
      setData(prev => prev ? { ...prev, aiRecommendation: res.data.recommendation } : null);
    } catch { /* noop */ }
  }

  const totalAlerts = (data?.reorderSuggestions.length || 0) + (data?.expiringBatches.length || 0);
  const criticalCount = data?.reorderSuggestions.filter(s => s.urgency === 'CRITICAL').length || 0;

  function daysUntilExpiry(dateStr: string) {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="fixed bottom-24 right-5 z-40">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-3 py-2 rounded-full shadow-lg transition-all text-sm font-medium"
      >
        <span>🔔</span>
        <span className="hidden sm:block">Alertas</span>
        {totalAlerts > 0 && (
          <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
            criticalCount > 0 ? 'bg-red-600' : 'bg-yellow-600'
          }`}>
            {totalAlerts > 9 ? '9+' : totalAlerts}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute bottom-12 right-0 w-80 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-sm">Alertas del Sistema</span>
              {loading && <span className="text-xs text-gray-500 animate-pulse">actualizando...</span>}
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white text-sm">✕</button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setAiTab(false)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${!aiTab ? 'text-white border-b-2 border-cyan-500' : 'text-gray-500 hover:text-gray-300'}`}
            >
              📋 Stock ({(data?.reorderSuggestions.length || 0) + (data?.expiringBatches.length || 0)})
            </button>
            <button
              onClick={loadAiRecommendation}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${aiTab ? 'text-white border-b-2 border-purple-500' : 'text-gray-500 hover:text-gray-300'}`}
            >
              🤖 IA
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto p-3 space-y-2">
            {!aiTab ? (
              <>
                {/* Reorder suggestions */}
                {data?.reorderSuggestions.map(s => {
                  const cfg = URGENCY_CONFIG[s.urgency];
                  return (
                    <div key={s.productId} className={`rounded-lg border px-3 py-2 ${cfg.bg}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-medium truncate">{s.productName}</p>
                          <p className="text-gray-400 text-xs">
                            Stock: {s.availableQty} {s.unit} · {s.daysOfStock < 9999 ? `${s.daysOfStock}d` : '∞'}
                          </p>
                        </div>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-gray-500 text-xs">Sugerido: {s.suggestedQty} {s.unit}</span>
                        <button
                          onClick={() => { navigate('/purchases'); setIsOpen(false); }}
                          className="text-xs text-cyan-400 hover:text-cyan-300"
                        >
                          + OC
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Expiring batches */}
                {data?.expiringBatches.map(b => {
                  const days = daysUntilExpiry(b.expiryDate);
                  const isExpired = days <= 0;
                  return (
                    <div key={b.id} className={`rounded-lg border px-3 py-2 ${isExpired ? 'bg-red-900/30 border-red-800' : 'bg-yellow-900/20 border-yellow-800'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-medium truncate">⏰ {b.product.name}</p>
                          <p className="text-gray-400 text-xs">{b.warehouse.name} · Qty: {b.remainingQty}</p>
                        </div>
                        <span className={`text-xs font-bold ${isExpired ? 'text-red-400' : 'text-yellow-400'}`}>
                          {isExpired ? 'VENCIDO' : `${days}d`}
                        </span>
                      </div>
                      {b.lotNumber && <p className="text-gray-500 text-xs mt-0.5">Lote: {b.lotNumber}</p>}
                    </div>
                  );
                })}

                {totalAlerts === 0 && (
                  <div className="text-center py-8">
                    <p className="text-2xl mb-2">✅</p>
                    <p className="text-gray-400 text-xs">Sin alertas activas</p>
                  </div>
                )}
              </>
            ) : (
              <div>
                {data?.aiRecommendation ? (
                  <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {data.aiRecommendation}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 gap-2 text-gray-500 text-xs">
                    <span className="animate-spin">⚙️</span> Consultando Ollama...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-800 flex justify-between items-center">
            <span className="text-gray-600 text-xs">
              {data?.lastUpdated ? `Act: ${data.lastUpdated.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
            <button
              onClick={() => { navigate('/inventory?tab=avanzado'); setIsOpen(false); }}
              className="text-xs text-cyan-500 hover:text-cyan-400"
            >
              Ver análisis →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
