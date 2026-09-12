import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { authApi, Session } from '../../api/auth';
import { useConfirm } from '../../hooks/useConfirm';

export default function SecurityPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState('');
  // Llega desde el login cuando ErpConfig.security.require2FAForRoles obliga a este rol.
  const [searchParams] = useSearchParams();
  const required2FA = searchParams.get('required2fa') === '1';

  async function refresh() {
    const [st, ss] = await Promise.all([authApi.get2FAStatus(), authApi.getSessions()]);
    setEnabled(st.data.enabled);
    setSessions(ss.data);
  }
  useEffect(() => { refresh().catch(() => setError('No se pudo cargar el estado de seguridad')); }, []);

  if (enabled === null) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🔐</div>
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Seguridad</h1>
          <p className="text-sm text-surface-500">Autenticación en dos pasos y sesiones activas</p>
        </div>
      </div>

      {error && <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">{error}</p>}

      {required2FA && !enabled && (
        <p className="text-amber-700 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          <strong>Tu empresa exige verificación en dos pasos para tu rol.</strong> Activa el 2FA aquí abajo
          escaneando el código QR con tu app de autenticación (Google Authenticator, Authy, etc.).
        </p>
      )}

      {enabled
        ? <TwoFactorEnabledCard onChanged={refresh} />
        : <TwoFactorWizard onDone={refresh} />}

      <SessionsCard sessions={sessions} onChanged={refresh} />

      <MyPermissionsCard />
    </div>
  );
}

