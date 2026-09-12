import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import WizardLayout from '../../components/ui/WizardLayout';
import { useToast } from '../../components/ui/Toast';
import { purchasesApi } from '../../api/purchases';
import { companyApi } from '../../api/company';
import { CIIU_CODES, searchCiiu } from '../../data/ciiu';
import { IdCard, ClipboardList, Briefcase, CheckCircle, Factory } from 'lucide-react';

const STEPS = [
  { key: 'identification', label: 'Identificación', icon: <IdCard className="w-4 h-4" /> },
  { key: 'kyc',            label: 'Datos KYC',       icon: <ClipboardList className="w-4 h-4" /> },
  { key: 'financial',      label: 'Financiero + PEP', icon: <Briefcase className="w-4 h-4" /> },
  { key: 'review',         label: 'Revisión',         icon: <CheckCircle className="w-4 h-4" /> },
];

const inputCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1';

interface BeneficialOwner { name: string; document: string; percentage: number; }

interface SupplierForm {
  // Step 1 — Identificación
  personType: 'NATURAL' | 'JURIDICA' | '';
  documentType: 'RUC' | 'CEDULA' | 'PASAPORTE' | '';
  ruc: string;
  name: string;
  razonSocial: string;
  nombreComercial: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;

  // Step 2 — KYC
  // Persona natural
  birthDate: string;
  nationality: string;
  maritalStatus: '' | 'SOLTERO' | 'CASADO' | 'DIVORCIADO' | 'VIUDO' | 'UNION_LIBRE';
  spouseName: string;
  spouseDocument: string;
  occupation: string;
  employerName: string;
  workplace: string;
  // Persona jurídica
  legalRepName: string;
  legalRepDocument: string;
  beneficialOwners: BeneficialOwner[];
  ciiuCode: string;
  ciiuDescription: string;

  // Step 3 — Financiero + PEP
  annualIncome: string;
  estimatedPatrimony: string;
  paymentTerms: string;
  contribuyenteEspecial: boolean;
  obligadoContabilidad: boolean;
  isPEP: boolean;
  pepPosition: string;
  pepRelationship: string;

  // Step 3 (conditional) — SERCOP / RUP (only if company.isPublicEntity)
  rupNumber: string;
  rupStatus: '' | 'HABILITADO' | 'SUSPENDIDO' | 'NO_REGISTRADO';
  uafeCertExpiry: string;

  // Step 4 — Declaración
  declarationAccepted: boolean;
}

const INITIAL: SupplierForm = {
  personType: '', documentType: '', ruc: '', name: '', razonSocial: '', nombreComercial: '',
  email: '', phone: '', address: '', city: '', country: 'Ecuador',
  birthDate: '', nationality: 'Ecuatoriana', maritalStatus: '',
  spouseName: '', spouseDocument: '', occupation: '', employerName: '', workplace: '',
  legalRepName: '', legalRepDocument: '', beneficialOwners: [],
  ciiuCode: '', ciiuDescription: '',
  annualIncome: '', estimatedPatrimony: '', paymentTerms: '',
  contribuyenteEspecial: false, obligadoContabilidad: false,
  isPEP: false, pepPosition: '', pepRelationship: '',
  rupNumber: '', rupStatus: '', uafeCertExpiry: '',
  declarationAccepted: false,
};

