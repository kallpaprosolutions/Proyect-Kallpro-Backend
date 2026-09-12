import { prisma } from '../lib/prisma';
import { DEFAULT_DUNNING_STEPS } from './finance/engines/dunning.engine';
/**
 * Configuración general del ERP (persistida en Company.settings como JSON).
 * Se administra desde Configuración → Empresa. Aquí viven los valores por defecto
 * y el merge con lo que el administrador haya guardado.
 */

export interface ErpConfig {
  purchases: {
    minQuotations: number;   // mínimo de cotizaciones para elegir ganador / generar OC
  };
  documents: {
    reqPrefix: string;       // prefijo de requisiciones (REQ-)
    poPrefix: string;        // prefijo de órdenes de compra (OC-)
    adjPrefix: string;       // prefijo de ajustes de inventario (AJU-)
  };
  inventory: {
    requireAdjustmentApproval: boolean; // doble autorización de ajustes (bodeguero + finanzas)
    enableCameraScanner: boolean;       // escáner de códigos con cámara (off por defecto: puede retener la webcam a nivel de SO)
  };
  sales: {
    enforceCreditLimit: boolean;   // bloquear confirmación de pedido si excede el límite de crédito
    allowPartialDispatch: boolean; // permitir despachar un pedido en varios envíos (parcial)
    // Tope de descuento por rol (porcentaje 0-100). El precio sale de la lista vigente
    // y el vendedor solo aplica descuento hasta su tope. Roles no listados → 0%.
    maxDiscountByRole: Record<string, number>;
    // Roles que pueden aprobar una cotización PENDING_APPROVAL (descuento fuera de tope o
    // venta bajo costo). Antes esto era un bloqueo duro (error 400, sin forma de continuar);
    // ahora se enruta a estos roles en vez de impedir guardar la cotización.
    discountApproverRoles: string[];
  };
  security: {
    sessionTimeoutMinutes: number; // timeout por inactividad de sesión
    require2FAForRoles: string[];   // roles obligados a tener 2FA activo
  };
  finance: {
    // Aprobaciones por monto para pagar/cobrar/ajustar en CxP y CxC (roadmap Asistente
    // Contable, Fase 4). Por debajo de `paymentResponsableLimit` cualquiera con permiso de
    // pagos ejecuta (AUTO); entre los dos límites hace falta Contador/Admin (RESPONSABLE);
    // desde `paymentGerencialLimit` hace falta Gerente/Admin (GERENCIAL).
    paymentResponsableLimit: number;
    paymentGerencialLimit: number;
    // Cobranza automática (dunning): escalones por días de mora → recordatorio EMAIL /
    // WHATSAPP / CALL creado como gestión automática en el radar de cobranza (y enviado por
    // email si hay SendGrid configurado). Una promesa de pago vigente pausa los recordatorios.
    dunning: {
      enabled: boolean;
      pauseWhenPromise: boolean;
      steps: Array<{ daysOverdue: number; type: 'EMAIL' | 'WHATSAPP' | 'CALL'; message: string }>;
    };
  };
  logistics: {
    // Token secreto que los couriers (Servientrega/Tramaco/DHL/Urbano…) envían en el header
    // X-Webhook-Token para POST /api/logistics/webhooks/:companyId/:carrier. Vacío = webhooks
    // deshabilitados. Se genera/rota desde Ajustes → Logística.
    webhookToken: string;
  };
  regional: {
    currencyCode: string;
    currencySymbol: string;
  };
  company: {
    ruc: string;
    address: string;
    city: string;
    website: string;
  };
}

export const ERP_CONFIG_DEFAULTS: ErpConfig = {
  purchases: { minQuotations: 3 },
  documents: { reqPrefix: 'REQ-', poPrefix: 'OC-', adjPrefix: 'AJU-' },
  inventory: { requireAdjustmentApproval: true, enableCameraScanner: false },
  sales: {
    enforceCreditLimit: true,
    allowPartialDispatch: false,
    // Claves = roles reales de la app (lib/permissions del front / auth/roles del back).
    // Se conservan las claves antiguas (SALES_MANAGER/SUPERVISOR) por compatibilidad con
    // configs guardadas antes del Sprint 2.1.
    maxDiscountByRole: {
      ADMIN: 100,
      GERENTE: 100,
      GERENTE_VENTAS: 20,
      SUPERVISOR_VENTAS: 20,
      FUERZA_VENTAS: 5,
      SALES_MANAGER: 20,
      SUPERVISOR: 20,
      USER: 5,
    },
    discountApproverRoles: ['ADMIN', 'GERENTE', 'GERENTE_VENTAS'],
  },
  security: { sessionTimeoutMinutes: 30, require2FAForRoles: [] },
  finance: {
    paymentResponsableLimit: 500,
    paymentGerencialLimit: 5000,
    dunning: { enabled: false, pauseWhenPromise: true, steps: DEFAULT_DUNNING_STEPS },
  },
  logistics: { webhookToken: '' },
  regional: { currencyCode: 'USD', currencySymbol: '$' },
  company: { ruc: '', address: '', city: '', website: '' },
};

/**
 * Valida que la config efectiva tenga TODAS las claves esperadas (comparando contra
 * ERP_CONFIG_DEFAULTS, recursivamente por sección). Lanza si falta alguna → evita que el
 * sistema tome `undefined` silenciosamente cuando alguien borró una clave del JSON guardado.
 * (Mejora DeepSeek #4.)
 */
export function validateConfig(config: any): asserts config is ErpConfig {
  const missing: string[] = [];
  for (const section of Object.keys(ERP_CONFIG_DEFAULTS) as (keyof ErpConfig)[]) {
    if (config[section] == null || typeof config[section] !== 'object') {
      missing.push(section);
      continue;
    }
    for (const key of Object.keys(ERP_CONFIG_DEFAULTS[section])) {
      if (config[section][key] === undefined) missing.push(`${section}.${key}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`ERP_CONFIG_INVALID: faltan claves de configuración → ${missing.join(', ')}`);
  }
}

/** Merge superficial por sección (defaults <- guardado). */
export function mergeConfig(stored: any): ErpConfig {
  const s = (stored && typeof stored === 'object') ? stored : {};
  const out: any = {};
  for (const key of Object.keys(ERP_CONFIG_DEFAULTS) as (keyof ErpConfig)[]) {
    out[key] = { ...ERP_CONFIG_DEFAULTS[key], ...(s[key] && typeof s[key] === 'object' ? s[key] : {}) };
  }
  return out as ErpConfig;
}

// Caché en memoria por empresa con TTL (DeepSeek #17). getErpConfig se llama en cada
// validación de descuento / cálculo de retención / middleware → evita golpear la BD.
const CONFIG_TTL_MS = 5 * 60 * 1000;
const configCache = new Map<string, { config: ErpConfig; ts: number }>();

/** Invalidar el caché de una empresa (llamar tras actualizar Company.settings). */
export function invalidateErpConfig(companyId: string): void {
  configCache.delete(companyId);
}

/** Configuración efectiva de una empresa (defaults + guardado). Cacheada con TTL de 5 min. */
export async function getErpConfig(companyId: string): Promise<ErpConfig> {
  const cached = configCache.get(companyId);
  if (cached && Date.now() - cached.ts < CONFIG_TTL_MS) return cached.config;

  const company = await prisma.company.findFirst({ where: { id: companyId }, select: { settings: true } });
  const config = mergeConfig(company?.settings);
  validateConfig(config); // red de seguridad: falla explícito si el merge dejó huecos
  configCache.set(companyId, { config, ts: Date.now() });
  return config;
}
