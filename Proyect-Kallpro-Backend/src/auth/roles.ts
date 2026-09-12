// ============================================================
// Taxonomía de roles KallpaPro (PYME) — fuente de verdad
// ============================================================

export type Action =
  | 'manage'    // todo
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'approve'   // aprobar requisiciones / OC / ventas
  | 'receive'   // recibir mercadería
  | 'pay'       // pagos / anticipos
  | 'post'      // contabilizar asientos
  | 'configure'; // ajustes / mapeos / matriz

export type Subject =
  | 'Inventory' | 'StorageLocation' | 'Production'
  | 'Purchase' | 'Requisition' | 'Supplier'
  | 'Accounting' | 'Journal' | 'Finance' | 'Budget' | 'Payment'
  | 'Customer' | 'Sales' | 'CRM' | 'Logistics'
  | 'Report' | 'User' | 'CompanySettings' | 'ApprovalMatrix'
  | 'HR'
  | 'all';

export interface RoleMeta {
  key: string;
  label: string;
  group: 'Dirección' | 'Compras' | 'Bodega' | 'Contabilidad' | 'Tesorería' | 'Ventas' | 'Análisis' | 'General';
  description: string;
}

// Metadatos de roles (para UI de asignación)
export const ROLE_CATALOG: RoleMeta[] = [
  { key: 'ADMIN',             label: 'Administrador',       group: 'Dirección',    description: 'Acceso total al sistema' },
  { key: 'GERENTE',           label: 'Gerente General',     group: 'Dirección',    description: 'Aprobaciones de alto monto, vistas gerenciales y de control; lectura total' },
  { key: 'JEFE_COMPRAS',      label: 'Jefe de Compras',     group: 'Compras',      description: 'Gestiona requisiciones, cotizaciones, OC y proveedores; aprueba compras' },
  { key: 'ASISTENTE_COMPRAS', label: 'Asistente de Compras',group: 'Compras',      description: 'Crea requisiciones, cotizaciones y OC; sin aprobar ni pagar' },
  { key: 'JEFE_BODEGA',       label: 'Jefe de Bodega',      group: 'Bodega',       description: 'Gestiona inventario, ubicaciones, producción y recepción' },
  { key: 'ASISTENTE_BODEGA',  label: 'Asistente de Bodega', group: 'Bodega',       description: 'Movimientos, recepción y conteo físico' },
  { key: 'BODEGUERO',         label: 'Bodeguero',           group: 'Bodega',       description: 'Recepción de mercadería y conteo físico' },
  { key: 'CONTADOR',          label: 'Contador',            group: 'Contabilidad', description: 'Contabilidad, asientos, impuestos, AP/AR y reportes financieros' },
  { key: 'ASISTENTE_CONTABLE',label: 'Asistente Contable',  group: 'Contabilidad', description: 'Captura documentos y asientos borrador; lectura de finanzas' },
  { key: 'TESORERIA',         label: 'Tesorería',           group: 'Tesorería',    description: 'Pagos, anticipos y bancos; lectura de contabilidad' },
  { key: 'ANALISTA',          label: 'Analista Financiero', group: 'Análisis',     description: 'Lectura y análisis de finanzas, contabilidad y reportes; sin escritura' },
  { key: 'TRIBUTARIO',        label: 'Especialista Tributario', group: 'Contabilidad', description: 'Gestiona catálogos de impuestos y retenciones; formularios SRI y lectura contable' },
  { key: 'AUDITOR',           label: 'Auditor',             group: 'Análisis',     description: 'Solo lectura de TODO el sistema + descarga de reportes (diario, mayor, balanza, estados, SRI)' },
  { key: 'ASISTENTE',         label: 'Asistente General',   group: 'General',      description: 'Captura básica (requisiciones, documentos) y lectura amplia' },
  { key: 'GERENTE_VENTAS',    label: 'Gerente de Ventas',   group: 'Ventas',       description: 'Gestiona ventas y clientes; aprueba pedidos' },
  { key: 'SUPERVISOR_VENTAS', label: 'Supervisor de Ventas',group: 'Ventas',       description: 'Crea y edita ventas y clientes' },
  { key: 'FUERZA_VENTAS',     label: 'Fuerza de Ventas',    group: 'Ventas',       description: 'Crea cotizaciones y clientes; consulta stock' },
  { key: 'USER',              label: 'Usuario',             group: 'General',      description: 'Acceso mínimo (solo panel)' },
  { key: 'TTHH',              label: 'Talento Humano',      group: 'General',      description: 'Gestiona el calendario de turnos, biométrico y aprueba solicitudes de permiso de toda la empresa' },
];

export const ROLE_KEYS = ROLE_CATALOG.map((r) => r.key);

// Roles que pueden APROBAR un ajuste de inventario (la "segunda firma":
// responsable de finanzas o gerencia). El aprobador debe ser distinto del solicitante.
export const INVENTORY_ADJUSTMENT_APPROVERS = ['ADMIN', 'GERENTE', 'CONTADOR'] as const;

