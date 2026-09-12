# 22 — Revisión de Odoo: Requisiciones (guía de referencia)

> **Fecha:** 2026-07-04
> **Objetivo:** revisar el módulo de Requisiciones de Compra en el Odoo real del usuario (solo
> lectura, ninguna requisición creada/modificada) para contrastar con nuestro flujo y detectar
> mejoras puntuales.
>
> **Conclusión general:** el flujo de aprobación de KallpaPro (`Requisition`) **ya es más
> sofisticado** que el de Odoo — 3 niveles condicionales por presupuesto excedido
> (`PENDING_L1→L2→L3`), notas por nivel, y criterios de evaluación ponderada (`scoringCriteria`)
> para comparar cotizaciones. Odoo (en esta instalación, altamente personalizada para
> construcción) solo tiene un flujo fijo de 2 niveles (Departamento → "IR").
>
> **✅ ESTADO: Ejecutada 1 mejora priorizada por el usuario** (fecha límite/necesaria). El resto
> queda documentado como backlog condicional.

---

## 1. Qué se revisó en Odoo (sin tocar nada)

- Detalle de una requisición (`EPR03810`): **Empleado** (solicitante) separado de **Responsable de
  Requisición**; **Departamento** con jerarquía completa (`La Cúspide / Proyectos / Construcción /
  Operaciones / Bodega`); **Cuenta Analítica** y **Proyecto** vinculados directamente (patrón de
  centro de costo por obra, específico de esta constructora); **Tarea/Orden de Trabajo**; 3 fechas
  distintas (Requisición, Recepción, **Límite de Requisición**); **Vendor** sugerido a nivel de
  cabecera y **Proveedor** por línea de ítem individual.
- Pestaña "Otra Información": cadena de aprobación con nombre + fecha por cada paso (Confirmado
  por, Líder de Departamento, Aprobado por, Rechazado por) y un chatter con notificación por
  **correo electrónico** formal al aprobador ("Approve request for Purchase Requisition - EPR03810").
- Pestaña "Detalles de Transferencia": Ubicación de Origen/Destino y "Transferencia Interna" — la
  requisición puede resolverse moviendo stock entre bodegas en vez de comprar, si el material ya
  existe en otra ubicación.
- Pestaña "Materiales/Costo BOQ": desglose de costo por Equipamiento/Maquinaria, Trabajador/Recurso,
  paquete — específico de Bill of Quantities de construcción.
- Listado agrupado por Estado (5423 requisiciones): `Nuevo → Esperando Aprobación de Departamento →
  Esperando Aprobación de IR → Aprobado → Pedido de Compra Creado → Recibido`, con ramas
  `Rechazado`/`Cancelado`.

## 2. Hallazgos frente a KallpaPro (comparación)

| Área | Odoo | KallpaPro (antes) | Decisión |
|---|---|---|---|
| Flujo de aprobación | 2 niveles fijos (Departamento → IR) | 3 niveles condicionales por presupuesto, con notas y scoring ponderado | **KallpaPro ya es superior** — nada que igualar |
| Fecha límite/necesaria | Sí, campo explícito | No existía ningún deadline, solo `createdAt` | ✅ **Implementado** (ver §3) |
| Proveedor sugerido por línea | Sí | No existe en `RequisitionItem` | Backlog — el usuario no lo priorizó esta sesión |
| Departamento jerárquico | Jerarquía ilimitada | `Department` plano (`departmentId` simple) | Backlog — cambia el modelo `Department` globalmente, mayor alcance |
| Vínculo a Proyecto/Cuenta Analítica | Sí, patrón de centro de costo por obra | No existe | No aplicable de forma genérica — patrón específico de constructoras, no trasladar sin caso de uso explícito |
| Notificación por correo al aprobador | Sí, plantilla formal | No existe infraestructura de email en el backend | Backlog de mayor alcance (requiere agregar un proveedor de correo, no es un "ajuste pequeño") |
| Transferencia interna en vez de compra | Sí | No existe ese desvío en el flujo de Requisición | Backlog — KallpaPro sí tiene transferencias entre bodegas como feature aparte, pero no conectadas al flujo de requisición |
| BOQ (costo por maquinaria/mano de obra) | Sí | No existe | No aplicable — específico de construcción |

## 3. Implementado: fecha límite/necesaria (`neededBy`)

**Backend:**
- Schema (migración `20260704200000_requisition_needed_by`): `Requisition.neededBy` (`DateTime?`,
  opcional, deadline operativo — no confundir con las fechas de aprobación `l1ApprovedAt`, etc.).
- `requisition.service.ts` (`createRequisition`) y `requisition.controller.ts` (`addRequisition`)
  aceptan y persisten `neededBy`, con validación de fecha inválida en el controller.

**Frontend:**
- `NewRequisitionPage.tsx` — campo de fecha opcional "Se necesita para".
- `RequisitionsPage.tsx` — columna "Necesaria" en el listado; si la fecha ya pasó y el estado no es
  `PO_CREATED`/`REJECTED`, se resalta en rojo con ⚠.
- `RequisitionDetailPage.tsx` — badge junto al estado ("Necesaria: fecha" o "⚠ Vencida: fecha" con
  el mismo criterio).

**Verificación:**
- `tsc --noEmit` verde en backend y frontend.
- `npm test`: **71/71 verdes** (sin regresiones).
- E2E: se intentó crear una requisición vía `POST /requisitions` en la empresa QA y **se topó con
  el bug latente ya documentado** de `reqNumber` único global entre empresas (ver
  `kallpapro-latent-bugs.md` — el mismo patrón que se corrigió para Invoice/SalesOrder en junio
  sigue sin corregirse aquí). Se validó el campo `neededBy` directamente vía Prisma (creación,
  lectura y limpieza de un registro de prueba): persiste y se lee correctamente como `Date`.

## 4. Backlog (no implementado esta sesión, solo documentado)

- Proveedor sugerido por línea de ítem (`RequisitionItem.suggestedSupplierId`).
- Departamentos jerárquicos (cambio de modelo global, no solo de Requisición).
- Notificación por correo al aprobador — requiere agregar infraestructura de email (no existe hoy).
- Conectar el flujo de Requisición con Transferencias entre bodegas (evitar comprar si ya hay stock
  en otra ubicación).
- **Corregir `Requisition.reqNumber` a `@@unique([companyId, reqNumber])`** — no es parte de esta
  revisión de Odoo, pero se descubrió al validar el cambio; ver `kallpapro-latent-bugs.md`.
