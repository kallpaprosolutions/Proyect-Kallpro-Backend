# KallpaPro ERP — Instrucciones del proyecto

> Este archivo se carga automáticamente en cada sesión. **Léelo completo antes de tocar código.**
> Última actualización: 2026-09-10.

## 1. Qué es esto

ERP multi-empresa para PYMEs de Ecuador. Monorepo con dos proyectos independientes:

```
Proyect-Kallpro/
├── 00 - Inicio.md              ← EMPEZAR AQUÍ: panel con prioridades vigentes
├── Bitacora-de-Sesiones.md     ← dónde quedó la última sesión y qué sigue
├── Proyect-Kallpro-Backend/    Express + TypeScript + Prisma + PostgreSQL (puerto 5001)
├── Proyect-Kallpro-Frontend/   React 18 + Vite + Tailwind + Zustand (puerto 3001)
├── Arquitectura KallpaPro/
│   ├── flujo-trabajo-erp.md    ← ÍNDICE del ciclo completo (router, no detalle)
│   ├── arquitectura-tecnica.md ← el CÓMO: capas, RBAC, convenciones (vivo, técnico)
│   ├── base-de-datos.md        ← los 113 modelos Prisma agrupados por módulo + relaciones clave
│   ├── protocolo-documentacion.md / protocolo-mejoras.md ← meta: cómo se mantiene esto ordenado
│   ├── plan-mejoras-odoo18.md  ← backlog priorizado Fase A→D con registro de avance
│   ├── Modulos/                ← un archivo POR MÓDULO (ejecutado/flujo/mejoras propuestas)
│   └── _Archivo/                ← borradores legados, NO es lectura obligatoria
├── Credenciales/00-ACCESOS-Y-ENTORNO.md  ← cómo correr, puertos reales, secretos (no va a git)
└── Documentacion de la Arquitectura Paso a Paso/   ← histórico por sprint
```

**Diferenciador de mercado:** la automatización. Odoo hace todo manual; KallpaPro
automatiza (comparativo ponderado de proveedores, aprobaciones por matriz de monto,
conciliación bancaria automática, evaluación de calidad por motor). **No sacrifiques
automatización por parecerte a Odoo**: de Odoo se copia la UX, no el trabajo manual.

## 2. Antes de desarrollar — lectura obligatoria

**No leas todo esto de corrido.** Abre solo el archivo del módulo que vas a tocar — cada
uno trae ejecutado/flujo/mejoras propuestas sin necesidad de contexto adicional.

| Documento | Para qué |
|---|---|
| `Bitacora-de-Sesiones.md` | **Lee la primera entrada antes que nada.** Dónde quedó la sesión anterior y el próximo paso sugerido. |
| `00 - Inicio.md` | Panel de entrada: prioridades vigentes y accesos directos. |
| `Arquitectura KallpaPro/flujo-trabajo-erp.md` | **Índice VIVO.** Ciclo completo del ERP + tabla de estado global por módulo + las 7 reglas transversales + link a cada archivo de `Modulos/`. |
| `Arquitectura KallpaPro/Modulos/*.md` | **El detalle real**, uno por módulo (01-planificacion-presupuesto, 02-compras, 03-inventario, 03b-produccion-calidad, 04-ventas, 05-07-tesoreria-nomina-biometrico, 06-contabilidad, 08-analisis-financiero-cxp-cxc, 09-ux-transversal, 10-crm, y `asistente-contable-cxp-cxc-permisos` como referencia del módulo 8). Actualiza SOLO el archivo del módulo que tocaste. |
| `Arquitectura KallpaPro/arquitectura-tecnica.md` | El CÓMO técnico: capas backend/frontend, RBAC de 19 roles, convenciones. Actualízalo solo si cambia un patrón estructural, no una feature puntual. |
| `Arquitectura KallpaPro/base-de-datos.md` | Los 113 modelos Prisma agrupados por módulo, el patrón de relación FK vs polimórfica (`entityType`/`entityId`), y los hubs de relación. Actualízalo solo si agregas/quitas un modelo. |
| `Arquitectura KallpaPro/plan-contabilidad-tributaria-sri.md` | Plan activo (8 etapas, decisiones YA confirmadas) de facturación electrónica SRI real + cierre de impuestos + NIIF/Supercías. Léelo ANTES de tocar `Invoice`/`SriDocument`/asientos de venta si el pedido menciona SRI, firma electrónica o comprobantes. |
| `Arquitectura KallpaPro/plan-mejoras-odoo18.md` | Plan de mejoras A1→D1 basado en Odoo 18 + hallazgos de la exploración en vivo (§6). Tiene el registro de avance por fecha. |
| `Arquitectura KallpaPro/protocolo-documentacion.md` / `protocolo-mejoras.md` | Meta: dónde va cada tipo de información y cómo se documenta una mejora. Consulta si no sabes en qué archivo anotar algo. |
| `Credenciales/00-ACCESOS-Y-ENTORNO.md` | Cómo correr el proyecto, puertos reales, usuarios de prueba, secretos. **No se sube a git.** |
| `Documentacion de la Arquitectura Paso a Paso/00-INDICE.md` | Índice del histórico (docs 01–24). |

