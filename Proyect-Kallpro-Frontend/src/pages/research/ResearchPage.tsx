import { useState, useEffect, useRef } from 'react';
import { researchApi, GoogleResult, YoutubeResult } from '../../api/research';

const ERP_CONTEXTS = [
  'General ERP',
  'Inventario y Almacén',
  'Compras y Procurement',
  'Ventas y CRM',
  'Finanzas y Contabilidad',
  'Producción y MRP',
  'Recursos Humanos',
  'Reportes y Analítica',
];

const QUICK_SEARCHES = [
  'mejores prácticas control de inventario FIFO',
  'optimización de compras y gestión de proveedores ERP',
  'KPIs financieros empresas medianas Ecuador',
  'producción MRP planificación de requerimientos materiales',
  'gestión de ventas CRM sistema ERP pymes',
  'contabilidad automatizada facturas electrónicas SRI Ecuador',
];

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4 animate-pulse">
      <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded w-3/4 mb-2" />
      <div className="h-3 bg-surface-100 dark:bg-surface-800 rounded w-full mb-1" />
      <div className="h-3 bg-surface-100 dark:bg-surface-800 rounded w-5/6" />
    </div>
  );
}

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-surface-900 dark:text-white">$1</strong>')
    .replace(/^### (.*$)/gm, '<h3 class="text-brand-600 dark:text-brand-400 font-semibold text-sm mt-4 mb-1">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-brand-700 dark:text-brand-300 font-bold mt-4 mb-2">$1</h2>')
    .replace(/^- (.*$)/gm, '<li class="ml-4 text-surface-700 dark:text-surface-300">• $1</li>')
    .replace(/^\d+\. (.*$)/gm, '<li class="ml-4 text-surface-700 dark:text-surface-300 list-decimal">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

export default function ResearchPage() {
  const [query, setQuery] = useState('');
  const [erpContext, setErpContext] = useState('General ERP');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<{ google: boolean; youtube: boolean; ollama: boolean } | null>(null);

  const [googleResults, setGoogleResults] = useState<GoogleResult[]>([]);
  const [youtubeResults, setYoutubeResults] = useState<YoutubeResult[]>([]);
  const [synthesis, setSynthesis] = useState('');
  const [searchTimestamp, setSearchTimestamp] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [error, setError] = useState('');

  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    researchApi.getStatus().then((r) => setStatus(r.data)).catch(() => {});
  }, []);

  const handleSearch = async (q?: string) => {
    const searchQuery = (q || query).trim();
    if (!searchQuery) return;
    setLoading(true);
    setError('');
    setGoogleResults([]);
    setYoutubeResults([]);
    setSynthesis('');

    try {
      const r = await researchApi.synthesize(searchQuery, erpContext);
      const data = r.data;
      setGoogleResults(data.googleResults);
      setYoutubeResults(data.youtubeResults);
      setSynthesis(data.synthesis);
      setSearchTimestamp(data.timestamp);
      setLastQuery(searchQuery);
      setStatus((prev) => prev ? { ...prev, ...data.configStatus } : null);
      // Scroll to results
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al realizar la búsqueda');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(synthesis).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const notConfigured = status && !status.google && !status.youtube;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🔬</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Investigación de Mercado</h1>
            <p className="text-sm text-surface-500">Busca en Internet y YouTube · Síntesis con IA</p>
          </div>
        </div>
        {/* Status badges */}
        <div className="flex items-center gap-2">
          {status && (
            <>
              <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${status.google ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-surface-100 dark:bg-surface-700 text-surface-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.google ? 'bg-green-500 dark:bg-green-400' : 'bg-surface-400 dark:bg-surface-600'}`} />
                Google
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${status.youtube ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' : 'bg-surface-100 dark:bg-surface-700 text-surface-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.youtube ? 'bg-red-500 dark:bg-red-400' : 'bg-surface-400 dark:bg-surface-600'}`} />
                YouTube
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${status.ollama ? 'bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-400' : 'bg-surface-100 dark:bg-surface-700 text-surface-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.ollama ? 'bg-brand-500 dark:bg-brand-400' : 'bg-surface-400 dark:bg-surface-600'}`} />
                IA Ollama
              </span>
            </>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* API Not Configured Warning */}
        {notConfigured && (
          <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-600/30 rounded-xl p-5 text-yellow-700 dark:text-yellow-300">
            <p className="font-semibold mb-2">⚠️ APIs de Google no configuradas</p>
            <p className="text-sm text-yellow-600 dark:text-yellow-400/80 mb-3">Para activar las búsquedas, agrega estas variables al archivo <code className="bg-surface-100 dark:bg-surface-800 px-1 rounded">.env</code> del backend:</p>
            <div className="bg-surface-50 dark:bg-surface-900 rounded-lg p-3 text-xs font-mono text-surface-700 dark:text-surface-300 space-y-1">
              <div>GOOGLE_SEARCH_API_KEY=<span className="text-yellow-600 dark:text-yellow-400">tu_api_key</span></div>
              <div>GOOGLE_SEARCH_CX=<span className="text-yellow-600 dark:text-yellow-400">tu_search_engine_id</span></div>
              <div>YOUTUBE_API_KEY=<span className="text-yellow-600 dark:text-yellow-400">tu_youtube_api_key</span></div>
            </div>
            <p className="text-xs text-yellow-600 dark:text-yellow-500/70 mt-3">
              Obtén las keys en{' '}
              <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="underline">console.cloud.google.com</a>
              {' '}(Custom Search API + YouTube Data API v3 · cuota gratuita disponible)
            </p>
          </div>
        )}

        {/* Search Bar */}
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-soft rounded-2xl p-6 space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="¿Qué quieres investigar para mejorar el ERP? Ej: mejores prácticas control inventario"
              className="flex-1 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-surface-400 text-sm"
            />
            <select
              value={erpContext}
              onChange={(e) => setErpContext(e.target.value)}
              className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            >
              {ERP_CONTEXTS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              onClick={() => handleSearch()}
              disabled={loading || !query.trim()}
              className="bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-medium transition-colors whitespace-nowrap flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Investigando...
                </>
              ) : (
                '🔍 Investigar'
              )}
            </button>
          </div>

          {/* Quick search suggestions */}
          <div>
            <p className="text-xs text-surface-500 mb-2">Búsquedas rápidas:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_SEARCHES.map((s) => (
                <button
                  key={s}
                  onClick={() => { setQuery(s); handleSearch(s); }}
                  disabled={loading}
                  className="text-xs bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 disabled:opacity-50 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white px-3 py-1.5 rounded-lg transition-colors border border-surface-200 dark:border-surface-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {(loading || googleResults.length > 0 || youtubeResults.length > 0 || synthesis) && (
          <div ref={resultsRef} className="space-y-6">
            {/* Last query label */}
            {lastQuery && !loading && (
              <p className="text-surface-500 text-sm">
                Resultados para: <span className="text-brand-600 dark:text-brand-400 font-medium">"{lastQuery}"</span>
                {searchTimestamp && (
                  <span className="ml-3 text-surface-400 text-xs">
                    {new Date(searchTimestamp).toLocaleString('es')}
                  </span>
                )}
              </p>
            )}

            {/* Web + YouTube grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Google Results */}
              <div>
                <h2 className="text-sm font-semibold text-surface-500 mb-3 flex items-center gap-2">
                  🌐 Resultados Web
                  {!loading && googleResults.length === 0 && status && !status.google && (
                    <span className="text-xs text-yellow-600 dark:text-yellow-500 font-normal">(API no configurada)</span>
                  )}
                </h2>
                <div className="space-y-3">
                  {loading
                    ? Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)
                    : googleResults.length > 0
                      ? googleResults.map((r, i) => (
                          <a
                            key={i}
                            href={r.link}
                            target="_blank"
                            rel="noreferrer"
                            className="block bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 hover:border-brand-300 dark:hover:border-brand-700 rounded-xl p-4 transition-all group shadow-soft"
                          >
                            <p className="text-brand-600 dark:text-brand-400 group-hover:text-brand-700 dark:group-hover:text-brand-300 font-medium text-sm leading-snug mb-1 line-clamp-2">{r.title}</p>
                            <p className="text-surface-500 text-xs mb-2 line-clamp-3">{r.snippet}</p>
                            <p className="text-surface-400 text-xs">{r.displayLink}</p>
                          </a>
                        ))
                      : !loading && (
                          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-6 text-center text-surface-400 text-sm">
                            {status?.google ? 'No se encontraron resultados web' : 'Configura Google Search API para ver resultados'}
                          </div>
                        )
                  }
                </div>
              </div>

              {/* YouTube Results */}
              <div>
                <h2 className="text-sm font-semibold text-surface-500 mb-3 flex items-center gap-2">
                  📺 Videos de YouTube
                  {!loading && youtubeResults.length === 0 && status && !status.youtube && (
                    <span className="text-xs text-yellow-600 dark:text-yellow-500 font-normal">(API no configurada)</span>
                  )}
                </h2>
                <div className="space-y-3">
                  {loading
                    ? Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)
                    : youtubeResults.length > 0
                      ? youtubeResults.map((r) => (
                          <a
                            key={r.videoId}
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex gap-3 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 hover:border-red-300 dark:hover:border-red-700/50 rounded-xl p-3 transition-all group shadow-soft"
                          >
                            {r.thumbnailUrl && (
                              <img
                                src={r.thumbnailUrl}
                                alt={r.title}
                                className="w-28 h-16 object-cover rounded-lg flex-shrink-0 bg-surface-200 dark:bg-surface-700"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300 font-medium text-sm leading-snug mb-1 line-clamp-2">{r.title}</p>
                              <p className="text-surface-500 text-xs mb-1">{r.channelTitle}</p>
                              <p className="text-surface-400 text-xs line-clamp-2">{r.description.slice(0, 120)}</p>
                            </div>
                          </a>
                        ))
                      : !loading && (
                          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-6 text-center text-surface-400 text-sm">
                            {status?.youtube ? 'No se encontraron videos' : 'Configura YouTube API para ver videos'}
                          </div>
                        )
                  }
                </div>
              </div>
            </div>

            {/* AI Synthesis */}
            {(loading || synthesis) && (
              <div className="bg-white dark:bg-surface-800 border border-brand-200 dark:border-brand-900/40 rounded-2xl overflow-hidden shadow-soft">
                <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200 dark:border-surface-700">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🤖</span>
                    <h2 className="font-semibold text-surface-900 dark:text-white">Análisis IA</h2>
                    <span className="text-xs bg-brand-100 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 px-2 py-0.5 rounded-full">Ollama · qwen2.5:7b</span>
                    <span className="text-xs bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">{erpContext}</span>
                  </div>
                  {synthesis && !loading && (
                    <button
                      onClick={handleCopy}
                      className="text-xs text-surface-500 hover:text-surface-900 dark:hover:text-white bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {copied ? '✓ Copiado' : '📋 Copiar'}
                    </button>
                  )}
                </div>
                <div className="p-5">
                  {loading ? (
                    <div className="space-y-2 animate-pulse">
                      {Array(6).fill(0).map((_, i) => (
                        <div key={i} className={`h-3 bg-surface-100 dark:bg-surface-700 rounded ${i % 3 === 2 ? 'w-2/3' : 'w-full'}`} />
                      ))}
                    </div>
                  ) : (
                    <div
                      className="text-surface-700 dark:text-surface-300 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(synthesis) }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!loading && googleResults.length === 0 && youtubeResults.length === 0 && !synthesis && !error && (
          <div className="text-center py-20">
            <p className="text-6xl mb-4">🔬</p>
            <h3 className="text-xl font-semibold text-surface-700 dark:text-surface-300 mb-2">Centro de Investigación ERP</h3>
            <p className="text-surface-500 max-w-md mx-auto text-sm">
              Busca buenas prácticas, tendencias y tutoriales de YouTube. La IA de Ollama sintetizará los hallazgos en recomendaciones accionables para tu ERP.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