export default function SupplierKYCWizard() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SupplierForm>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [ciiuQuery, setCiiuQuery] = useState('');
  const [isPublicEntity, setIsPublicEntity] = useState(false);

  useEffect(() => {
    companyApi.getSettings().then((r) => setIsPublicEntity(r.data.isPublicEntity)).catch(() => {});
  }, []);

  // Modo edición: precargar datos del proveedor existente
  useEffect(() => {
    if (!id) return;
    purchasesApi.getSupplier(id).then((r) => {
      const s = r.data || {};
      setForm((f) => ({
        ...f,
        personType: s.personType ?? '',
        documentType: s.documentType ?? '',
        ruc: s.ruc ?? '',
        name: s.name ?? '',
        razonSocial: s.razonSocial ?? '',
        nombreComercial: s.nombreComercial ?? '',
        email: s.email ?? '',
        phone: s.phone ?? '',
        address: s.address ?? '',
        city: s.city ?? '',
        country: s.country ?? 'Ecuador',
        birthDate: s.birthDate ? String(s.birthDate).slice(0, 10) : '',
        nationality: s.nationality ?? 'Ecuatoriana',
        maritalStatus: s.maritalStatus ?? '',
        spouseName: s.spouseName ?? '',
        spouseDocument: s.spouseDocument ?? '',
        occupation: s.occupation ?? '',
        employerName: s.employerName ?? '',
        workplace: s.workplace ?? '',
        legalRepName: s.legalRepName ?? '',
        legalRepDocument: s.legalRepDocument ?? '',
        beneficialOwners: Array.isArray(s.beneficialOwners) ? s.beneficialOwners : [],
        ciiuCode: s.ciiuCode ?? '',
        ciiuDescription: s.ciiuDescription ?? '',
        annualIncome: s.annualIncome != null ? String(s.annualIncome) : '',
        estimatedPatrimony: s.estimatedPatrimony != null ? String(s.estimatedPatrimony) : '',
        paymentTerms: s.paymentTerms ?? '',
        contribuyenteEspecial: !!s.contribuyenteEspecial,
        obligadoContabilidad: !!s.obligadoContabilidad,
        isPEP: !!s.isPEP,
        pepPosition: s.pepPosition ?? '',
        pepRelationship: s.pepRelationship ?? '',
        rupNumber: s.rupNumber ?? '',
        rupStatus: s.rupStatus ?? '',
        uafeCertExpiry: s.uafeCertExpiry ? String(s.uafeCertExpiry).slice(0, 10) : '',
        declarationAccepted: true,
      }));
    }).catch(() => toast.error('No se pudo cargar el proveedor', 'Error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const set = <K extends keyof SupplierForm>(k: K, v: SupplierForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Validación por paso
  const validation = useMemo(() => {
    const errors: string[] = [];
    if (step === 0) {
      if (!form.personType) errors.push('Selecciona tipo de persona');
      if (!form.name.trim()) errors.push('Nombre requerido');
      if (form.personType === 'JURIDICA' && !form.razonSocial.trim()) errors.push('Razón social requerida');
      if (!form.documentType) errors.push('Selecciona tipo de documento');
      if (!form.ruc.trim()) errors.push('Número de documento requerido');
    }
    if (step === 1) {
      if (form.personType === 'NATURAL') {
        if (!form.birthDate) errors.push('Fecha de nacimiento requerida');
        if (!form.occupation.trim()) errors.push('Ocupación requerida');
      }
      if (form.personType === 'JURIDICA') {
        if (!form.legalRepName.trim()) errors.push('Nombre del representante legal requerido');
        if (!form.legalRepDocument.trim()) errors.push('Documento del representante legal requerido');
        if (form.beneficialOwners.length > 0) {
          const sum = form.beneficialOwners.reduce((s, b) => s + Number(b.percentage), 0);
          if (Math.abs(sum - 100) > 0.01) errors.push(`La suma de porcentajes de beneficiarios debe ser 100% (actual: ${sum}%)`);
          form.beneficialOwners.forEach((b, i) => {
            if (!b.name.trim()) errors.push(`Beneficiario #${i + 1}: nombre requerido`);
            if (!b.document.trim()) errors.push(`Beneficiario #${i + 1}: documento requerido`);
          });
        }
      }
    }
    if (step === 2) {
      if (form.isPEP && !form.pepPosition.trim()) errors.push('Cargo público requerido (PEP marcado)');
    }
    if (step === 3) {
      if (!form.declarationAccepted) errors.push('Debes aceptar la declaración');
    }
    return errors;
  }, [step, form]);

  const canAdvance = validation.length === 0;

  function addBeneficial() {
    set('beneficialOwners', [...form.beneficialOwners, { name: '', document: '', percentage: 0 }]);
  }
  function updateBeneficial(i: number, patch: Partial<BeneficialOwner>) {
    set('beneficialOwners', form.beneficialOwners.map((b, j) => j === i ? { ...b, ...patch } : b));
  }
  function removeBeneficial(i: number) {
    set('beneficialOwners', form.beneficialOwners.filter((_, j) => j !== i));
  }

  async function submit() {
    setSubmitting(true);
    const payload: any = {
      name: form.name.trim(),
      ruc: form.ruc.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      country: form.country.trim() || undefined,
      paymentTerms: form.paymentTerms || undefined,

      personType: form.personType || undefined,
      documentType: form.documentType || undefined,
      razonSocial: form.razonSocial.trim() || undefined,
      nombreComercial: form.nombreComercial.trim() || undefined,
      ciiuCode: form.ciiuCode || undefined,
      ciiuDescription: form.ciiuDescription || undefined,

      birthDate: form.birthDate || undefined,
      nationality: form.nationality || undefined,
      maritalStatus: form.maritalStatus || undefined,
      spouseName: form.spouseName.trim() || undefined,
      spouseDocument: form.spouseDocument.trim() || undefined,
      occupation: form.occupation.trim() || undefined,
      employerName: form.employerName.trim() || undefined,
      workplace: form.workplace.trim() || undefined,

      legalRepName: form.legalRepName.trim() || undefined,
      legalRepDocument: form.legalRepDocument.trim() || undefined,
      beneficialOwners: form.beneficialOwners.length ? form.beneficialOwners : undefined,

      annualIncome: form.annualIncome ? Number(form.annualIncome) : undefined,
      estimatedPatrimony: form.estimatedPatrimony ? Number(form.estimatedPatrimony) : undefined,

      isPEP: form.isPEP,
      pepPosition: form.isPEP ? form.pepPosition : undefined,
      pepRelationship: form.isPEP ? form.pepRelationship : undefined,

      contribuyenteEspecial: form.contribuyenteEspecial,
      obligadoContabilidad: form.obligadoContabilidad,

      // SERCOP — solo se envían si hay valores
      rupNumber: form.rupNumber.trim() || undefined,
      rupStatus: form.rupStatus || undefined,
      uafeCertExpiry: form.uafeCertExpiry || undefined,
    };
    try {
      if (isEdit) {
        await purchasesApi.updateSupplier(id!, payload);
        toast.success('Proveedor actualizado con cumplimiento UAFE', '✓ Éxito');
        navigate(`/purchases/suppliers/${id}`);
      } else {
        await purchasesApi.createSupplier(payload);
        toast.success('Proveedor creado con cumplimiento UAFE completo', '✓ Éxito');
        navigate('/purchases/suppliers');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo guardar el proveedor', 'Error');
      setSubmitting(false);
    }
  }

  const ciiuSuggestions = ciiuQuery ? searchCiiu(ciiuQuery) : CIIU_CODES.slice(0, 6);

  return (
    <WizardLayout
      title={isEdit ? 'Editar Proveedor — Conozca a su Proveedor (UAFE)' : 'Nuevo Proveedor — Conozca a su Proveedor (UAFE)'}
      subtitle="Formulario de debida diligencia conforme a la normativa UAFE Ecuador"
      icon={<Factory className="w-5 h-5" />}
      steps={STEPS}
      currentIndex={step}
      backFallback={isEdit ? `/purchases/suppliers/${id}` : '/purchases/suppliers'}
      onPrev={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
      onCancel={() => navigate(isEdit ? `/purchases/suppliers/${id}` : '/purchases/suppliers')}
      onFinish={submit}
      canNext={canAdvance}
      isLast={step === STEPS.length - 1}
      isSubmitting={submitting}
      finishLabel={isEdit ? 'Guardar Cambios' : 'Crear Proveedor'}
    >
      {/* Banner de validación */}
      {validation.length > 0 && (
        <div className="mb-5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400 mb-1">Faltan campos para avanzar:</p>
          <ul className="text-xs text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-0.5">
            {validation.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* PASO 1: Identificación */}
      {step === 0 && (
        <div className="space-y-5">
          <div>
            <label className={labelCls}>Tipo de persona *</label>
            <div className="grid grid-cols-2 gap-3">
              {(['NATURAL', 'JURIDICA'] as const).map((t) => (
                <button key={t} type="button" onClick={() => set('personType', t)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    form.personType === t
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                      : 'border-surface-200 dark:border-surface-700 hover:border-surface-400'
                  }`}>
                  <p className="font-semibold text-surface-900 dark:text-white">
                    {t === 'NATURAL' ? '👤 Persona Natural' : '🏢 Persona Jurídica'}
                  </p>
                  <p className="text-xs text-surface-500 mt-1">
                    {t === 'NATURAL' ? 'Individuo con RUC o cédula' : 'Empresa, sociedad o entidad legal'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Tipo de documento *</label>
              <select value={form.documentType} onChange={(e) => set('documentType', e.target.value as any)} className={inputCls}>
                <option value="">Selecciona</option>
                <option value="RUC">RUC</option>
                <option value="CEDULA">Cédula</option>
                <option value="PASAPORTE">Pasaporte</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Número de documento *</label>
              <input value={form.ruc} onChange={(e) => set('ruc', e.target.value)} className={inputCls} placeholder="1790012345001" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                {form.personType === 'JURIDICA' ? 'Nombre comercial' : 'Nombre completo *'}
              </label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls}
                placeholder={form.personType === 'JURIDICA' ? 'KallpaPro' : 'Juan Pérez'} />
            </div>
            {form.personType === 'JURIDICA' && (
              <div>
                <label className={labelCls}>Razón Social *</label>
                <input value={form.razonSocial} onChange={(e) => set('razonSocial', e.target.value)} className={inputCls}
                  placeholder="KALLPAPRO S.A." />
              </div>
            )}
          </div>

          {form.personType === 'JURIDICA' && (
            <div>
              <label className={labelCls}>Nombre comercial (opcional)</label>
              <input value={form.nombreComercial} onChange={(e) => set('nombreComercial', e.target.value)} className={inputCls} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} placeholder="contacto@empresa.com" />
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} placeholder="0999999999" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Dirección</label>
            <input value={form.address} onChange={(e) => set('address', e.target.value)} className={inputCls} placeholder="Av. Amazonas N12-345" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Ciudad</label>
              <input value={form.city} onChange={(e) => set('city', e.target.value)} className={inputCls} placeholder="Quito" />
            </div>
            <div>
              <label className={labelCls}>País</label>
              <input value={form.country} onChange={(e) => set('country', e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>
      )}

      {/* PASO 2: KYC condicional por tipo de persona */}
      {step === 1 && (
        <div className="space-y-5">
          {form.personType === 'NATURAL' && (
            <>
              <h3 className="font-semibold text-surface-800 dark:text-white">Datos personales</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Fecha de nacimiento *</label>
                  <input type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Nacionalidad</label>
                  <input value={form.nationality} onChange={(e) => set('nationality', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Estado civil</label>
                  <select value={form.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value as any)} className={inputCls}>
                    <option value="">Selecciona</option>
                    <option value="SOLTERO">Soltero/a</option>
                    <option value="CASADO">Casado/a</option>
                    <option value="DIVORCIADO">Divorciado/a</option>
                    <option value="VIUDO">Viudo/a</option>
                    <option value="UNION_LIBRE">Unión libre</option>
                  </select>
                </div>
              </div>

              {(form.maritalStatus === 'CASADO' || form.maritalStatus === 'UNION_LIBRE') && (
                <>
                  <h3 className="font-semibold text-surface-800 dark:text-white pt-3">Datos del cónyuge</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Nombre del cónyuge</label>
                      <input value={form.spouseName} onChange={(e) => set('spouseName', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Documento del cónyuge</label>
                      <input value={form.spouseDocument} onChange={(e) => set('spouseDocument', e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </>
              )}

              <h3 className="font-semibold text-surface-800 dark:text-white pt-3">Actividad económica</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Ocupación / Profesión *</label>
                  <input value={form.occupation} onChange={(e) => set('occupation', e.target.value)} className={inputCls} placeholder="Ingeniero" />
                </div>
                <div>
                  <label className={labelCls}>Empresa donde trabaja</label>
                  <input value={form.employerName} onChange={(e) => set('employerName', e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Lugar de trabajo</label>
                <input value={form.workplace} onChange={(e) => set('workplace', e.target.value)} className={inputCls} placeholder="Dirección del trabajo" />
              </div>
            </>
          )}

          {form.personType === 'JURIDICA' && (
            <>
              <h3 className="font-semibold text-surface-800 dark:text-white">Representante Legal</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Nombre del representante legal *</label>
                  <input value={form.legalRepName} onChange={(e) => set('legalRepName', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Cédula / RUC del representante *</label>
                  <input value={form.legalRepDocument} onChange={(e) => set('legalRepDocument', e.target.value)} className={inputCls} />
                </div>
              </div>

              <h3 className="font-semibold text-surface-800 dark:text-white pt-3 flex items-center justify-between">
                Beneficiarios finales (suma = 100%)
                <button type="button" onClick={addBeneficial}
                  className="text-xs px-3 py-1 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium">
                  + Agregar
                </button>
              </h3>
              <div className="space-y-2">
                {form.beneficialOwners.length === 0 && (
                  <p className="text-sm text-surface-400 italic">Sin beneficiarios registrados. Agrega al menos uno si aplica.</p>
                )}
                {form.beneficialOwners.map((b, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_180px_120px_40px] gap-2 items-end p-3 bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface-200 dark:border-surface-700">
                    <div>
                      <label className="text-xs text-surface-500">Nombre</label>
                      <input value={b.name} onChange={(e) => updateBeneficial(i, { name: e.target.value })} className={inputCls} placeholder="Nombre completo" />
                    </div>
                    <div>
                      <label className="text-xs text-surface-500">Documento</label>
                      <input value={b.document} onChange={(e) => updateBeneficial(i, { document: e.target.value })} className={inputCls} placeholder="Cédula/RUC" />
                    </div>
                    <div>
                      <label className="text-xs text-surface-500">%</label>
                      <input type="number" min={0} max={100} step={0.01} value={b.percentage}
                        onChange={(e) => updateBeneficial(i, { percentage: Number(e.target.value) })}
                        className={inputCls + ' text-right'} />
                    </div>
                    <button type="button" onClick={() => removeBeneficial(i)}
                      className="h-10 px-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">×</button>
                  </div>
                ))}
                {form.beneficialOwners.length > 0 && (
                  <p className="text-xs text-surface-500 text-right pt-2">
                    Suma actual: <span className={`font-mono font-semibold ${
                      Math.abs(form.beneficialOwners.reduce((s, b) => s + Number(b.percentage), 0) - 100) < 0.01
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {form.beneficialOwners.reduce((s, b) => s + Number(b.percentage), 0).toFixed(2)}%
                    </span> de 100%
                  </p>
                )}
              </div>

              <h3 className="font-semibold text-surface-800 dark:text-white pt-3">Actividad económica (CIIU)</h3>
              <div>
                <label className={labelCls}>Buscar código CIIU</label>
                <input value={ciiuQuery} onChange={(e) => setCiiuQuery(e.target.value)}
                  placeholder="Ej. comercio, restaurante, 4711..." className={inputCls} />
                <div className="mt-2 max-h-48 overflow-y-auto border border-surface-200 dark:border-surface-700 rounded-lg">
                  {ciiuSuggestions.map((c) => (
                    <button key={c.code} type="button"
                      onClick={() => { set('ciiuCode', c.code); set('ciiuDescription', c.description); setCiiuQuery(''); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-50 dark:hover:bg-brand-900/30 border-b border-surface-100 dark:border-surface-700 last:border-b-0 ${
                        form.ciiuCode === c.code ? 'bg-brand-100 dark:bg-brand-900/40' : ''
                      }`}>
                      <span className="font-mono font-semibold text-brand-600 dark:text-brand-400 mr-2">{c.code}</span>
                      <span className="text-surface-700 dark:text-surface-300">{c.description}</span>
                      <span className="text-xs text-surface-400 ml-2">({c.section})</span>
                    </button>
                  ))}
                </div>
                {form.ciiuCode && (
                  <p className="text-xs text-surface-500 mt-2">
                    Seleccionado: <span className="font-mono font-semibold">{form.ciiuCode}</span> — {form.ciiuDescription}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* PASO 3: Financiero + PEP */}
      {step === 2 && (
        <div className="space-y-5">
          <h3 className="font-semibold text-surface-800 dark:text-white">Información financiera</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Ingresos anuales estimados (USD)</label>
              <input type="number" min={0} step={0.01} value={form.annualIncome}
                onChange={(e) => set('annualIncome', e.target.value)} className={inputCls} placeholder="50000" />
            </div>
            <div>
              <label className={labelCls}>Patrimonio estimado (USD)</label>
              <input type="number" min={0} step={0.01} value={form.estimatedPatrimony}
                onChange={(e) => set('estimatedPatrimony', e.target.value)} className={inputCls} placeholder="200000" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Términos de pago</label>
            <select value={form.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} className={inputCls}>
              <option value="">Selecciona</option>
              <option value="CONTADO">Contado</option>
              <option value="15_DIAS">15 días</option>
              <option value="30_DIAS">30 días</option>
              <option value="60_DIAS">60 días</option>
              <option value="90_DIAS">90 días</option>
            </select>
          </div>

          <h3 className="font-semibold text-surface-800 dark:text-white pt-3">Régimen tributario SRI</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300 cursor-pointer">
              <input type="checkbox" checked={form.contribuyenteEspecial}
                onChange={(e) => set('contribuyenteEspecial', e.target.checked)} className="w-4 h-4 accent-brand-500" />
              <span>Contribuyente Especial</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300 cursor-pointer">
              <input type="checkbox" checked={form.obligadoContabilidad}
                onChange={(e) => set('obligadoContabilidad', e.target.checked)} className="w-4 h-4 accent-brand-500" />
              <span>Obligado a llevar contabilidad</span>
            </label>
          </div>

          <h3 className="font-semibold text-surface-800 dark:text-white pt-3">Declaración PEP (Persona Expuesta Políticamente)</h3>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
            <p className="text-xs text-yellow-800 dark:text-yellow-300 mb-3">
              Una <strong>Persona Expuesta Políticamente (PEP)</strong> es quien desempeña o ha desempeñado funciones públicas
              destacadas (ej. jefes de estado, ministros, jueces, militares de alto rango, dirigentes de partidos políticos).
              También incluye familiares y asociados cercanos.
            </p>
            <label className="flex items-center gap-2 text-sm font-medium text-surface-800 dark:text-white cursor-pointer">
              <input type="checkbox" checked={form.isPEP}
                onChange={(e) => set('isPEP', e.target.checked)} className="w-4 h-4 accent-brand-500" />
              <span>Declaro ser / estar relacionado con una Persona Expuesta Políticamente (PEP)</span>
            </label>
            {form.isPEP && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-yellow-300 dark:border-yellow-700">
                <div>
                  <label className={labelCls}>Cargo público desempeñado *</label>
                  <input value={form.pepPosition} onChange={(e) => set('pepPosition', e.target.value)} className={inputCls}
                    placeholder="Ministro, Concejal, Director..." />
                </div>
                <div>
                  <label className={labelCls}>Relación con el PEP</label>
                  <select value={form.pepRelationship} onChange={(e) => set('pepRelationship', e.target.value)} className={inputCls}>
                    <option value="">Selecciona</option>
                    <option value="TITULAR">Yo soy el PEP</option>
                    <option value="CONYUGE">Cónyuge</option>
                    <option value="FAMILIAR">Familiar</option>
                    <option value="ASOCIADO">Asociado cercano</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* SERCOP / RUP — solo visible si la empresa es entidad pública */}
          {isPublicEntity && (
            <div className="mt-4 border border-blue-200 dark:border-blue-700 rounded-xl overflow-hidden">
              <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 flex items-center gap-2">
                <span>🏛️</span>
                <h3 className="font-semibold text-sm text-blue-800 dark:text-blue-300">
                  Habilitación SERCOP / RUP
                </h3>
                <span className="ml-auto text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                  Entidad pública
                </span>
              </div>
              <div className="p-4 space-y-4">
                <p className="text-xs text-surface-500">
                  Para entidades sujetas a la LOSNCP, el proveedor debe estar registrado y habilitado en el
                  Registro Único de Proveedores (RUP) del SERCOP, y contar con Certificado de Cumplimiento UAFE vigente.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Número RUP</label>
                    <input
                      value={form.rupNumber}
                      onChange={(e) => set('rupNumber', e.target.value)}
                      className={inputCls}
                      placeholder="Ej: 1234567890001"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Estado RUP</label>
                    <select value={form.rupStatus} onChange={(e) => set('rupStatus', e.target.value as any)} className={inputCls}>
                      <option value="">Selecciona estado</option>
                      <option value="HABILITADO">HABILITADO</option>
                      <option value="SUSPENDIDO">SUSPENDIDO</option>
                      <option value="NO_REGISTRADO">NO REGISTRADO</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Vencimiento Certificado UAFE</label>
                    <input
                      type="date"
                      value={form.uafeCertExpiry}
                      onChange={(e) => set('uafeCertExpiry', e.target.value)}
                      className={inputCls}
                    />
                    {form.uafeCertExpiry && new Date(form.uafeCertExpiry) < new Date() && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        ⚠️ Certificado UAFE vencido — el proveedor no puede operar
                      </p>
                    )}
                    {form.uafeCertExpiry && (() => {
                      const days = Math.ceil((new Date(form.uafeCertExpiry).getTime() - Date.now()) / 86400000);
                      return days > 0 && days <= 30 ? (
                        <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                          ⚠️ Vence en {days} días — solicitar renovación
                        </p>
                      ) : null;
                    })()}
                  </div>
                  {form.rupStatus === 'SUSPENDIDO' && (
                    <div className="md:col-span-2">
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-xs text-red-700 dark:text-red-400">
                        ⛔ <strong>Proveedor SUSPENDIDO en RUP.</strong> No puede ser adjudicatario de contratos públicos bajo la LOSNCP.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PASO 4: Revisión */}
      {step === 3 && (
        <div className="space-y-5">
          <h3 className="font-semibold text-surface-800 dark:text-white">Revisa los datos antes de crear el proveedor</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReviewCard title="Identificación" rows={[
              ['Tipo', form.personType],
              ['Documento', `${form.documentType} ${form.ruc}`],
              ['Nombre', form.name],
              ['Razón social', form.razonSocial || '—'],
              ['Email', form.email || '—'],
              ['Teléfono', form.phone || '—'],
              ['Dirección', `${form.address || '—'}, ${form.city || ''}, ${form.country}`],
            ]} />
            <ReviewCard title="KYC" rows={form.personType === 'NATURAL' ? [
              ['Fecha nacimiento', form.birthDate || '—'],
              ['Nacionalidad', form.nationality || '—'],
              ['Estado civil', form.maritalStatus || '—'],
              ['Ocupación', form.occupation || '—'],
              ['Empresa', form.employerName || '—'],
            ] : [
              ['Representante legal', form.legalRepName || '—'],
              ['Doc. representante', form.legalRepDocument || '—'],
              ['Beneficiarios', `${form.beneficialOwners.length} registrados`],
              ['CIIU', form.ciiuCode ? `${form.ciiuCode} — ${form.ciiuDescription}` : '—'],
            ]} />
            <ReviewCard title="Financiero" rows={[
              ['Ingresos anuales', form.annualIncome ? `$${Number(form.annualIncome).toLocaleString('es')}` : '—'],
              ['Patrimonio', form.estimatedPatrimony ? `$${Number(form.estimatedPatrimony).toLocaleString('es')}` : '—'],
              ['Términos de pago', form.paymentTerms || '—'],
              ['Contribuyente especial', form.contribuyenteEspecial ? 'Sí' : 'No'],
              ['Obligado a contabilidad', form.obligadoContabilidad ? 'Sí' : 'No'],
            ]} />
            <ReviewCard title="PEP" rows={[
              ['Es PEP', form.isPEP ? 'Sí' : 'No'],
              ['Cargo', form.isPEP ? form.pepPosition : '—'],
              ['Relación', form.isPEP ? form.pepRelationship : '—'],
            ]} />
          </div>

          <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl p-5">
            <label className="flex items-start gap-3 text-sm text-surface-800 dark:text-surface-200 cursor-pointer">
              <input type="checkbox" checked={form.declarationAccepted}
                onChange={(e) => set('declarationAccepted', e.target.checked)}
                className="w-5 h-5 accent-brand-500 mt-0.5" />
              <span>
                <strong>Declaración:</strong> Declaro bajo juramento que la información proporcionada es verídica y autorizo
                a KallpaPro a verificar los datos consignados conforme a la normativa de la UAFE y la Ley Orgánica
                de Prevención, Detección y Erradicación del Lavado de Activos y Financiamiento de Delitos.
              </span>
            </label>
          </div>
        </div>
      )}
    </WizardLayout>
  );
}

function ReviewCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="bg-surface-50 dark:bg-surface-900/50 border border-surface-200 dark:border-surface-700 rounded-xl p-4">
      <h4 className="font-semibold text-sm text-surface-700 dark:text-surface-300 mb-2 uppercase tracking-wider">{title}</h4>
      <dl className="space-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt className="text-surface-500">{k}</dt>
            <dd className="text-surface-800 dark:text-white text-right truncate max-w-[60%]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
