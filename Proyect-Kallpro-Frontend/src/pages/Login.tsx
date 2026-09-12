import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/auth.store';
import { Eye, EyeOff, ShieldCheck, BarChart3, Package, Receipt, Lock } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  function completeLogin(data: any) {
    setAuth(data.user, data.accessToken, data.refreshToken);
    navigate(data.twoFactorSetupRequired ? '/settings/security?required2fa=1' : '/dashboard');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.login(form);
      if (data.require2FA) {
        setChallengeToken(data.challengeToken);
      } else {
        completeLogin(data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.verify2FA(challengeToken!, code.trim());
      completeLogin(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Código incorrecto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Panel izquierdo: branding ────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 overflow-hidden">
        {/* Círculos decorativos */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-brand-400/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-brand-500/5 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] border border-brand-500/8 rounded-full" />

        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/25">
              <span className="text-white font-bold text-xl">K</span>
            </div>
            <span className="text-white font-bold text-2xl tracking-tight">KallpaPro</span>
          </div>

          {/* Headline */}
          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
            Gestiona tu empresa<br />
            <span className="text-brand-400">de forma inteligente</span>
          </h2>
          <p className="text-gray-400 text-lg mb-12 max-w-md">
            ERP multi-empresa para PYMEs de Ecuador. Contabilidad NIIF, inventario, compras, ventas, nómina y más — todo integrado.
          </p>

          {/* Feature pills */}
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <FeaturePill icon={<BarChart3 className="w-4 h-4" />} text="Contabilidad NIIF" />
            <FeaturePill icon={<Package className="w-4 h-4" />} text="Inventario multibodega" />
            <FeaturePill icon={<Receipt className="w-4 h-4" />} text="Facturación SRI" />
            <FeaturePill icon={<ShieldCheck className="w-4 h-4" />} text="Calidad ISO/ARCSA" />
          </div>
        </div>
      </div>

      {/* ── Panel derecho: formulario ────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-gray-950 px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Logo móvil (solo visible en < lg) */}
          <div className="flex items-center justify-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/25">
              <span className="text-white font-bold text-lg">K</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">KallpaPro</span>
          </div>

          <div className="text-center mb-8 lg:text-left">
            <h1 className="text-2xl font-bold text-white">
              {challengeToken ? 'Verificación 2FA' : '¡Bienvenido!'}
            </h1>
            <p className="text-gray-400 mt-1.5 text-sm">
              {challengeToken
                ? 'Ingresa el código de tu app de autenticación'
                : 'Inicia sesión para acceder a tu cuenta'}
            </p>
          </div>

          {!challengeToken ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
                  placeholder="tu@empresa.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-4 py-3 pr-11 text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Iniciando...
                  </span>
                ) : 'Iniciar Sesión'}
              </button>

              <p className="text-center text-gray-500 text-sm">
                ¿No tienes cuenta?{' '}
                <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                  Regístrate
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="flex justify-center mb-2">
                <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                  <Lock className="w-7 h-7 text-brand-400" />
                </div>
              </div>

              <p className="text-gray-400 text-sm text-center">
                Ingresa el código de 6 dígitos de tu app de autenticación.
              </p>

              <input
                type="text"
                inputMode="numeric"
                autoFocus
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-gray-900 border border-gray-800 text-white text-center text-2xl tracking-[0.5em] rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
                placeholder="000000"
              />

              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-brand-500/20"
              >
                {loading ? 'Verificando...' : 'Verificar'}
              </button>

              <button
                type="button"
                onClick={() => { setChallengeToken(null); setCode(''); setError(''); }}
                className="w-full text-gray-400 hover:text-gray-200 text-sm transition-colors"
              >
                ← Volver al inicio de sesión
              </button>
            </form>
          )}

          <p className="text-center text-gray-700 text-xs mt-8">
            © {new Date().getFullYear()} KallpaPro ERP · Ecuador
          </p>
        </div>
      </div>
    </div>
  );
}

function FeaturePill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5">
      <div className="text-brand-400">{icon}</div>
      <span className="text-gray-300 text-sm font-medium">{text}</span>
    </div>
  );
}
