import { useState, useEffect } from 'react';
import type { ZodTypeAny } from 'zod';
import { Form, ProgressBar, Alert, Badge } from 'react-bootstrap';
import { companyApi, approvalMatrixApi, type ApprovalMatrixLevel, type CompanySettings, type ErpSettings } from '../../api/company';
import { useToast } from '../../components/ui/Toast';
import { documentsSchema, companyProfileSchema, purchasesSchema, salesSchema, securitySchema, financeSchema, flattenErrors } from '../../schemas/erpConfig.schema';
import { invalidateCameraScannerCache } from '../../hooks/useCameraScannerEnabled';
import { ROLE_LABELS, type AppRole } from '../../lib/permissions';
import { logisticsApi } from '../../api/logistics';
import { useConfirm } from '../../hooks/useConfirm';

/**
 * Webhooks de couriers: cada courier hace POST a la URL de la empresa con el token en el
 * header X-Webhook-Token. Rotar el token invalida el anterior de inmediato.
 */
function LogisticsWebhookSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const [info, setInfo] = useState<{ enabled: boolean; webhookToken: string; pathTemplate: string; header: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);
  useEffect(() => { logisticsApi.getWebhookInfo().then((r) => setInfo(r.data)).catch(() => setInfo(null)); }, []);

  const rotate = async () => {
    const ok = await confirm({
      title: info?.enabled ? '¿Rotar el token de webhooks?' : '¿Habilitar webhooks de couriers?',
      message: info?.enabled ? 'El token actual dejará de funcionar de inmediato: habrá que actualizarlo en cada courier.' : 'Se generará un token que deberás configurar en cada courier (Servientrega, Tramaco, DHL, Urbano…).',
      confirmLabel: info?.enabled ? 'Rotar' : 'Habilitar', variant: info?.enabled ? 'danger' : 'default',
    });
    if (!ok) return;
    setBusy(true);
    try { const r = await logisticsApi.rotateWebhookToken(); setInfo(r.data); setReveal(true); toast.success('Token generado'); }
    catch { toast.error('No se pudo generar el token'); }
    finally { setBusy(false); }
  };

  const url = `${window.location.origin.replace(/:\d+$/, ':5001')}${info?.pathTemplate ?? ''}`;
  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 space-y-3">
      <h2 className="text-base font-semibold text-surface-900 dark:text-white flex items-center gap-2">🚚 Logística — webhooks de couriers</h2>
      <p className="text-xs text-surface-500">
        Servientrega, Tramaco, DHL o Urbano pueden enviar cada evento de tracking a KallpaPro en vez de que alguien lo capture a
        mano. El evento se registra en la guía por su número (guía del courier o tracking interno) con la misma máquina de estados
        que la captura manual: al entregar factura, al fallar avisa. Acepta cualquier JSON con guía + estado (campos reconocidos por
        alias en español/inglés).
      </p>
      {info === null ? <p className="text-sm text-surface-400">Cargando…</p> : (
        <>
          <p className="text-sm text-surface-700 dark:text-surface-300">
            Estado: {info.enabled ? <span className="text-green-600 dark:text-green-400 font-medium">habilitado</span> : <span className="text-surface-500">deshabilitado (sin token)</span>}
          </p>
          {info.enabled && (
            <div className="text-xs space-y-1 font-mono bg-surface-50 dark:bg-surface-900 rounded-lg p-3 border border-surface-200 dark:border-surface-700 break-all">
              <p><span className="text-surface-500">POST </span>{url.replace('{courier}', 'servientrega')}</p>
              <p><span className="text-surface-500">{info.header}: </span>{reveal ? info.webhookToken : '•'.repeat(24)} <button onClick={() => setReveal((v) => !v)} className="ml-2 text-brand-500 hover:underline font-sans">{reveal ? 'ocultar' : 'mostrar'}</button></p>
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={rotate} disabled={busy} className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
              {info.enabled ? 'Rotar token' : 'Habilitar webhooks'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const DEFAULT_ERP: ErpSettings = {
  purchases: { minQuotations: 3 },
  documents: { reqPrefix: 'REQ-', poPrefix: 'OC-', adjPrefix: 'AJU-' },
  inventory: { requireAdjustmentApproval: true, enableCameraScanner: false },
  sales: {
    enforceCreditLimit: true,
    allowPartialDispatch: false,
    maxDiscountByRole: { ADMIN: 100, GERENTE: 100, GERENTE_VENTAS: 20, SUPERVISOR_VENTAS: 20, FUERZA_VENTAS: 5, USER: 5 },
    discountApproverRoles: ['ADMIN', 'GERENTE', 'GERENTE_VENTAS'],
  },
  security: { sessionTimeoutMinutes: 30, require2FAForRoles: [] },
  finance: {
    paymentResponsableLimit: 500,
    paymentGerencialLimit: 5000,
    dunning: {
      enabled: false,
      pauseWhenPromise: true,
      steps: [
        { daysOverdue: 3, type: 'EMAIL', message: 'Estimado/a {{cliente}}: le recordamos que la factura {{factura}} por ${{saldo}} venció el {{vencimiento}}. Si ya realizó el pago, ignore este mensaje. Gracias, {{empresa}}.' },
        { daysOverdue: 15, type: 'WHATSAPP', message: 'Hola {{cliente}}, la factura {{factura}} (${{saldo}}) lleva {{dias}} días vencida. ¿Podemos coordinar la fecha de pago? — {{empresa}}' },
        { daysOverdue: 30, type: 'CALL', message: 'Llamar a {{cliente}}: factura {{factura}} con {{dias}} días de mora y saldo ${{saldo}}. Acordar plan de pago o escalar a gerencia.' },
      ],
    },
  },
  logistics: { webhookToken: '' },
  regional: { currencyCode: 'USD', currencySymbol: '$' },
  company: { ruc: '', address: '', city: '', website: '' },
};

const DUNNING_TYPE_LABELS: Record<string, string> = { EMAIL: 'Email (se envía solo si hay SendGrid)', WHATSAPP: 'WhatsApp (tarea para el gestor)', CALL: 'Llamada (tarea para el gestor)' };

// Roles con permisos de venta: son los que aparecen en la tabla de topes de descuento.
const DISCOUNT_ROLES: AppRole[] = ['ADMIN', 'GERENTE', 'GERENTE_VENTAS', 'SUPERVISOR_VENTAS', 'FUERZA_VENTAS', 'USER'];
const ALL_ROLES = Object.keys(ROLE_LABELS) as AppRole[];

const DEFAULT_MATRIX: Omit<ApprovalMatrixLevel, 'id'>[] = [
  { level: 1, label: 'Jefe de Área',         minAmount: 0,        maxAmount: 500,    approverRole: 'LEVEL1_APPROVER' },
  { level: 2, label: 'Jefe de Compras',       minAmount: 500.01,   maxAmount: 5000,   approverRole: 'LEVEL2_APPROVER' },
  { level: 3, label: 'Director Financiero',   minAmount: 5000.01,  maxAmount: 50000,  approverRole: 'LEVEL3_APPROVER' },
  { level: 4, label: 'Gerente General',       minAmount: 50000.01, maxAmount: 200000, approverRole: 'LEVEL4_APPROVER' },
  { level: 5, label: 'Directorio / Comité',   minAmount: 200000.01,maxAmount: null,   approverRole: 'LEVEL5_APPROVER' },
];

export default function CompanySettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [matrix, setMatrix] = useState<Omit<ApprovalMatrixLevel, 'id'>[]>(DEFAULT_MATRIX);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Datos generales editables de la empresa
  const [general, setGeneral] = useState({ name: '', email: '', phone: '', industry: '' });
  const [savingGeneral, setSavingGeneral] = useState(false);

  // Configuración del ERP (compras, documentos, inventario, regional, perfil fiscal)
  const [erp, setErp] = useState<ErpSettings>(DEFAULT_ERP);
  const [savingErp, setSavingErp] = useState<string | null>(null);
  // Errores de validación por campo (clave "seccion.campo"), validados con Zod en el cliente.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const errClass = (key: string) => fieldErrors[key]
    ? 'border-red-500 focus:border-red-500'
    : 'border-surface-200 dark:border-surface-700 focus:border-brand-500';

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const res = await companyApi.getSettings();
      setSettings(res.data);
      setGeneral({
        name: res.data.name ?? '',
        email: res.data.email ?? '',
        phone: res.data.phone ?? '',
        industry: res.data.industry ?? '',
      });
      if (res.data.settings) setErp({ ...DEFAULT_ERP, ...res.data.settings });
      if (res.data.approvalMatrix?.length > 0) {
        setMatrix(res.data.approvalMatrix.map(({ id: _id, ...rest }) => rest));
      }
    } catch {
      setError('No se pudo cargar la configuración de empresa');
    } finally {
      setLoading(false);
    }
  }

  async function handleTogglePublicEntity(checked: boolean) {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await companyApi.updateSettings({ isPublicEntity: checked });
      setSettings((prev) => prev ? { ...prev, isPublicEntity: res.data.isPublicEntity } : prev);
      toast.success(checked ? 'Entidad pública habilitada' : 'Modo empresa privada activado');
    } catch {
      toast.error('No se pudo actualizar la configuración');
    } finally {
      setSaving(false);
    }
  }

  // Reemplaza los errores de las secciones dadas (por prefijo) con los nuevos.
  function applyErrors(prefixes: string[], newErrs: Record<string, string>) {
    setFieldErrors((prev) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!prefixes.some((p) => k.startsWith(p))) next[k] = v;
      }
      return { ...next, ...newErrs };
    });
  }

  async function handleSaveGeneral() {
    const parsed = companyProfileSchema.safeParse(erp.company);
    const errs: Record<string, string> = {};
    if (!general.name.trim()) errs['general.name'] = 'El nombre de la empresa es obligatorio';
    if (!parsed.success) Object.assign(errs, flattenErrors('company', parsed.error));
    applyErrors(['general.', 'company.'], errs);
    if (Object.keys(errs).length) { toast.error('Revisa los campos marcados en rojo'); return; }
    setSavingGeneral(true);
    try {
      const res = await companyApi.updateSettings({
        name: general.name.trim(),
        email: general.email.trim() || null,
        phone: general.phone.trim() || null,
        industry: general.industry.trim() || null,
        settings: { company: erp.company },
      });
      setSettings((prev) => prev ? { ...prev, ...res.data } : prev);
      if (res.data.settings) setErp({ ...DEFAULT_ERP, ...res.data.settings });
      toast.success('Datos de la empresa guardados');
    } catch {
      toast.error('No se pudieron guardar los datos de la empresa');
    } finally {
      setSavingGeneral(false);
    }
  }

  // Validación Zod por sección (plan #18 · #14): feedback por campo antes de enviar.
  const SECTION_SCHEMAS: Partial<Record<keyof ErpSettings, ZodTypeAny>> = {
    documents: documentsSchema,
    purchases: purchasesSchema,
    sales: salesSchema,
    security: securitySchema,
    finance: financeSchema,
  };

  async function handleSaveErp(section: keyof ErpSettings, label: string) {
    const schema = SECTION_SCHEMAS[section];
    if (schema) {
      const parsed = schema.safeParse(erp[section]);
      applyErrors([`${section}.`], parsed.success ? {} : flattenErrors(section, parsed.error));
      if (!parsed.success) { toast.error('Revisa los campos marcados en rojo'); return; }
    }
    setSavingErp(section);
    try {
      const res = await companyApi.updateSettings({ settings: { [section]: erp[section] } });
      if (res.data.settings) setErp({ ...DEFAULT_ERP, ...res.data.settings });
      toast.success(`${label} guardado`);
    } catch {
      toast.error('No se pudo guardar la configuración');
    } finally {
      setSavingErp(null);
    }
  }

  async function handleToggleAdjustmentApproval(checked: boolean) {
    setErp((e) => ({ ...e, inventory: { ...e.inventory, requireAdjustmentApproval: checked } }));
    setSavingErp('inventory');
    try {
      const res = await companyApi.updateSettings({ settings: { inventory: { requireAdjustmentApproval: checked } } });
      if (res.data.settings) setErp({ ...DEFAULT_ERP, ...res.data.settings });
      toast.success(checked ? 'Doble autorización de ajustes activada' : 'Doble autorización de ajustes desactivada');
    } catch {
      toast.error('No se pudo actualizar');
    } finally {
      setSavingErp(null);
    }
  }

  async function handleToggleCameraScanner(checked: boolean) {
    setErp((e) => ({ ...e, inventory: { ...e.inventory, enableCameraScanner: checked } }));
    setSavingErp('inventory');
    try {
      const res = await companyApi.updateSettings({ settings: { inventory: { enableCameraScanner: checked } } });
      if (res.data.settings) setErp({ ...DEFAULT_ERP, ...res.data.settings });
      invalidateCameraScannerCache(); // que las páginas relean el flag
      toast.success(checked ? 'Escáner con cámara habilitado' : 'Escáner con cámara deshabilitado');
    } catch {
      toast.error('No se pudo actualizar');
    } finally {
      setSavingErp(null);
    }
  }

  async function handleToggleAi(checked: boolean) {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await companyApi.updateSettings({ aiEnabled: checked });
      setSettings((prev) => prev ? { ...prev, aiEnabled: res.data.aiEnabled } : prev);
      toast.success(checked ? 'IA (Ollama) habilitada' : 'IA (Ollama) desactivada');
    } catch {
      toast.error('No se pudo actualizar la configuración de IA');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMatrix() {
    setSavingMatrix(true);
    try {
      const res = await approvalMatrixApi.upsertMatrix(matrix);
      setMatrix(res.data.map(({ id: _id, ...rest }) => rest));
      toast.success('Matriz de aprobación guardada correctamente');
    } catch {
      toast.error('Error al guardar la matriz de aprobación');
    } finally {
      setSavingMatrix(false);
    }
  }

  async function handleRestoreDefaults() {
    setSavingMatrix(true);
    try {
      const res = await approvalMatrixApi.seedDefault();
      setMatrix(res.data.map(({ id: _id, ...rest }) => rest));
      toast.success('Matriz restaurada a los valores por defecto');
    } catch {
      toast.error('Error al restaurar valores por defecto');
    } finally {
      setSavingMatrix(false);
    }
  }

  function updateLevel(index: number, field: keyof Omit<ApprovalMatrixLevel, 'id'>, value: string | number | null) {
    setMatrix((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Alert variant="danger">{error}</Alert>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Configuración de Empresa</h1>
        <p className="text-sm text-surface-500 mt-1">Parámetros generales y gobernanza del proceso de compras</p>
      </div>

      {/* ── Datos generales de la empresa ── */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 space-y-4">
        <h2 className="text-base font-semibold text-surface-900 dark:text-white flex items-center gap-2">
          🏢 Datos de la Empresa
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Nombre / Razón social *</label>
            <input
              value={general.name}
              onChange={(e) => setGeneral((g) => ({ ...g, name: e.target.value }))}
              className={`w-full bg-surface-50 dark:bg-surface-900 border ${errClass('general.name')} rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none`}
              placeholder="KallpaPro Demo"
            />
            {fieldErrors['general.name'] && <p className="text-xs text-red-500 mt-1">{fieldErrors['general.name']}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Industria / Sector</label>
            <input
              value={general.industry}
              onChange={(e) => setGeneral((g) => ({ ...g, industry: e.target.value }))}
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
              placeholder="Comercio, manufactura…"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Email de contacto</label>
            <input
              type="email"
              value={general.email}
              onChange={(e) => setGeneral((g) => ({ ...g, email: e.target.value }))}
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
              placeholder="contacto@empresa.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Teléfono</label>
            <input
              value={general.phone}
              onChange={(e) => setGeneral((g) => ({ ...g, phone: e.target.value }))}
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
              placeholder="+593 …"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">RUC / Identificación tributaria</label>
            <input
              value={erp.company.ruc}
              onChange={(e) => setErp((s) => ({ ...s, company: { ...s.company, ruc: e.target.value } }))}
              className={`w-full bg-surface-50 dark:bg-surface-900 border ${errClass('company.ruc')} rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none`}
              placeholder="1790012345001"
            />
            {fieldErrors['company.ruc'] && <p className="text-xs text-red-500 mt-1">{fieldErrors['company.ruc']}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Sitio web</label>
            <input
              value={erp.company.website}
              onChange={(e) => setErp((s) => ({ ...s, company: { ...s.company, website: e.target.value } }))}
              className={`w-full bg-surface-50 dark:bg-surface-900 border ${errClass('company.website')} rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none`}
              placeholder="https://empresa.com"
            />
            {fieldErrors['company.website'] && <p className="text-xs text-red-500 mt-1">{fieldErrors['company.website']}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Dirección</label>
            <input
              value={erp.company.address}
              onChange={(e) => setErp((s) => ({ ...s, company: { ...s.company, address: e.target.value } }))}
              className={`w-full bg-surface-50 dark:bg-surface-900 border ${errClass('company.address')} rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none`}
              placeholder="Av. Principal 123"
            />
            {fieldErrors['company.address'] && <p className="text-xs text-red-500 mt-1">{fieldErrors['company.address']}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Ciudad</label>
            <input
              value={erp.company.city}
              onChange={(e) => setErp((s) => ({ ...s, company: { ...s.company, city: e.target.value } }))}
              className={`w-full bg-surface-50 dark:bg-surface-900 border ${errClass('company.city')} rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none`}
              placeholder="Quito"
            />
            {fieldErrors['company.city'] && <p className="text-xs text-red-500 mt-1">{fieldErrors['company.city']}</p>}
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleSaveGeneral}
            disabled={savingGeneral}
            className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {savingGeneral && <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
            Guardar datos
          </button>
        </div>
      </div>

      {/* ── Tipo de entidad ── */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 space-y-4">
        <h2 className="text-base font-semibold text-surface-900 dark:text-white flex items-center gap-2">
          🏛️ Tipo de Entidad
        </h2>

        <div className="flex items-start gap-4">
          <Form.Check
            type="switch"
            id="isPublicEntity"
            label=""
            checked={settings?.isPublicEntity ?? false}
            onChange={(e) => handleTogglePublicEntity(e.target.checked)}
            disabled={saving}
            style={{ '--bs-primary': '#00B8E0' } as React.CSSProperties}
          />
          <div>
            <p className="text-sm font-medium text-surface-900 dark:text-white">
              Entidad Pública (sujeta a LOSNCP / SERCOP)
            </p>
            <p className="text-xs text-surface-500 mt-0.5">
              Al activar esta opción, se habilitan los campos SERCOP (RUP, número de habilitación) en el KYC de proveedores
              y el proceso de compras se adapta a la Ley Orgánica del Sistema Nacional de Contratación Pública.
            </p>
          </div>
        </div>

        {settings?.isPublicEntity && (
          <Alert variant="info" className="text-sm py-2 px-3">
            <strong>SERCOP activo.</strong> Los proveedores deben tener número RUP y certificado UAFE vigente
            para poder emitir órdenes de compra. Esto se valida en el perfil KYC de cada proveedor.
          </Alert>
        )}
      </div>

      {/* ── Inteligencia Artificial (Ollama) ── */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 space-y-4">
        <h2 className="text-base font-semibold text-surface-900 dark:text-white flex items-center gap-2">
          🤖 Inteligencia Artificial (Ollama)
        </h2>

        <div className="flex items-start gap-4">
          <Form.Check
            type="switch"
            id="aiEnabled"
            label=""
            checked={settings?.aiEnabled ?? false}
            onChange={(e) => handleToggleAi(e.target.checked)}
            disabled={saving}
            style={{ '--bs-primary': '#00B8E0' } as React.CSSProperties}
          />
          <div>
            <p className="text-sm font-medium text-surface-900 dark:text-white">
              Habilitar asistencia con IA (Ollama)
            </p>
            <p className="text-xs text-surface-500 mt-0.5">
              Controla las funciones de IA del ERP (asistente, sugerencias de proveedores, insights financieros,
              predicción de demanda, agentes CRM). Al desactivarlo, el sistema <strong>no intenta conectarse a Ollama</strong>,
              evitando esperas/cuelgues cuando el servicio no está disponible. Puedes reactivarlo aquí cuando lo necesites.
            </p>
          </div>
        </div>

        {settings && !settings.aiEnabled && (
          <Alert variant="secondary" className="text-sm py-2 px-3 mb-0">
            La IA está <strong>desactivada</strong>. Las funciones inteligentes mostrarán un aviso y usarán cálculos
            estándar (sin IA) hasta que la vuelvas a habilitar.
          </Alert>
        )}
      </div>

      {/* ── Compras ── */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 space-y-4">
        <h2 className="text-base font-semibold text-surface-900 dark:text-white flex items-center gap-2">
          🛒 Compras
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Mínimo de cotizaciones para elegir ganador</label>
            <select
              value={erp.purchases.minQuotations}
              onChange={(e) => setErp((s) => ({ ...s, purchases: { ...s.purchases, minQuotations: Number(e.target.value) } }))}
              className="w-40 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
            >
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n} cotización{n > 1 ? 'es' : ''}</option>)}
            </select>
          </div>
          <button
            onClick={() => handleSaveErp('purchases', 'Mínimo de cotizaciones')}
            disabled={savingErp === 'purchases'}
            className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            Guardar
          </button>
        </div>
        <p className="text-xs text-surface-500">
          El sistema exige este número de cotizaciones de proveedores antes de permitir elegir al ganador y generar la Orden de Compra.
        </p>
      </div>

      {/* ── Ventas: crédito, despacho parcial y topes de descuento por rol ── */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 space-y-4">
        <h2 className="text-base font-semibold text-surface-900 dark:text-white flex items-center gap-2">
          💰 Ventas
        </h2>

        <div className="flex items-start gap-4">
          <Form.Check
            type="switch"
            id="enforceCreditLimit"
            label=""
            checked={erp.sales.enforceCreditLimit}
            onChange={(e) => setErp((s) => ({ ...s, sales: { ...s.sales, enforceCreditLimit: e.target.checked } }))}
            disabled={savingErp === 'sales'}
            style={{ '--bs-primary': '#00B8E0' } as React.CSSProperties}
          />
          <div>
            <p className="text-sm font-medium text-surface-900 dark:text-white">Bloquear pedidos que excedan el límite de crédito del cliente</p>
            <p className="text-xs text-surface-500 mt-0.5">Si está activo, un pedido no se puede confirmar cuando el saldo pendiente + el pedido supera el cupo de crédito.</p>
          </div>
        </div>

        <div className="flex items-start gap-4 pt-3 border-t border-surface-100 dark:border-surface-700">
          <Form.Check
            type="switch"
            id="allowPartialDispatch"
            label=""
            checked={erp.sales.allowPartialDispatch}
            onChange={(e) => setErp((s) => ({ ...s, sales: { ...s.sales, allowPartialDispatch: e.target.checked } }))}
            disabled={savingErp === 'sales'}
            style={{ '--bs-primary': '#00B8E0' } as React.CSSProperties}
          />
          <div>
            <p className="text-sm font-medium text-surface-900 dark:text-white">Permitir despacho parcial de pedidos</p>
            <p className="text-xs text-surface-500 mt-0.5">Un pedido puede salir en varios envíos. Si está desactivado, solo se despacha completo.</p>
          </div>
        </div>

        <div className="pt-3 border-t border-surface-100 dark:border-surface-700">
          <p className="text-sm font-medium text-surface-900 dark:text-white mb-1">Tope de descuento por rol (%)</p>
          <p className="text-xs text-surface-500 mb-3">
            El precio de venta sale de la lista de precios vigente; cada vendedor solo puede aplicar descuento hasta el tope de su rol.
            Roles sin tope definido → 0% (no pueden descontar).
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {DISCOUNT_ROLES.map((role) => (
              <div key={role}>
                <label className="block text-xs font-medium text-surface-500 mb-1">{ROLE_LABELS[role]}</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={erp.sales.maxDiscountByRole[role] ?? 0}
                    onChange={(e) => setErp((s) => ({
                      ...s,
                      sales: {
                        ...s.sales,
                        maxDiscountByRole: { ...s.sales.maxDiscountByRole, [role]: e.target.value === '' ? 0 : Number(e.target.value) },
                      },
                    }))}
                    className={`w-full bg-surface-50 dark:bg-surface-900 border ${errClass(`sales.maxDiscountByRole.${role}`)} rounded-lg px-3 py-2 pr-7 text-sm text-surface-900 dark:text-white focus:outline-none`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400">%</span>
                </div>
                {fieldErrors[`sales.maxDiscountByRole.${role}`] && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors[`sales.maxDiscountByRole.${role}`]}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-surface-100 dark:border-surface-700">
          <p className="text-sm font-medium text-surface-900 dark:text-white mb-1">Roles que aprueban cotizaciones fuera de tope</p>
          <p className="text-xs text-surface-500 mb-3">
            Si un vendedor pide más descuento del que su rol permite, o el precio queda por debajo del costo del
            producto, la cotización queda "Pendiente de aprobación" en vez de bloquearse. Estos roles pueden aprobarla o rechazarla.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALL_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={erp.sales.discountApproverRoles.includes(role)}
                  onChange={(e) => setErp((s) => ({
                    ...s,
                    sales: {
                      ...s.sales,
                      discountApproverRoles: e.target.checked
                        ? [...s.sales.discountApproverRoles, role]
                        : s.sales.discountApproverRoles.filter((r) => r !== role),
                    },
                  }))}
                  className="rounded border-surface-300 text-brand-500 focus:ring-brand-500"
                />
                {ROLE_LABELS[role]}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => handleSaveErp('sales', 'Configuración de ventas')}
            disabled={savingErp === 'sales'}
            className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            Guardar ventas
          </button>
        </div>
      </div>

      {/* ── Inventario ── */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 space-y-4">
        <h2 className="text-base font-semibold text-surface-900 dark:text-white flex items-center gap-2">
          📦 Inventario
        </h2>
        <div className="flex items-start gap-4">
          <Form.Check
            type="switch"
            id="requireAdjustmentApproval"
            label=""
            checked={erp.inventory.requireAdjustmentApproval}
            onChange={(e) => handleToggleAdjustmentApproval(e.target.checked)}
            disabled={savingErp === 'inventory'}
            style={{ '--bs-primary': '#00B8E0' } as React.CSSProperties}
          />
          <div>
            <p className="text-sm font-medium text-surface-900 dark:text-white">
              Requerir doble autorización en ajustes de inventario
            </p>
            <p className="text-xs text-surface-500 mt-0.5">
              Si está activo, el bodeguero <strong>solicita</strong> el ajuste y un responsable de finanzas/gerencia debe <strong>aprobarlo</strong> antes de mover stock.
              Si lo desactivas, los ajustes se aplican de inmediato (sin segunda firma).
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 pt-3 border-t border-surface-100 dark:border-surface-700">
          <Form.Check
            type="switch"
            id="enableCameraScanner"
            label=""
            checked={erp.inventory.enableCameraScanner}
            onChange={(e) => handleToggleCameraScanner(e.target.checked)}
            disabled={savingErp === 'inventory'}
            style={{ '--bs-primary': '#00B8E0' } as React.CSSProperties}
          />
          <div>
            <p className="text-sm font-medium text-surface-900 dark:text-white">
              Escáner de códigos con cámara (QR / barcode)
            </p>
            <p className="text-xs text-surface-500 mt-0.5">
              Usa la webcam para escanear códigos en Inventario. <strong>Desactivado por defecto</strong>: en algunos
              equipos Windows el navegador retiene la cámara a nivel de sistema y bloquea otras aplicaciones.
              Con el escáner desactivado sigue disponible la <strong>entrada manual</strong> y las pistolas lectoras USB.
            </p>
          </div>
        </div>
      </div>

      {/* ── Seguridad: timeout de sesión y 2FA obligatorio por rol ── */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 space-y-4">
        <h2 className="text-base font-semibold text-surface-900 dark:text-white flex items-center gap-2">
          🔐 Seguridad
        </h2>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Cierre de sesión por inactividad (minutos)</label>
            <input
              type="number"
              min={5}
              max={1440}
              value={erp.security.sessionTimeoutMinutes}
              onChange={(e) => setErp((s) => ({
                ...s,
                security: { ...s.security, sessionTimeoutMinutes: e.target.value === '' ? 0 : Number(e.target.value) },
              }))}
              className={`w-40 bg-surface-50 dark:bg-surface-900 border ${errClass('security.sessionTimeoutMinutes')} rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none`}
            />
            {fieldErrors['security.sessionTimeoutMinutes'] && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors['security.sessionTimeoutMinutes']}</p>
            )}
          </div>
        </div>
        <p className="text-xs text-surface-500">
          Si un usuario no hace ninguna acción durante este tiempo, su sesión expira y debe volver a iniciar sesión (entre 5 y 1440 minutos).
        </p>

        <div className="pt-3 border-t border-surface-100 dark:border-surface-700">
          <p className="text-sm font-medium text-surface-900 dark:text-white mb-1">Roles obligados a usar verificación en dos pasos (2FA)</p>
          <p className="text-xs text-surface-500 mb-3">
            Los usuarios con estos roles verán un aviso al iniciar sesión hasta que activen su 2FA en Perfil → Seguridad.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALL_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={erp.security.require2FAForRoles.includes(role)}
                  onChange={(e) => setErp((s) => ({
                    ...s,
                    security: {
                      ...s.security,
                      require2FAForRoles: e.target.checked
                        ? [...s.security.require2FAForRoles, role]
                        : s.security.require2FAForRoles.filter((r) => r !== role),
                    },
                  }))}
                  className="rounded border-surface-300 text-brand-500 focus:ring-brand-500"
                />
                {ROLE_LABELS[role]}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => handleSaveErp('security', 'Configuración de seguridad')}
            disabled={savingErp === 'security'}
            className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            Guardar seguridad
          </button>
        </div>
      </div>

      {/* ── Aprobaciones por monto en CxP/CxC (roadmap Asistente Contable, Fase 4) ── */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 space-y-4">
        <h2 className="text-base font-semibold text-surface-900 dark:text-white flex items-center gap-2">
          💰 Aprobaciones por monto (CxP / CxC)
        </h2>
        <p className="text-xs text-surface-500">
          Pagar, cobrar o ajustar un saldo exige, además del permiso de pagos, el rol correspondiente
          al monto: por debajo del primer límite cualquiera con permiso ejecuta; entre los dos límites
          hace falta Contador o Admin; desde el segundo límite hace falta Gerente o Admin. Se valida en
          el servidor, no solo se oculta el botón.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Desde este monto, requiere Contador o Admin ($)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={erp.finance.paymentResponsableLimit}
              onChange={(e) => setErp((s) => ({
                ...s,
                finance: { ...s.finance, paymentResponsableLimit: e.target.value === '' ? 0 : Number(e.target.value) },
              }))}
              className={`w-48 bg-surface-50 dark:bg-surface-900 border ${errClass('finance.paymentResponsableLimit')} rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none`}
            />
            {fieldErrors['finance.paymentResponsableLimit'] && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors['finance.paymentResponsableLimit']}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Desde este monto, requiere Gerente o Admin ($)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={erp.finance.paymentGerencialLimit}
              onChange={(e) => setErp((s) => ({
                ...s,
                finance: { ...s.finance, paymentGerencialLimit: e.target.value === '' ? 0 : Number(e.target.value) },
              }))}
              className={`w-48 bg-surface-50 dark:bg-surface-900 border ${errClass('finance.paymentGerencialLimit')} rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none`}
            />
            {fieldErrors['finance.paymentGerencialLimit'] && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors['finance.paymentGerencialLimit']}</p>
            )}
          </div>
        </div>
        {/* Cobranza automática (dunning) */}
        <div className="pt-4 border-t border-surface-100 dark:border-surface-700 space-y-3">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-white">⚡ Cobranza automática (recordatorios por días de mora)</h3>
          <p className="text-xs text-surface-500">
            Cada día a las 07:30 el sistema revisa la cartera vencida y genera, por factura, el recordatorio del escalón que
            corresponda — una sola vez por escalón. Queda registrado en el radar de cobranza como gestión automática; los de
            tipo Email se envían solos si hay SendGrid configurado, los demás quedan como tarea para el gestor.
            Variables: {'{{cliente}} {{factura}} {{saldo}} {{dias}} {{vencimiento}} {{empresa}}'}.
          </p>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
              <input type="checkbox" checked={erp.finance.dunning.enabled}
                onChange={(e) => setErp((s) => ({ ...s, finance: { ...s.finance, dunning: { ...s.finance.dunning, enabled: e.target.checked } } }))} />
              Activar recordatorios automáticos
            </label>
            <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
              <input type="checkbox" checked={erp.finance.dunning.pauseWhenPromise}
                onChange={(e) => setErp((s) => ({ ...s, finance: { ...s.finance, dunning: { ...s.finance.dunning, pauseWhenPromise: e.target.checked } } }))} />
              Pausar si hay promesa de pago vigente
            </label>
          </div>
          <div className="space-y-2">
            {erp.finance.dunning.steps.map((step, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-2">
                  <label className="block text-[11px] text-surface-500">Días de mora</label>
                  <input type="number" min={1} max={365} value={step.daysOverdue}
                    onChange={(e) => setErp((s) => ({ ...s, finance: { ...s.finance, dunning: { ...s.finance.dunning, steps: s.finance.dunning.steps.map((st, i) => i === idx ? { ...st, daysOverdue: Number(e.target.value) } : st) } } }))}
                    className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1.5 text-sm text-surface-900 dark:text-white" />
                </div>
                <div className="col-span-3">
                  <label className="block text-[11px] text-surface-500">Canal</label>
                  <select value={step.type}
                    onChange={(e) => setErp((s) => ({ ...s, finance: { ...s.finance, dunning: { ...s.finance.dunning, steps: s.finance.dunning.steps.map((st, i) => i === idx ? { ...st, type: e.target.value as any } : st) } } }))}
                    className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1.5 text-sm text-surface-900 dark:text-white">
                    {Object.entries(DUNNING_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="col-span-6">
                  <label className="block text-[11px] text-surface-500">Mensaje</label>
                  <textarea rows={2} value={step.message}
                    onChange={(e) => setErp((s) => ({ ...s, finance: { ...s.finance, dunning: { ...s.finance.dunning, steps: s.finance.dunning.steps.map((st, i) => i === idx ? { ...st, message: e.target.value } : st) } } }))}
                    className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1.5 text-xs text-surface-900 dark:text-white" />
                </div>
                <button onClick={() => setErp((s) => ({ ...s, finance: { ...s.finance, dunning: { ...s.finance.dunning, steps: s.finance.dunning.steps.filter((_, i) => i !== idx) } } }))}
                  className="col-span-1 mt-5 text-surface-400 hover:text-red-500 text-sm" title="Quitar escalón">✕</button>
              </div>
            ))}
            {erp.finance.dunning.steps.length < 10 && (
              <button onClick={() => setErp((s) => ({ ...s, finance: { ...s.finance, dunning: { ...s.finance.dunning, steps: [...s.finance.dunning.steps, { daysOverdue: 45, type: 'CALL', message: 'Llamar a {{cliente}}: factura {{factura}} con {{dias}} días de mora.' }] } } }))}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline">+ Agregar escalón</button>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => handleSaveErp('finance', 'Aprobaciones y cobranza')}
            disabled={savingErp === 'finance'}
            className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            Guardar aprobaciones y cobranza
          </button>
        </div>
      </div>

      {/* ── Logística: webhooks de couriers ── */}
      <LogisticsWebhookSection />

      {/* ── Documentos y numeración ── */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 space-y-4">
        <h2 className="text-base font-semibold text-surface-900 dark:text-white flex items-center gap-2">
          🔢 Documentos y numeración
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Prefijo Requisiciones</label>
            <input
              value={erp.documents.reqPrefix}
              onChange={(e) => setErp((s) => ({ ...s, documents: { ...s.documents, reqPrefix: e.target.value } }))}
              className={`w-full bg-surface-50 dark:bg-surface-900 border ${errClass('documents.reqPrefix')} rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none`}
              placeholder="REQ-"
            />
            {fieldErrors['documents.reqPrefix'] && <p className="text-xs text-red-500 mt-1">{fieldErrors['documents.reqPrefix']}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Prefijo Órdenes de Compra</label>
            <input
              value={erp.documents.poPrefix}
              onChange={(e) => setErp((s) => ({ ...s, documents: { ...s.documents, poPrefix: e.target.value } }))}
              className={`w-full bg-surface-50 dark:bg-surface-900 border ${errClass('documents.poPrefix')} rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none`}
              placeholder="OC-"
            />
            {fieldErrors['documents.poPrefix'] && <p className="text-xs text-red-500 mt-1">{fieldErrors['documents.poPrefix']}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Prefijo Ajustes</label>
            <input
              value={erp.documents.adjPrefix}
              onChange={(e) => setErp((s) => ({ ...s, documents: { ...s.documents, adjPrefix: e.target.value } }))}
              className={`w-full bg-surface-50 dark:bg-surface-900 border ${errClass('documents.adjPrefix')} rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none`}
              placeholder="AJU-"
            />
            {fieldErrors['documents.adjPrefix'] && <p className="text-xs text-red-500 mt-1">{fieldErrors['documents.adjPrefix']}</p>}
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => handleSaveErp('documents', 'Prefijos de documentos')}
            disabled={savingErp === 'documents'}
            className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            Guardar prefijos
          </button>
        </div>
        <p className="text-xs text-surface-500">
          Se aplican a los nuevos documentos que se generen (la numeración correlativa se mantiene).
        </p>
      </div>

      {/* ── Matriz de aprobación ── */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-surface-900 dark:text-white flex items-center gap-2">
              📋 Matriz de Aprobación por Cuantía
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">
              Define cuántos niveles de aprobación requiere una Orden de Compra según su monto total.
            </p>
          </div>
          <button
            onClick={handleRestoreDefaults}
            disabled={savingMatrix}
            className="text-xs px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors disabled:opacity-50"
          >
            Restaurar valores por defecto
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-900/50">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-surface-500 uppercase tracking-wide">Nivel</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-surface-500 uppercase tracking-wide">Etiqueta</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-surface-500 uppercase tracking-wide">Desde ($)</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-surface-500 uppercase tracking-wide">Hasta ($)</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-surface-500 uppercase tracking-wide">Rol requerido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {matrix.map((row, i) => (
                <tr key={row.level} className="hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                  <td className="px-3 py-2">
                    <Badge bg="primary" style={{ '--bs-primary': '#00B8E0' } as React.CSSProperties} className="text-xs">
                      L{row.level}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.label}
                      onChange={(e) => updateLevel(i, 'label', e.target.value)}
                      className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2.5 py-1.5 text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={row.minAmount}
                      onChange={(e) => updateLevel(i, 'minAmount', parseFloat(e.target.value) || 0)}
                      className="w-28 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2.5 py-1.5 text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {row.maxAmount === null || row.maxAmount === undefined ? (
                      <span className="text-surface-400 text-xs italic">Sin límite</span>
                    ) : (
                      <input
                        type="number"
                        value={row.maxAmount}
                        onChange={(e) => updateLevel(i, 'maxAmount', parseFloat(e.target.value) || null)}
                        className="w-28 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2.5 py-1.5 text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.approverRole}
                      onChange={(e) => updateLevel(i, 'approverRole', e.target.value)}
                      className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2.5 py-1.5 text-sm text-surface-900 dark:text-white focus:outline-none focus:border-brand-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Budget visual preview */}
        <div className="mt-3 space-y-1.5">
          <p className="text-xs text-surface-500 font-medium">Vista previa de cobertura por nivel:</p>
          {matrix.map((row) => {
            const max = matrix[matrix.length - 1].maxAmount ?? 400000;
            const width = row.maxAmount
              ? Math.min(100, ((row.maxAmount / max) * 100))
              : 100;
            return (
              <div key={row.level} className="flex items-center gap-2">
                <span className="text-xs text-surface-400 w-4">{row.level}</span>
                <ProgressBar
                  now={width}
                  variant={['success', 'info', 'primary', 'warning', 'danger'][row.level - 1] as any}
                  className="flex-1 bs-progress"
                  style={{ height: '8px', borderRadius: '999px' }}
                />
                <span className="text-xs text-surface-500 w-20 text-right">
                  {row.maxAmount ? `$${row.maxAmount.toLocaleString()}` : 'Sin límite'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveMatrix}
            disabled={savingMatrix}
            className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {savingMatrix && <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
            Guardar matriz
          </button>
        </div>
      </div>
    </div>
  );
}