Además tienes memoria persistente indexada en `MEMORY.md` (un archivo por sprint).

## 3. Las 7 reglas transversales (NO negociables)

1. **Multi-tenant**: toda tabla lleva `companyId`; toda consulta filtra por él. Numeraciones
   por empresa vía `getNextDocumentNumber` (nunca `count()+1`).
2. **Contabilidad como columna vertebral**: cualquier hecho económico genera asiento vía
   `journal.service` (numeración AST atómica + `assertPeriodOpen`). **Nunca** escribir en
   `journal_entries` directo.
3. **Cuentas por posting setup** (`AccountMapping` + `DEFAULT_MAPPINGS`), nunca códigos
   contables quemados en la lógica de negocio.
4. **Trazabilidad**: entidad origen ↔ asiento ↔ movimiento enlazados por ids
   (`entityType/entityId`, `sourceType/sourceId`, `journalEntryId`, `batchId`).
5. **Estados que bloquean**: documentos contabilizados/pagados no se editan, se reversan.
6. **Motores de cálculo puros** (sin BD) con tests unitarios: payroll, treasury, attendance,
   reconciliation, FIFO/LIFO, calidad, casillas SRI.
7. **UI en español**, sin enums crudos; labels centralizados; breadcrumbs en `routeLabels.ts`.

## 4. Estado actual (post-Sprint 13 — plan Odoo 18 Fases A-C completas, plan SRI/NIIF completo)

**Tests: backend 600/600 · frontend 117/117 · `tsc --noEmit` limpio en ambos** (último
conteo real registrado, 2026-09-12 — ver `plan-mejoras-odoo18.md` §5 y
`plan-contabilidad-tributaria-sri.md` §4 para el detalle de cada incremento; verifica con
`npx jest`/`npx vitest run` si necesitas el número exacto hoy). El backend a veces muestra
timeouts falsos al correr `npx jest` con la concurrencia por defecto (contención de conexiones
a Postgres, no un bug real) — si ves suites fallando por "Exceeded timeout" en `beforeAll`,
reintenta con `npx jest --maxWorkers=2` antes de asumir una regresión.

Módulos completos y validados e2e: autenticación/RBAC (19 roles, con `authorize()`
server-side en TODO el módulo financiero, compras y ventas — no solo botones ocultos),
inventario multibodega con costeo AVG/FIFO/LIFO por capas + reabastecimiento entre bodegas +
stock negativo configurable + unidad compra≠venta, compras con requisiciones y aprobación
multinivel L1–L5, portal de proveedores, ventas con despachos parciales/notas de crédito/
aprobación de descuentos/servicios sin stock, producción **con calidad ISO/ARCSA**,
contabilidad NIIF con cierres de período, declaraciones SRI por casillas, ATS y activos
fijos/depreciación, nómina Ecuador 2026 con biométrico + calendario TTHH + organigrama
visual, tesorería con conciliación bancaria (import OFX/CSV con presets por banco), CRM,
asistente contable CxP/CxC (roadmap de 88 secciones cerrado, 5 fases), y UX transversal
completa (Ctrl+K, smart buttons, chatter con log de cambios y seguidores, actividades
programadas, kanban conmutable).

