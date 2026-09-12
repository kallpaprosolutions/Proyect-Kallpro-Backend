# 9. UX transversal (Fase A del plan Odoo 18)

> 📍 Módulo **9** del ciclo operativo · [[flujo-trabajo-erp|← Router de módulos]] · [[plan-mejoras-odoo18|Plan de mejoras — Fase A]]
> Aplica a todos los documentos (OC, factura, pedido, requisición), no es un módulo de negocio propio.

## Flujo de trabajo
Búsqueda global (Ctrl+K) para llegar a cualquier registro → smart buttons para navegar a
documentos vinculados desde el detalle → chatter para dejar contexto sobre el documento.

## Ejecutado ✅
| Paso | Dónde |
|---|---|
| Búsqueda global Ctrl+K (clientes, proveedores, productos, OC, facturas, pedidos, requisiciones, menús) | A1: `GET /api/search` + `GlobalSearch.tsx` (cmdk) en MainLayout |
| Smart buttons con contadores de documentos vinculados en OC / pedido / factura | A4: `GET /api/search/related/:type/:id` + `<SmartButtons/>` |
| Chatter ligero (hilo de mensajes) en OC, factura, pedido y requisición | A2: `DocumentMessage` + `/api/chatter/:type/:id` + `<Chatter/>` |

## Ejecutado ✅ (cont.)
| Paso | Dónde |
|---|---|
| **A5 · Vistas kanban conmutables** (lista ⇄ kanban) en Requisiciones, Pedidos de venta, Facturas de venta/compra, Cuentas por Pagar, Cuentas por Cobrar y Financiero (Cartera/Pagos) | `<KanbanBoard/>` genérico (`src/components/kanban/KanbanBoard.tsx`, extraído del Pipeline CRM con el fix de columnas vacías `useDroppable` que el Pipeline no tenía) |

**A5 — alcance real del drag-and-drop** (2026-09-04, ver [[plan-mejoras-odoo18]] para el detalle):
solo son columnas *droppable* las transiciones que ya eran un simple `POST` sin formulario
obligatorio (aprobar requisición por nivel, confirmar/despachar pedido). Las columnas que
representan un estado derivado automáticamente (pedido `PARTIALLY_SHIPPED`/`INVOICED`…) o que
exigen un formulario real (rechazar con motivo, seleccionar ganador, pagar/cobrar con
`PaymentApplication`, nota de crédito) quedan bloqueadas con 🔒 y un tooltip — arrastrar ahí no
hace nada, evita bypasear la lógica de negocio real (regla del proyecto: no simplificar el
trabajo, solo la UX). En Facturas, CxP, CxC y Financiero el kanban es de solo lectura
(agrupa por urgencia/antigüedad/dunning, ya calculados) porque no hay una transición de
estado manual que tenga sentido como "soltar en otra columna" sin abrir un modal.

**Bug real encontrado en el camino**: el rol **TTHH** nunca se agregó al array `ROLES`
hardcodeado de `src/pages/admin/UsersPage.tsx` — el backend lo soportaba desde el sprint del
calendario de TTHH, pero no se podía crear un usuario con ese rol desde la interfaz. Corregido.

## Ejecutado ✅ (cont. 2)
| Paso | Dónde |
|---|---|
| **A3 · Actividades programadas** (to-do agendado sobre OC/factura/pedido/requisición: llamar, revisar, pagar…) + widget "Mis actividades" en Inicio con vencidas en rojo | `Activity` (mismos 4 `entityType` que el Chatter) + `/api/activities/*` + `<Activities/>` en el detalle + `<MyActivitiesWidget/>` en `Dashboard.tsx` |

**A3 — detalle** (2026-09-05): motor puro `computeActivityStatus` (DONE/OVERDUE/TODAY/UPCOMING,
compara solo el día — una actividad de hoy sigue siendo "hoy" sin importar la hora) con 12
tests unitarios. Una actividad se crea "para mí" por defecto o se asigna a otro usuario de la
empresa (`GET /api/activities/assignable-users`, mismo `listCompanyUsers` que ya usa el admin
de usuarios — transversal, sin gate de `Subject`, igual que el Chatter). Solo el responsable o
quien la creó puede completarla/reabrirla/cancelarla (`findOwnedActivity`, 403 si no). Widget de
Inicio: mismo patrón visual que "Mis pendientes" de Compras (`ProcurementHubPage.tsx`) pero
transversal a los 4 documentos, con check-rápido para completar sin salir de Inicio; no
renderiza nada si no hay pendientes (regla 7: sin ruido cuando no aplica).
**Bug real corregido en el camino**: el checkbox de completar del widget de Inicio quedó
anidado dentro del `<button>` de la fila completa (`<button><button/></button>`, HTML inválido
— React lo advierte en consola) — corregido cambiando la fila a un `div` con `role="button"`.