/** "Mis permisos": lo que este rol puede hacer, generado desde las mismas reglas que el servidor aplica. */
function MyPermissionsCard() {
  const [matrix, setMatrix] = useState<Awaited<ReturnType<typeof authApi.getMyPermissions>>['data'] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { authApi.getMyPermissions().then((r) => setMatrix(r.data)).catch(() => setFailed(true)); }, []);

  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 shadow-soft space-y-3">
      <div>
        <h2 className="font-semibold text-surface-900 dark:text-white">🧭 Mis permisos</h2>
        <p className="text-xs text-surface-500">Qué puedes hacer en cada módulo con tu rol. Se genera desde las reglas reales del servidor, no es una lista aparte.</p>
      </div>
      {failed && <p className="text-sm text-red-600 dark:text-red-400">No se pudieron cargar los permisos.</p>}
      {matrix && (
        <>
          <p className="text-sm text-surface-700 dark:text-surface-300">
            <span className="font-medium text-surface-900 dark:text-white">{matrix.roleLabel}</span> — {matrix.description}
            {matrix.fullAccess && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300">Control total</span>}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {matrix.rows.map((row) => (
              <div key={row.subject} className="border border-surface-100 dark:border-surface-700 rounded-lg px-3 py-2">
                <p className="text-sm font-medium text-surface-900 dark:text-white">{row.label}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {row.actions.map((a) => (
                    <span key={a.action} className="text-[11px] px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300">{a.label}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Wizard de enrolamiento de 3 pasos (mejora DeepSeek #4) ──
function TwoFactorWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(1);
  const [qr, setQr] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Si quedó un enrolamiento a medias (recarga de página), retomar el paso 2 con el QR (DeepSeek #6).
  useEffect(() => {
    authApi.pending2FA().then(({ data }) => {
      if (data.pending && data.qrDataUrl && data.secret) {
        setQr({ qrDataUrl: data.qrDataUrl, secret: data.secret });
        setStep(2);
      }
    }).catch(() => {});
  }, []);

  async function start() {
    setBusy(true); setError('');
    try {
      const { data } = await authApi.enroll2FA();
      setQr({ qrDataUrl: data.qrDataUrl, secret: data.secret });
      setStep(2);
    } catch (e: any) { setError(e.response?.data?.error || 'No se pudo iniciar el enrolamiento'); }
    finally { setBusy(false); }
  }

  async function confirm() {
    setBusy(true); setError('');
    try {
      await authApi.confirm2FA(code.trim());
      setStep(3);
      setTimeout(onDone, 1200);
    } catch (e: any) { setError(e.response?.data?.error || 'Código incorrecto'); }
    finally { setBusy(false); }
  }

  const steps = ['Escanear QR', 'Ingresar código', 'Activar'];

  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        {steps.map((label, i) => {
          const n = i + 1;
          const active = step === n, done = step > n;
          return (
            <div key={label} className="flex-1 flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${done ? 'bg-green-500 text-white' : active ? 'bg-brand-500 text-white' : 'bg-surface-100 dark:bg-surface-700 text-surface-500'}`}>
                {done ? '✓' : n}
              </div>
              <span className={`ml-2 text-xs ${active ? 'text-surface-900 dark:text-white font-medium' : 'text-surface-500'}`}>{label}</span>
              {n < steps.length && <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700 mx-2" />}
            </div>
          );
        })}
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {step === 1 && (
        <div className="text-center">
          <p className="text-sm text-surface-600 dark:text-surface-300 mb-4">Protege tu cuenta con una app de autenticación (Google Authenticator, Authy, etc.).</p>
          <button onClick={start} disabled={busy} className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {busy ? 'Generando…' : 'Comenzar'}
          </button>
        </div>
      )}

      {step === 2 && qr && (
        <div className="text-center">
          <p className="text-sm text-surface-600 dark:text-surface-300 mb-3">Escanea este código con tu app:</p>
          {qr.qrDataUrl && <img src={qr.qrDataUrl} alt="QR 2FA" className="mx-auto w-44 h-44 rounded-lg bg-white p-2" />}
          <p className="text-xs text-surface-400 mt-2">¿No puedes escanear? Clave: <code className="text-surface-600 dark:text-surface-300">{qr.secret}</code></p>
          <div className="mt-4 flex flex-col items-center gap-3">
            <input type="text" inputMode="numeric" maxLength={6} value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000"
              className="w-40 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-4 py-2 text-center text-xl tracking-[0.4em] text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
            <button onClick={confirm} disabled={busy || code.length < 6}
              className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {busy ? 'Verificando…' : 'Confirmar y activar'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center py-4">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-surface-900 dark:text-white font-medium">2FA activado correctamente</p>
        </div>
      )}
    </div>
  );
}

function TwoFactorEnabledCard({ onChanged }: { onChanged: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [disabling, setDisabling] = useState(false);

  async function disable() {
    setBusy(true); setError('');
    try {
      await authApi.disable2FA(code.trim());
      setDisabling(false); setCode('');
      onChanged();
    } catch (e: any) { setError(e.response?.data?.error || 'Código incorrecto'); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-surface-900 dark:text-white font-medium flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">ACTIVO</span>
            Autenticación en dos pasos
          </p>
          <p className="text-sm text-surface-500 mt-1">Tu cuenta pide un código de 6 dígitos al iniciar sesión.</p>
        </div>
        {!disabling && <button onClick={() => setDisabling(true)} className="text-sm text-red-500 hover:text-red-600">Desactivar</button>}
      </div>
      {disabling && (
        <div className="mt-4 flex items-end gap-2">
          <div>
            <label className="text-xs text-surface-500 block mb-1">Confirma con un código vigente</label>
            <input type="text" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000" className="w-36 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-center tracking-widest text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
          </div>
          <button onClick={disable} disabled={busy || code.length < 6} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">Desactivar</button>
          <button onClick={() => { setDisabling(false); setCode(''); }} className="px-3 py-2 text-surface-500 text-sm">Cancelar</button>
        </div>
      )}
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  );
}

function SessionsCard({ sessions, onChanged }: { sessions: Session[]; onChanged: () => void }) {
  const confirmAction = useConfirm();
  async function revoke(id: string) {
    if (!await confirmAction({ title: 'Cerrar sesión', message: '¿Cerrar esta sesión?', variant: 'danger' })) return;
    await authApi.revokeSession(id);
    onChanged();
  }
  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-surface-200 dark:border-surface-700 font-semibold text-surface-900 dark:text-white text-sm">Sesiones activas ({sessions.length})</div>
      <div className="divide-y divide-surface-100 dark:divide-surface-700">
        {sessions.map(s => (
          <div key={s.id} className="px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-900 dark:text-white flex items-center gap-2">
                {s.ip || 'IP desconocida'}
                {s.current && <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">ESTA SESIÓN</span>}
              </p>
              <p className="text-xs text-surface-500 truncate max-w-md">{s.userAgent || '—'}</p>
              <p className="text-[11px] text-surface-400">Última actividad: {new Date(s.lastActivityAt).toLocaleString()}</p>
            </div>
            {!s.current && <button onClick={() => revoke(s.id)} className="text-sm text-red-500 hover:text-red-600">Cerrar</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
