/**
 * KallpaPro — Mapa de Permisos por Rol
 *
 * 12 roles: ADMIN, GERENTE, GERENTE_VENTAS, SUPERVISOR_VENTAS, FUERZA_VENTAS,
 *           JEFE_BODEGA, ASISTENTE_BODEGA, BODEGUERO,
 *           CONTADOR, ASISTENTE_CONTABLE, JEFE_COMPRAS, ASISTENTE_COMPRAS
 */

export type AppRole =
  | 'ADMIN'
  | 'GERENTE'
  | 'GERENTE_VENTAS'
  | 'SUPERVISOR_VENTAS'
  | 'FUERZA_VENTAS'
  | 'JEFE_BODEGA'
  | 'ASISTENTE_BODEGA'
  | 'BODEGUERO'
  | 'CONTADOR'
  | 'ASISTENTE_CONTABLE'
  | 'TRIBUTARIO'
  | 'AUDITOR'
  | 'TESORERIA'
  | 'ANALISTA'
  | 'JEFE_COMPRAS'
  | 'ASISTENTE_COMPRAS'
  | 'USER';

/** Etiquetas legibles de los roles (para selectores de configuración). */
export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: 'Administrador',
  GERENTE: 'Gerente General',
  GERENTE_VENTAS: 'Gerente de Ventas',
  SUPERVISOR_VENTAS: 'Supervisor Ventas',
  FUERZA_VENTAS: 'Fuerza de Ventas',
  JEFE_BODEGA: 'Jefe de Bodega',
  ASISTENTE_BODEGA: 'Asistente Bodega',
  BODEGUERO: 'Bodeguero',
  CONTADOR: 'Contador',
  ASISTENTE_CONTABLE: 'Asistente Contable',
  TRIBUTARIO: 'Especialista Tributario',
  AUDITOR: 'Auditor',
  TESORERIA: 'Tesorería',
  ANALISTA: 'Analista Financiero',
  JEFE_COMPRAS: 'Jefe de Compras',
  ASISTENTE_COMPRAS: 'Asistente Compras',
  USER: 'Usuario',
};

export const PERMISSIONS: Record<string, Record<string, AppRole[]>> = {
  inventory: {
    view:          ['ADMIN', 'GERENTE', 'JEFE_BODEGA', 'ASISTENTE_BODEGA', 'BODEGUERO', 'JEFE_COMPRAS'],
    edit:          ['ADMIN', 'JEFE_BODEGA'],
    categories:    ['ADMIN', 'JEFE_BODEGA'],
    reclassify:    ['ADMIN', 'JEFE_BODEGA'],
    movements:     ['ADMIN', 'JEFE_BODEGA', 'ASISTENTE_BODEGA', 'BODEGUERO'],
    transfer:      ['ADMIN', 'JEFE_BODEGA', 'ASISTENTE_BODEGA'],
    physicalCount: ['ADMIN', 'JEFE_BODEGA', 'ASISTENTE_BODEGA', 'BODEGUERO'],
  },
  purchases: {
    view:      ['ADMIN', 'GERENTE', 'JEFE_COMPRAS', 'ASISTENTE_COMPRAS', 'JEFE_BODEGA'],
    createReq: ['ADMIN', 'JEFE_COMPRAS', 'ASISTENTE_COMPRAS'],
    approveReq:['ADMIN', 'GERENTE', 'JEFE_COMPRAS'],
    createPO:  ['ADMIN', 'JEFE_COMPRAS'],
    receive:   ['ADMIN', 'JEFE_BODEGA', 'ASISTENTE_BODEGA'],
    suppliers: ['ADMIN', 'JEFE_COMPRAS', 'ASISTENTE_COMPRAS'],
  },
  sales: {
    view:     ['ADMIN', 'GERENTE', 'GERENTE_VENTAS', 'SUPERVISOR_VENTAS', 'FUERZA_VENTAS'],
    create:   ['ADMIN', 'GERENTE_VENTAS', 'SUPERVISOR_VENTAS', 'FUERZA_VENTAS'],
    approve:  ['ADMIN', 'GERENTE', 'GERENTE_VENTAS'],
    customers:['ADMIN', 'GERENTE_VENTAS', 'SUPERVISOR_VENTAS', 'FUERZA_VENTAS'],
    reports:  ['ADMIN', 'GERENTE', 'GERENTE_VENTAS'],
  },
  financial: {
    view:    ['ADMIN', 'GERENTE', 'CONTADOR', 'ASISTENTE_CONTABLE', 'TRIBUTARIO', 'AUDITOR', 'ANALISTA', 'TESORERIA'],
    invoices:['ADMIN', 'CONTADOR', 'ASISTENTE_CONTABLE'],
    gl:      ['ADMIN', 'CONTADOR'],
    sri:     ['ADMIN', 'CONTADOR', 'ASISTENTE_CONTABLE', 'TRIBUTARIO'],
  },
  // Contabilidad por perfil (Sprint 6): qué pestañas ve cada rol en ContabilidadPage
  accounting: {
    view:       ['ADMIN', 'GERENTE', 'CONTADOR', 'ASISTENTE_CONTABLE', 'TRIBUTARIO', 'AUDITOR', 'ANALISTA', 'TESORERIA'], // resumen, mayor, comprobación, flujo, plan
    postManual: ['ADMIN', 'CONTADOR', 'ASISTENTE_CONTABLE'],   // capturar asientos manuales
    approveGerencial: ['ADMIN', 'GERENTE'],                    // ejecutar pagos/cobros de nivel gerencial en CxP/CxC (Fase 4) — no incluye asientos manuales
    reverse:    ['ADMIN', 'CONTADOR'],                         // reversar asientos
    close:      ['ADMIN', 'CONTADOR'],                         // cerrar / reabrir períodos
    taxes:      ['ADMIN', 'CONTADOR', 'TRIBUTARIO'],           // catálogos IVA/retenciones y formularios SRI
    export:     ['ADMIN', 'GERENTE', 'CONTADOR', 'ASISTENTE_CONTABLE', 'TRIBUTARIO', 'AUDITOR', 'ANALISTA'], // descargas CSV
    configure:  ['ADMIN', 'CONTADOR'],                         // mapeo de cuentas / seed
  },
  production: {
    view:   ['ADMIN', 'GERENTE', 'JEFE_BODEGA', 'ASISTENTE_BODEGA'],
    manage: ['ADMIN', 'JEFE_BODEGA'],
    execute:['ADMIN', 'JEFE_BODEGA', 'ASISTENTE_BODEGA'],
  },
  reports: {
    basic:  ['ADMIN', 'GERENTE', 'JEFE_COMPRAS', 'JEFE_BODEGA', 'CONTADOR', 'GERENTE_VENTAS'],
    full:   ['ADMIN', 'GERENTE', 'CONTADOR'],
    export: ['ADMIN', 'GERENTE', 'CONTADOR', 'GERENTE_VENTAS', 'JEFE_COMPRAS'],
  },
  admin: {
    users:  ['ADMIN'],
    roles:  ['ADMIN'],
    system: ['ADMIN'],
  },
};

/** Verifica si un rol tiene permiso para un módulo + acción */
export function checkPermission(role: string, module: string, action: string): boolean {
  const allowed = PERMISSIONS[module]?.[action];
  if (!allowed) return false;
  return allowed.includes(role as AppRole);
}
