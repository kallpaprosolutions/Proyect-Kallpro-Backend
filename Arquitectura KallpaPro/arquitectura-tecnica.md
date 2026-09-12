# Arquitectura Técnica — KallpaPro ERP

> 📍 Documento VIVO de **arquitectura técnica** (stack, capas, convenciones). No confundir
> con [[flujo-trabajo-erp|el router de módulos de NEGOCIO]] — este documento es sobre CÓMO
> está construido el código, no sobre QUÉ hace cada módulo funcional.
> Actualízalo cuando cambie un patrón estructural (no cuando se agregue una feature dentro
> de un patrón ya existente — eso va en el archivo del módulo en `Modulos/`).
> Última actualización: 2026-09-05.

## 1. Monorepo — dos proyectos independientes
```
Proyect-Kallpro/
├── Proyect-Kallpro-Backend/   Express + TypeScript + Prisma + PostgreSQL (puerto 5001)
└── Proyect-Kallpro-Frontend/  React 18 + Vite + Tailwind + Zustand (puerto 3001)
```
Accesos y variables reales: [[../Credenciales/00-ACCESOS-Y-ENTORNO|Credenciales/00-ACCESOS-Y-ENTORNO.md]].

## 2. Backend — capas (`src/`)
```
routes/        27 archivos — define endpoints, aplica middleware (auth, validate)
controllers/   55 archivos — delgados, usan asyncHandler, delegan a services
services/      108 archivos — TODA la lógica de negocio y acceso a Prisma vive aquí
middleware/    8 archivos  — auth (JWT), RBAC (CASL), validate (Zod), errorHandler
auth/          roles.ts (19 roles), permisos CASL
schemas/       Zod — validación de entrada por endpoint
validators/    reglas de negocio reutilizables
data/          catálogos estáticos (bancos Ecuador, cuentas SRI, etc.)
jobs/ queue/   tareas asíncronas/programadas
lib/ utils/    helpers transversales (fechas, numeración de documentos, etc.)
```
**Flujo de una request**: `route` → middleware (`authenticate` → `authorize(subject, action)`
→ `validateSchema`) → `controller` (asyncHandler, delgado) → `service` (lógica + Prisma) →
si genera hecho económico → `journal.service` (asiento automático, regla transversal 2).

**Motores puros** (sin BD, con tests unitarios — regla transversal 6): viven dentro de cada
`service` o en archivos `*.engine.ts` dedicados (ej. `payment-priority.engine.ts`,
`lead-scoring.engine.ts`, `sri-manual-entry.engine.ts`). Se testean con Jest sin mockear BD.

## 3. Frontend — capas (`src/`)
```
api/          wrapper de axios por dominio (1 archivo por recurso del backend)
store/        Zustand — estado global (auth, empresa activa, etc.)
pages/        1 página por ruta, monta componentes + llama a api/
components/   UI reutilizable (design system brand-*/surface-*, dark mode)
schemas/      Zod — validación de formularios (espejo de los schemas del backend)
hooks/        lógica reutilizable de React (useDebounce, useAuth, etc.)
machines/     máquinas de estado explícitas donde el flujo lo amerita (ej. leave.service)
lib/          helpers (formateo, routeLabels.ts para breadcrumbs)
```
**Flujo de una feature**: `api/recurso.ts` (wrapper) → componente/página consume el wrapper
→ se monta en la ruta correspondiente → test con Vitest + RTL.

## 4. Base de datos (PostgreSQL 15 · Prisma)
- **Multi-tenant real**: toda tabla de negocio lleva `companyId` con cascade delete desde
  `Company`; toda query de servicio filtra por él (regla transversal 1).
- **Numeración de documentos por empresa** vía `getNextDocumentNumber` — nunca `count()+1`
  (evita colisiones entre empresas y con transacciones concurrentes).
- **Trazabilidad por ids**: `entityType/entityId`, `sourceType/sourceId`, `journalEntryId`,
  `batchId` enlazan documento origen ↔ asiento ↔ movimiento (regla transversal 4).
- Migraciones en `Proyect-Kallpro-Backend/prisma/migrations/` — **detener el backend antes
  de migrar** (nodemon bloquea `query_engine-windows.dll.node` en Windows, EPERM).
- Semillas en `prisma/seeds/`.

## 5. Autenticación y permisos (RBAC)
- JWT (access 2h / refresh 7d) + `PORTAL_JWT_SECRET` separado para el portal de proveedores.
- **19 roles** en `src/auth/roles.ts`: ADMIN, GERENTE, JEFE_COMPRAS, ASISTENTE_COMPRAS,
  JEFE_BODEGA, ASISTENTE_BODEGA, BODEGUERO, CONTADOR, ASISTENTE_CONTABLE, TESORERIA,
  ANALISTA, TRIBUTARIO, AUDITOR, ASISTENTE, GERENTE_VENTAS, SUPERVISOR_VENTAS,
  FUERZA_VENTAS, USER, TTHH.
- Permisos con **CASL** (`@casl/ability`): `subject` + `action` por rol, chequeado en
  middleware `authorize()` antes del controller.
- ✅ Cerrado 2026-09-05: `financial.routes.ts` completo (CxP/CxC, facturas de venta,
  asientos manuales/reversa/post, impuestos, DCF, escenarios, cobranza) ya tiene
  `authorize()` server-side en todas sus rutas mutantes — no asumir que el front oculta
  el botón basta; verificado con AUDITOR bloqueado (403 real) y CONTADOR pasando el gate
  en `journal-entries`, `invoices` y `seed-accounts`. Ver
  [[Modulos/08-analisis-financiero-cxp-cxc]] y [[Modulos/06-contabilidad]].

## 6. Convenciones (detalle en `CLAUDE.md §8`)
- Comentarios en español explicando el **porqué** (regla de negocio/norma), no el qué.
- Errores: `AppError.badRequest(mensaje, 'CODIGO')`, mensaje en español apto para el usuario.
- Cuentas contables SIEMPRE por `AccountMapping` (posting setup), nunca códigos quemados.
- UI en español, sin enums crudos, breadcrumbs centralizados en `routeLabels.ts`.
- Numeración de documentos: ver prefijos en `CLAUDE.md §8` (OC-, REQ-, PV-, FAC-V-, NC-,
  AST-, PAG-, KP-, PROD-, INS-, RNC-, LOTE-AAAAMMDD-####).

## 7. Librerías clave ya instaladas (no reinstalar equivalentes)
`cmdk` (búsqueda Ctrl+K) · `@dnd-kit/*` (drag&drop, kanban) · `recharts` (gráficos) ·
`@tanstack/react-table` (tablas/pivot) · `zustand` (estado) · `@casl/ability` (permisos) ·
`react-big-calendar` + `date-fns` (calendario TTHH). Design system Tailwind propio — no
adoptar frameworks de UI completos (MUI/Ant).

## Ver también
- [[flujo-trabajo-erp|Router de módulos de negocio]] (el QUÉ, no el CÓMO)
- [[protocolo-documentacion|Protocolo de documentación]] (cuándo actualizar cada doc)
- `Documentacion de la Arquitectura Paso a Paso/01-ARQUITECTURA-GENERAL.md` (versión histórica congelada, Sprint 1)