type Rule = [Action | Action[], Subject | Subject[]];

// Catálogo canónico de permisos por rol. ADMIN se maneja aparte (manage all).
export const ROLE_RULES: Record<string, Rule[]> = {
  ADMIN: [['manage', 'all']],

  GERENTE: [
    ['read', 'all'],
    ['approve', ['Requisition', 'Purchase', 'Sales', 'Inventory']],
    ['configure', ['CompanySettings', 'ApprovalMatrix', 'Budget']],
    ['pay', 'Payment'], // ejecuta pagos/cobros de nivel gerencial en la mesa de trabajo CxP/CxC (Fase 4)
  ],

  JEFE_COMPRAS: [
    [['create', 'read', 'update'], ['Requisition', 'Purchase', 'Supplier']],
    ['approve', ['Requisition', 'Purchase']],
    [['create', 'read'], 'Logistics'],
    ['read', ['Inventory', 'Report', 'StorageLocation']],
  ],
  ASISTENTE_COMPRAS: [
    [['create', 'read'], ['Requisition', 'Purchase', 'Supplier']],
    ['read', ['Inventory', 'Report', 'Logistics']],
  ],

  JEFE_BODEGA: [
    ['manage', ['Inventory', 'StorageLocation', 'Production', 'Logistics']],
    ['receive', 'Purchase'],
    ['read', ['Purchase', 'Requisition', 'Report']],
  ],
  ASISTENTE_BODEGA: [
    [['create', 'read', 'update'], ['Inventory', 'Logistics']],
    ['receive', 'Purchase'],
    ['read', ['StorageLocation', 'Production', 'Purchase']],
  ],
  BODEGUERO: [
    [['create', 'read'], 'Inventory'],
    [['create', 'read', 'update'], 'Logistics'],
    ['receive', 'Purchase'],
    ['read', ['StorageLocation', 'Purchase']],
  ],

  CONTADOR: [
    ['manage', ['Accounting', 'Journal', 'Finance', 'Budget']],
    ['post', 'Journal'],
    [['read', 'pay'], 'Payment'],
    ['read', ['Inventory', 'Purchase', 'Sales', 'Report', 'Supplier', 'Customer']],
    ['approve', 'Inventory'], // segunda firma de ajustes de inventario (impacto contable)
    ['configure', 'Accounting'],
  ],
  ASISTENTE_CONTABLE: [
    ['read', ['Accounting', 'Finance', 'Report']],
    [['create', 'read', 'update'], 'Journal'], // captura, sin contabilizar (post) ni borrar
    // Captura facturas de compra (SriDocument, subject 'Purchase'): sube/ingresa manual y puede
    // corregir/rechazar, pero NO confirma (eso postea el asiento — gate aparte 'post':'Journal',
    // que este rol no tiene) ni paga (gate aparte 'pay':'Purchase', reservado a Tesorería).
    [['create', 'update'], 'Purchase'],
    ['read', ['Purchase', 'Sales', 'Inventory']],
    ['pay', 'Payment'], // ejecuta pagos/cobros de nivel AUTO en la mesa de trabajo CxP/CxC (Fase 4, tope bajo)
  ],

  TESORERIA: [
    ['manage', 'Payment'],
    ['pay', 'Purchase'],
    ['read', ['Accounting', 'Finance', 'Purchase', 'Report']],
  ],

  ANALISTA: [
    ['read', ['Accounting', 'Finance', 'Budget', 'Report', 'Inventory', 'Purchase', 'Sales']],
  ],

  TRIBUTARIO: [
    // Administra catálogos de IVA/retenciones y formularios SRI; lee contabilidad y finanzas.
    [['create', 'read', 'update'], 'Accounting'],
    ['read', ['Journal', 'Finance', 'Report', 'Purchase', 'Sales']],
  ],

  AUDITOR: [
    // Solo lectura de todo (los exports CSV/PDF son GET → cubiertos por read).
    ['read', 'all'],
  ],

  ASISTENTE: [
    [['create', 'read'], 'Requisition'],
    [['create', 'read'], ['Supplier', 'Customer']],
    ['read', ['Inventory', 'Purchase', 'Sales', 'Report']],
  ],

  GERENTE_VENTAS: [
    ['manage', ['Sales', 'Customer']],
    ['approve', 'Sales'],
    [['create', 'read'], 'Logistics'],
    ['read', ['Report', 'Inventory', 'CRM']],
  ],
  SUPERVISOR_VENTAS: [
    [['create', 'read', 'update'], ['Sales', 'Customer']],
    [['create', 'read'], 'Logistics'],
    ['read', ['Report', 'Inventory', 'CRM']],
  ],
  FUERZA_VENTAS: [
    [['create', 'read'], ['Sales', 'Customer']],
    ['read', ['Inventory', 'CRM', 'Logistics']],
  ],

  USER: [
    ['read', 'Report'],
  ],

  TTHH: [
    ['manage', 'HR'],
  ],
};