## Ejecutado ✅ (cont. 3)
| Paso | Dónde |
|---|---|
| **A2.2 · Log de cambios automático por campo + notas internas + seguidores** en el mismo hilo del Chatter | `DocumentMessage.kind` (MESSAGE\|NOTE\|LOG) + `logFieldChange()` + `DocumentFollower` + `/api/chatter/:type/:id/follow` |

**A2.2 — detalle** (2026-09-05): **log de cambios** — se agregaron 3 columnas nullable a
`DocumentMessage` (`logField`/`logFrom`/`logTo`) y un helper `logFieldChange(companyId, userId,
entityType, entityId, field, from, to)` en `chatter.service.ts`, llamado explícitamente (no un
trigger genérico de BD, por diseño) desde el punto exacto de cada transición de estado real:
`approveRequisition`/`rejectRequisition`/`createQuotation`/`selectWinnerAndCreatePO`
(requisiciones), `submitPurchaseOrder`/`approvePurchaseOrder`/`rejectPurchaseOrder`/
`updatePOStatus` (OC), `confirmOrder`/`recalculateOrderStatus` (pedidos — cubre despacho e
facturación por ser la función que centraliza el estado derivado), `updateInvoiceStatus`/
`applyToDocumentTx` en `payment.service.ts` (facturas, incluye el PATCH parcial/pagado). El
backend solo guarda el código crudo (`PENDING_L1`); la traducción a español la hace
`<Chatter statusLabels={...}/>` reutilizando el mismo mapa de etiquetas que cada página YA
tenía para pintar su badge de estado — cero duplicación de labels entre backend y frontend.

**Nota interna vs mensaje**: `kind` en el POST (`MESSAGE` por defecto, `NOTE` si el usuario
activa el toggle) — mismo hilo, insignia ámbar "Nota interna" para distinguirla visualmente.

**Seguidores**: `DocumentFollower` (único por `entityType+entityId+userId`), botón Seguir/
Dejar de seguir + contador 👁 en el header del Chatter. **Sin canal de notificación push/email
todavía** — es visibilidad (quién está pendiente del documento), no una bandeja de avisos; eso
queda como backlog aparte si se necesita.

**Hallazgo real evaluado y descartado**: ya existía un sistema de auditoría genérico
(`AuditLog` + `recordAudit`/`diffRecords` en `src/utils/audit.ts`) usado para datos maestros
(`updateProduct`/`updateCustomer`/`updateSupplier`). Es complementario, no duplicado: escribe a
una tabla separada no visible en ningún hilo de chatter, pensado para diffs de campos de
catálogo, no para el timeline del documento que pide A2.2. Se documenta aquí para que quien
toque esto después no confunda los dos mecanismos.

**Bug real corregido de paso** (regla 1, multi-tenant): `updateInvoiceStatus` hacía
`prisma.invoice.update({ where: { id } })` **sin filtrar por `companyId`** — cualquier empresa
podía cambiar el estado de una factura de otra empresa conociendo su id. Corregido con un
`findFirst({ where: { id, companyId } })` previo (que de paso da el estado "antes" para el log).

## Ejecutado ✅ (2026-09-11 — "Mis permisos")
Panel **"Mis permisos"** en Seguridad (`/settings/security`): traduce las reglas CASL reales
del rol del usuario (`ROLE_RULES`, única fuente de verdad — el mismo catálogo que
`authorize()` aplica en cada ruta) a una matriz legible en español por módulo/acción. Se deriva
en `auth/permissions-matrix.ts` (puro), expuesto en `GET /auth/me/permissions` — nunca se
desincroniza del enforcement real porque no es una lista aparte, es el mismo dato. Verificado
e2e real en navegador (rol ADMIN: "Control total" + matriz completa por módulo).

## Mejoras propuestas
- ❌ Búsqueda sensible a acentos ("tornilleria" no encuentra "tornillería") — falta extensión `unaccent` de PostgreSQL (deuda técnica del entorno).

## Ver también
- [[plan-mejoras-odoo18|Plan de mejoras Odoo 18]] (Fase A completa + hallazgos de la exploración en vivo)