Facturación electrónica SRI real (firma XAdES-BES + envío SOAP + autorización, los 4
comprobantes de venta con RIDE en PDF) + cierre de impuestos automático + ATS con desglose
exacto + NIIF/Supercías completo (Cambios en el Patrimonio, Notas, paquete de exportación):
plan **completo (Etapas 1-8)**, ver `plan-contabilidad-tributaria-sri.md`. Además: pestaña
"Reporte" en Contabilidad (Balance/Resultados/Flujo con descarga PDF/Excel) y flujo de efectivo
con método directo o indirecto (NIC 7) seleccionable.

Sprints 1–13: ver `Documentacion de la Arquitectura Paso a Paso/`. Trabajo post-Sprint 13
(2026-09-04 a 2026-09-12): ver `Arquitectura KallpaPro/plan-mejoras-odoo18.md` §5 y
`plan-contabilidad-tributaria-sri.md` §4 (registro de avance completo, fecha por fecha) y
`MEMORY.md` → "Trabajo reciente".

## 5. Entorno y comandos

```bash
# Base de datos: Docker, contenedor kallpapro-db, PostgreSQL en el puerto 5433
# Login de pruebas: admin@gmail.com / 12345678

# Backend (puerto 5001 real — el .env.example dice 5000 pero el .env real usa 5001)
cd Proyect-Kallpro-Backend && npm run dev      # nodemon + ts-node
npx jest                                        # 173 tests
npx tsc --noEmit

# Frontend (puerto 3001)
cd Proyect-Kallpro-Frontend && npm run dev      # vite
npx vitest run                                  # 72 tests
npx tsc --noEmit
```

Los servidores se levantan con las herramientas de preview (`.claude/launch.json` tiene
"Backend - KallpaPro" y "Frontend - KallpaPro"), **nunca con Bash**.

### Trampas conocidas del entorno
- **`npx prisma migrate dev` falla con EPERM** si nodemon está corriendo (bloquea el
  `query_engine-windows.dll.node`). **Detén el backend antes de migrar**, luego
  `npx prisma generate` y vuelve a levantarlo.
- La ruta del proyecto tiene espacios y está en OneDrive: cita siempre las rutas.
- `cmdk` necesita polyfills de `ResizeObserver` y `scrollIntoView` en jsdom (ya están en
  `src/test/setup.ts`).
- La búsqueda global es **sensible a acentos** ("tornilleria" no encuentra "tornillería").
  Solución pendiente: extensión `unaccent` de PostgreSQL.

## 6. Cómo trabajar (flujo de un sprint)

0. Leer la primera entrada de `Bitacora-de-Sesiones.md` (dónde quedó la sesión anterior).
1. Leer el archivo del módulo en `Arquitectura KallpaPro/Modulos/` que vas a tocar y la
   memoria del área correspondiente (no hace falta leer los demás módulos).
2. Implementar backend primero: **motor puro + tests**, luego servicio con BD, controlador, ruta.
3. Migración si toca schema (detener backend antes).
4. Frontend: API wrapper → componente → montaje en la página → test.
5. **Verificar**: `npx jest` + `npx tsc --noEmit` en backend; `npx vitest run` + `tsc` en frontend.
6. **Probar e2e en el navegador** como usuario real (login admin@gmail.com / 12345678).
7. **Actualizar** el archivo del módulo tocado en `Modulos/` (❌→✅ y brechas nuevas),
   `plan-mejoras-odoo18.md` (registro de avance) y la memoria. Si cambia la prioridad
   general, actualiza también `00 - Inicio.md`.
8. **Agregar una entrada nueva en `Bitacora-de-Sesiones.md`** (arriba de todo) si fue una
   sesión de trabajo real: qué se hizo, qué queda pendiente, próximo paso sugerido.

## 7. Qué sigue (backlog priorizado)

> Actualizado 2026-09-12 tras cerrar el plan SRI/NIIF completo. **Las Fases A, B y C del plan
> Odoo 18 y el plan `plan-contabilidad-tributaria-sri.md` completo (Etapas 1-8) están
> cerrados** — no repitas ítems de ninguno de los dos, están marcados ✅ en sus documentos.

