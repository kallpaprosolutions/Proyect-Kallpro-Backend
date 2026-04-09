import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <header className="border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-4xl font-bold text-cyan-400">🚀 KallpaPro</h1>
          <p className="text-slate-400 mt-2">Plataforma B2B SaaS para gestión de PYMEs</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Status Card */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-8">
            <h2 className="text-2xl font-bold mb-4">📊 Estado del Proyecto</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Backend</span>
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                  ✓ Inicializado
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Frontend</span>
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                  ✓ Inicializado
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Base de Datos</span>
                <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
                  ⏳ Próximo paso
                </span>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-8">
            <h2 className="text-2xl font-bold mb-4">📋 Próximos Pasos</h2>
            <ol className="space-y-3 text-slate-300">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500 text-white text-center text-sm font-bold">1</span>
                <span>Configurar PostgreSQL con Docker</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500 text-white text-center text-sm font-bold">2</span>
                <span>Crear Autenticación (JWT)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500 text-white text-center text-sm font-bold">3</span>
                <span>Implementar Módulo Inventario</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500 text-white text-center text-sm font-bold">4</span>
                <span>Integración con Compras</span>
              </li>
            </ol>
          </div>
        </div>

        {/* Test Counter */}
        <div className="mt-12 bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">🧪 Test de Funcionalidad</h2>
          <p className="text-slate-400 mb-4">Counter: {count}</p>
          <button
            onClick={() => setCount(count + 1)}
            className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-2 rounded-lg font-bold transition"
          >
            Incrementar
          </button>
        </div>

        {/* Info */}
        <div className="mt-12 bg-blue-900/20 border border-blue-700/50 rounded-lg p-6">
          <p className="text-blue-300">
            ✨ <strong>Frontend listo:</strong> React + Vite + TypeScript está configurado y funcionando.
            Los módulos (inventario, compras, logística, financiero, ventas) se implementarán en fases.
          </p>
        </div>
      </main>

      <footer className="border-t border-slate-700 mt-12 py-6 text-center text-slate-400">
        <p>KallpaPro © 2024 | Roadmap: 3 meses para v1.0</p>
      </footer>
    </div>
  )
}

export default App
