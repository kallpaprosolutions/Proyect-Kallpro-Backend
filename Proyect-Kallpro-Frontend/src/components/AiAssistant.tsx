/**
 * AiAssistant — Panel flotante de IA con Ollama/Qwen
 * Se puede abrir desde cualquier página del ERP.
 * Mantiene historial de conversación en memoria local (por sesión).
 */

import { useEffect, useRef, useState } from 'react';
import { ollamaApi } from '../api/ollama';
import { useLocation } from 'react-router-dom';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts: number;
}

// Map route → context hint for the AI
const CONTEXT_MAP: Record<string, string> = {
  '/inventory':    'Módulo de Inventario — productos, stock, movimientos, kardex, valoración',
  '/purchases':    'Módulo de Compras — órdenes de compra, proveedores, recepción',
  '/financial':    'Módulo Financiero — facturas, cuentas por cobrar/pagar, KPIs',
  '/contabilidad': 'Módulo Contabilidad — cuentas por pagar, documentos SRI Ecuador',
  '/budget':       'Módulo Presupuesto — departamentos, presupuesto mensual',
  '/gerencial':    'Dashboard Gerencial — KPIs globales, gráficos ejecutivos',
};

export default function AiAssistant() {
  const [open, setOpen]         = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '¡Hola! Soy **KallpaPro AI** 🤖, tu asistente de ERP. Puedo ayudarte con inventarios, compras, finanzas, análisis de datos y más. ¿En qué te ayudo?',
      ts: Date.now(),
    },
  ]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null);
  const [model, setModel]       = useState('');
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLTextAreaElement>(null);
  const location                = useLocation();

  // Check Ollama status on mount
  useEffect(() => {
    ollamaApi.getStatus()
      .then((r) => { setOllamaOk(r.data.ok); setModel(r.data.model); })
      .catch(() => setOllamaOk(false));
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open && !minimized) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, minimized]);

  const contextHint = Object.entries(CONTEXT_MAP).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1];

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: text, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await ollamaApi.ask(text, contextHint);
      const answer = res.data.answer as string;
      setMessages((prev) => [...prev, { role: 'assistant', content: answer, ts: Date.now() }]);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Error conectando con Ollama. Verifica que esté corriendo.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${msg}`, ts: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearHistory = () => setMessages([
    { role: 'assistant', content: '¡Historial limpiado! ¿En qué te ayudo?', ts: Date.now() },
  ]);

  // ── Quick prompts ─────────────────────────────────────────────
  const quickPrompts = [
    '¿Qué productos debo reponer?',
    '¿Cómo interpreto la clasificación ABC?',
    '¿Qué es el DIO y cómo mejorarlo?',
    '¿Cuál método de valoración me conviene?',
  ];

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="KallpaPro AI"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-cyan-500 text-white text-2xl shadow-2xl hover:scale-110 transition-transform flex items-center justify-center"
        >
          🤖
          {ollamaOk === false && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-gray-950" title="Ollama offline" />
          )}
          {ollamaOk === true && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-gray-950" title="Ollama online" />
          )}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className={`fixed bottom-6 right-6 z-50 w-96 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col transition-all duration-200 ${
            minimized ? 'h-14' : 'h-[560px]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 flex-shrink-0">
            <span className="text-lg">🤖</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">KallpaPro AI</p>
              <p className="text-xs truncate" style={{ color: ollamaOk ? '#4ade80' : '#f87171' }}>
                {ollamaOk === null ? 'Conectando…' : ollamaOk ? `● ${model}` : '● Ollama offline'}
              </p>
            </div>
            {contextHint && !minimized && (
              <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full truncate max-w-28" title={contextHint}>
                {contextHint.split(' — ')[0]}
              </span>
            )}
            <button onClick={() => setMinimized(!minimized)} className="text-gray-500 hover:text-white text-sm ml-1" title={minimized ? 'Expandir' : 'Minimizar'}>
              {minimized ? '⬆' : '⬇'}
            </button>
            <button onClick={clearHistory} className="text-gray-500 hover:text-white text-sm" title="Limpiar historial">🗑</button>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white ml-1">✕</button>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 leading-relaxed whitespace-pre-wrap text-xs ${
                        m.role === 'user'
                          ? 'bg-cyan-600/30 text-cyan-100 border border-cyan-700/40'
                          : 'bg-gray-800 text-gray-200 border border-gray-700'
                      }`}
                      dangerouslySetInnerHTML={{
                        __html: m.content
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br/>'),
                      }}
                    />
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-400 flex items-center gap-1">
                      <span className="animate-pulse">●</span>
                      <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>●</span>
                      <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>●</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Quick prompts (only when few messages) */}
              {messages.length <= 2 && !loading && (
                <div className="px-4 pb-2 flex flex-wrap gap-1">
                  {quickPrompts.map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); setTimeout(sendMessage, 50); }}
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-full px-2 py-1 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="px-3 pb-3 flex-shrink-0">
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    disabled={loading || ollamaOk === false}
                    placeholder={ollamaOk === false ? 'Ollama offline — inicia con: ollama serve' : 'Escribe tu pregunta... (Enter para enviar)'}
                    rows={2}
                    className="flex-1 resize-none bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={loading || !input.trim() || ollamaOk === false}
                    className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-2 rounded-xl transition-colors text-sm font-bold h-full"
                  >
                    ➤
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1 text-right">Shift+Enter para nueva línea</p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