`Arquitectura KallpaPro/plan-contabilidad-tributaria-sri.md` — **completo (Etapas 1-8,
2026-09-10 a 2026-09-12)**: base normativa, firma XAdES-BES, envío/autorización real contra el
SRI, los 4 comprobantes electrónicos de venta (factura, NC, ND, guía de remisión) con RIDE en
PDF, producción+contingencia, cierre de impuestos automático, ATS con desglose exacto por línea,
y NIIF/Supercías completo (Estado de Cambios en el Patrimonio, Notas a los Estados Financieros,
paquete de exportación en PDF). No queda backlog pendiente de este plan.

**Fase D del plan Odoo** (`plan-mejoras-odoo18.md` — sin decisión tomada, preguntar antes de
arrancar):
- **D1 · Company switcher** — requiere User↔Company N:M (hoy 1:1), cambio grande, diseñar primero.
- **D2 · Dashboard de inicio configurable** (arrastrar tarjetas KPI por rol) — `react-grid-layout`.
- **D3 · Vista Pivot/Gráfico genérica** sobre diario y ventas.

**Propuestas de Mejora e Integración LOGIFI** (`Claude outputs/propuestas-mejora-integracion-modulos-erp.md`,
2026-09-11): **6/6 cerradas** — puente CRM→Ventas (deal ganado genera cotización), cobranza
automática (dunning por escalones), webhooks de couriers, costo real de flete, participación
de utilidades (15%), panel "Mis permisos". Quedan 2 preguntas de producto sin resolver (no son
de código): ¿el alcance de agentes CRM es el definitivo o se construye hacia LOGIFI v2 (inbox
omnicanal, apps móviles)?, ¿la suscripción por módulo implica usuario↔empresa N:M (mismo tema
que D1 de abajo)?

**Brechas activas por módulo** (detalle y "dónde" en cada `Modulos/*.md` — no está agotado el
trabajo, solo el plan Odoo):
- Ventas: página de detalle de cotización; planificación de rutas/despachos de logística.
- Contabilidad: Form 101 anual; diferidos; reverso contable de NC de compra (plan
  `plan-contabilidad-tributaria-sri.md` completo, Etapas 1-8 — no repetir ítems de ahí).
- Análisis financiero (CxP/CxC): comparativo presupuesto-vs-real, KPIs por depto, consolidación
  multiempresa — ver [[08-analisis-financiero-cxp-cxc]].
- Compras: comparador de cotizaciones de proveedores lado a lado, contratos marco.
- Inventario: cuenta contable por producto (doc21, resto ya cerrado).
- Calidad/producción: reproceso automático desde disposición REWORK, calibración de equipos
  (ISO 9001 §7.1.5), inspección de recepción de OC, resolver el cliente en la trazabilidad
  hacia adelante.
- UX transversal: búsqueda sensible a acentos (falta extensión `unaccent` de PostgreSQL).

**Deuda técnica:** ESLint sin configuración en ambos proyectos. `FinancialPage.tsx` (frontend)
quedó huérfana (no enrutada) y `POST /sri/:id/pay` es un pago directo legado que bypasea la
mesa de trabajo CxP — candidatos a eliminar juntos en una sesión futura, no se borraron sin
pedido explícito (ver `Modulos/06-contabilidad.md`).

## 8. Convenciones de código

- Comentarios en español, explicando **el porqué** (regla de negocio, norma), no el qué.
- Servicios en `src/services/*.service.ts`; controladores delgados con `asyncHandler`;
  errores con `AppError.badRequest(mensaje, 'CODIGO')` (mensaje en español, apto para el usuario).
- Frontend: Tailwind con el design system propio (`brand-*`, `surface-*`), soporte dark mode
  en todo componente nuevo, modales pequeños y enfocados (solo los datos necesarios).
- Numeración de documentos: OC- (compras), REQ-, PV- (pedido), FAC-V- (factura venta),
  NC- (nota de crédito), AST- (asiento), PAG- (pago), KP- (envío), PROD- (producción),
  INS- (inspección), RNC- (no conformidad), LOTE-AAAAMMDD-#### (lote de producción).
