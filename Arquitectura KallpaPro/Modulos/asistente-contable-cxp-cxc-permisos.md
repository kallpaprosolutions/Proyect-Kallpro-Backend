# Asistente Contable CxP/CxC — Flujo de trabajo y operatividad por rol

> 📍 Complementa el módulo **08 · Análisis financiero (CxP/CxC)** · [[08-analisis-financiero-cxp-cxc|← Ver módulo]] · [[flujo-trabajo-erp|Router]]
> Documento de referencia de las mesas de trabajo de Cuentas por Pagar y Cuentas por Cobrar
> (`CxPWorkbench.tsx` / `CxCWorkbench.tsx`, Contabilidad → Cuentas por Pagar / Cuentas por
> Cobrar). Detalle de quién puede hacer qué, y en qué orden.
> Última actualización: 2026-09-05.

## 1. Qué cubre este módulo

Todo el ciclo de una obligación con un tercero, desde que nace el documento hasta que su
saldo llega a cero — por la vía normal (pago/cobro) o por una vía de excepción (ajuste,
regularización). No es un formulario de captura: es la mesa de trabajo donde una persona de
contabilidad decide **a quién atender primero** y actúa ahí mismo.

```
CxP (compras)                                    CxC (ventas)
──────────────                                   ──────────────
Documentos SRI (factura/NC/ND)                   Pedido de venta → Factura
  → automático (XML/PDF) | manual | IA-asistido     → nace en Ventas, no en este módulo
  → confirmar (asiento + inventario)
        │                                                │
        ▼                                                ▼
  Mesa de trabajo CxP                              Mesa de trabajo CxC
  cola por prioridad (vencimiento +                cola por antigüedad (dunning:
  importancia proveedor + monto +                  AL_DIA/RECORDATORIO/URGENTE/
  caja proyectada)                                 COBRANZA)
        │                                                │
        ├─ Pagar (total/parcial) ──────────────┐        ├─ Cobrar (total/parcial) ──┐
        ├─ Programar pago → Procesar todo       │        ├─ Ajustar saldo             │
        ├─ Ajustar saldo                        │        ├─ Reclasificar cuenta       │
        ├─ Aplicar nota de crédito               ▼        ├─ Registrar gestión         ▼
        └─ Reclasificar cuenta            Asiento contable  de cobranza          Asiento contable
                                           (journal.service)                     (journal.service)
```

## 2. Roles del sistema y este módulo

KallpaPro tiene 18 roles operativos (`src/auth/roles.ts` en el backend). De esos, **8 pueden
ver** la pestaña Contabilidad → Cuentas por Pagar/Cuentas por Cobrar (`accounting.view` en
`src/lib/permissions.ts` del frontend), y de esos 8, **4 pueden actuar** — 3 con `postManual`
(sin tope de monto, sujetos igual a las aprobaciones de Fase 4) y 1 (GERENTE) con
`approveGerencial` (solo para ejecutar el nivel GERENCIAL/RESPONSABLE del pago por monto —
ver [[08-analisis-financiero-cxp-cxc]] §Fase 4 — NO para asientos manuales generales, que
siguen exigiendo `postManual`):

| Rol | Ve la mesa de trabajo | Puede pagar/cobrar/ajustar/programar/aplicar NC/reclasificar | Rol real en el flujo |
|---|:---:|:---:|---|
| **ADMIN** | ✅ | ✅ (`postManual`) | Acceso total, incluye configuración de mapeo de cuentas |
| **CONTADOR** | ✅ | ✅ (`postManual`) | Dueño natural del módulo — decide y ejecuta |
| **ASISTENTE_CONTABLE** | ✅ | ✅ (`postManual`, tope AUTO de Fase 4) | Ejecuta bajo supervisión del Contador; también captura documentos SRI |
| **GERENTE** | ✅ | ✅ (`approveGerencial`, 2026-09-05) | Ejecuta pagos/cobros de nivel RESPONSABLE/GERENCIAL (Fase 4) — el único caso en que un rol fuera de Contabilidad mueve caja aquí; no ve ni puede tocar la pestaña Asientos |
| **TESORERIA** | ✅ | ❌ | Ve CxP/CxC como referencia; sus pagos reales pasan por el módulo Tesorería, no por aquí |
| **TRIBUTARIO** | ✅ | ❌ | Lee para conciliar contra SRI/retenciones; no ejecuta pagos/cobros |
| **ANALISTA** | ✅ | ❌ | Lectura y análisis (DPO/DSO, aging), sin escritura |
| **AUDITOR** | ✅ | ❌ | Solo lectura de todo el sistema — nunca debe poder mutar nada aquí |
| *(todos los demás: JEFE_COMPRAS, JEFE_BODEGA, ventas, etc.)* | ❌ | ❌ | No ven esta pestaña — su relación con CxP/CxC es indirecta (generan los documentos de origen: OC, requisiciones, pedidos de venta) |

**Por qué GERENTE ahora puede actuar (2026-09-05):** al construir Fase 4 (aprobaciones por
monto) se diseñó a GERENTE como aprobador de los niveles RESPONSABLE/GERENCIAL, pero nadie
verificó que la mesa de trabajo (`postManual`) nunca le mostraba el botón "Pagar" — el control
por monto que se acababa de construir jamás se ejercitaba en la práctica porque la UI se lo
impedía un paso antes. Se corrigió agregando un permiso nuevo y más angosto,
`approveGerencial` (solo GERENTE/ADMIN), en vez de sumar GERENTE a `postManual` — así GERENTE
puede pagar/cobrar/ajustar/reclasificar en CxP/CxC (las acciones con tope de monto) sin ganar
de paso la capacidad de contabilizar asientos manuales libres en la pestaña Asientos, que es
un permiso de otra naturaleza y no formaba parte de este hallazgo.

**Qué SÍ pueden hacer los roles de solo-lectura (GERENTE/TESORERIA/TRIBUTARIO/ANALISTA/AUDITOR)
en esta mesa de trabajo**, aunque no puedan ejecutar acciones:
- Ver la cola completa, filtrar y buscar.
- Abrir el detalle de cualquier documento: saldo, vencimiento, desglose de por qué se
  priorizó así (CxP), estado de dunning (CxC).
- Ver el estado de cuenta (histórico de cargos/pagos/NC con saldo corrido).
- Ver el asiento contable sugerido o real de cada documento.
- Exportar/consultar reportes (fuera de esta mesa de trabajo, vía Reportes).

**Qué NO pueden hacer** (botones ocultos en la UI): pagar, cobrar, programar, procesar
programados, cancelar un programado, ajustar saldo, aplicar una nota de crédito, reclasificar
una cuenta. Todas estas acciones dependen del mismo permiso (`postManual`) — se corrigió el
2026-09-02 una inconsistencia donde "Aplicar nota de crédito", "Reclasificar cuenta" y
"Procesar/Cancelar programados" no estaban protegidas igual que "Pagar"/"Ajustar" (quedaban
visibles y ejecutables para cualquier rol con acceso de lectura al módulo, incluido AUDITOR).

**Registrar una gestión de cobranza** (llamada/email/WhatsApp/promesa de pago, en CxC) es la
única acción de escritura que queda abierta a los 8 roles con `accounting.view` — es de bajo
riesgo (no mueve saldos ni genera asientos) y así funcionaba ya la gestión de cobranza desde
antes de esta mesa de trabajo.

## 3. Matriz de operatividad — CxP

| Acción | Quién | Efecto contable | Reversible |
|---|---|---|---|
| Ver cola priorizada y detalle | 8 roles (lectura) | Ninguno | — |
| **Pagar** (total o parcial) | ADMIN · CONTADOR · ASISTENTE_CONTABLE | DR CxP / CR Bancos (o solo asiento si no hay cuenta bancaria) | Reverso manual del asiento (Contabilidad → Asientos) |
| **Programar pago** | ídem | Ninguno hasta procesar (solo agenda) | Cancelar mientras esté `SCHEDULED` |
| **Procesar programados** (lote) | ídem | Un `Pagar` por cada programado vencido/de hoy | Igual que Pagar |
| **Ajustar saldo** (write-off) | ídem | DR CxP / CR Otras rentas — motivo obligatorio | Reverso manual del asiento |
| **Aplicar nota de crédito** | ídem | Ninguno directo — enlaza la NC a la factura (`docModificadoNumero`), el saldo neto se recalcula solo | Desenlazar (`unlinkCreditNote`, sin UI propia aún — ver §6) |
| **Reclasificar cuenta** | ídem | Asiento correctivo de 2 líneas (DR cuenta correcta / CR cuenta incorrecta) — el asiento original NO se edita | No se reversa un correctivo con otro correctivo automáticamente; se hace manual si hace falta |
| Registrar factura/NC/ND (automático, manual o IA) | Quien tenga acceso a Documentos SRI (`financial.sri`: ADMIN, CONTADOR, ASISTENTE_CONTABLE, TRIBUTARIO) | Genera el `SriDocument` que luego aparece en la cola | Eliminar mientras no esté `CONFIRMED` |
| Confirmar documento SRI | ídem | DR Inventario/Gasto + IVA / CR CxP (`createDirectPurchaseEntry`) | Reverso manual |

## 4. Matriz de operatividad — CxC

| Acción | Quién | Efecto contable | Reversible |
|---|---|---|---|
| Ver cola por antigüedad y detalle | 8 roles (lectura) | Ninguno | — |
| **Cobrar** (total o parcial) | ADMIN · CONTADOR · ASISTENTE_CONTABLE | DR Bancos / CR CxC | Reverso manual |
| **Ajustar saldo** (write-off) | ídem | DR Gasto por deterioro CxC / CR CxC — motivo obligatorio | Reverso manual |
| **Reclasificar cuenta** | ídem | Asiento correctivo de 2 líneas sobre el asiento de venta original | Manual si hace falta |
| Registrar gestión de cobranza | 8 roles (lectura incluida) | Ninguno (queda en `CollectionActivity`, no en el mayor) | Sin borrado — es histórico |
| Emitir nota de crédito de venta | Según permiso de Ventas/Facturación (fuera de este módulo) | Actualiza `paidAmount` de la factura directo, sin paso de enlace manual (a diferencia de CxP) | — |

## 5. Flujo completo con puntos de decisión

**CxP — de la factura al saldo cero:**
1. Llega una factura de compra → se registra en Documentos SRI (automático, manual o
   asistido por IA — ver `sri-ingreso-manual` en memoria) → **ADMIN/CONTADOR/ASISTENTE_CONTABLE/TRIBUTARIO**.
2. Se revisa y confirma (checklist de validación, posible match de OC, asiento sugerido) →
   mismos roles.
3. Aparece en la mesa de trabajo de CxP, priorizada automáticamente. El **CONTADOR** (o quien
   tenga `postManual`) decide, por orden de urgencia:
   - Si hay caja: **Pagar** (completo o parcial).
   - Si no hay caja hoy pero sí en unos días: **Programar pago**.
   - Si llegó una nota de crédito del proveedor: **Aplicar nota de crédito** antes de pagar,
     para que el monto a pagar ya sea el neto correcto.
   - Si el saldo remanente es un residuo no cobrable por el proveedor (redondeo, descuento
     de último momento): **Ajustar saldo**, no forzar un pago de centavos.
   - Si en algún momento se detecta que el asiento quedó en la cuenta contable equivocada:
     **Reclasificar cuenta** — nunca editar el asiento original.
4. El documento sale de la cola cuando su saldo neto llega a $0 (por pago, por ajuste, o por
   una combinación de ambos).

**CxC — de la venta al cobro:**
1. Se factura un pedido de venta (módulo Ventas, fuera de este documento).
2. La factura aparece en la mesa de trabajo de CxC, clasificada por dunning según su
   antigüedad.
3. El **CONTADOR** (o quien tenga `postManual`) actúa por orden de urgencia (COBRANZA >
   URGENTE > RECORDATORIO > AL_DIA):
   - **Cobrar** cuando el cliente paga (total o parcial).
   - **Registrar gestión de cobranza** en cada contacto, aunque no haya cobro todavía —
     cualquiera de los 8 roles de lectura puede dejar esta traza.
   - **Ajustar saldo** cuando el saldo se declara incobrable o se condona.
   - **Reclasificar cuenta** si el asiento de venta quedó en la cuenta de ingresos equivocada.

## 6. Brechas conocidas

- ✅ **CERRADA (2026-09-05): autorización server-side de las acciones mutantes de CxP/CxC.**
  Hasta esta fecha, `postManual` solo ocultaba botones en el frontend — los endpoints
  (`POST/DELETE .../ap/payables/:id/pay|schedule|write-off`, `.../ap/scheduled/:id`,
  `.../ap/scheduled/process`, `.../ap/credit-notes/:id/link|unlink`,
  `.../ar/receivables/:id/collect|write-off`, `.../journal-entries/reclassify`) no tenían
  middleware `authorize()`, solo `authMiddleware` (autenticado, no autorizado por rol).
  Se agregó `authorize('pay', 'Payment')` a las 10 rutas de arriba. Requirió sumar la regla
  CASL `['pay','Payment']` a `ASISTENTE_CONTABLE` y a `GERENTE` en `roles.ts` (antes ninguno
  de los dos la tenía a nivel de backend, aunque el frontend ya asumía que sí podían ejecutar
  — ver el hallazgo de `approveGerencial` arriba). **Verificado real, no solo en tests**: un
  usuario `AUDITOR` de prueba, llamando `POST /api/financial/ap/payables/:id/pay` directo con
  `fetch` (sin pasar por la UI), recibió `403 {"error":"No tienes permisos para esta acción",
  "required":"pay:Payment","role":"AUDITOR"}` — antes de este fix esa misma llamada habría
  llegado a la lógica de negocio. Un usuario `GERENTE` de prueba pagó con éxito (`201`) una
  factura de $6900 (nivel GERENCIAL), confirmando que el fix no rompió el caso que sí debía
  funcionar.
  **Sigue sin cerrarse** (fuera de alcance, no forma parte de CxP/CxC): el resto del módulo
  financiero (`/financial/journal-entries` general, `/financial/invoices`, DCF, escenarios,
  etc.) sigue sin `authorize()` en la mayoría de sus rutas mutantes — este fix fue deliberadamente
  acotado a las 10 rutas que esta mesa de trabajo expone, no una reescritura de todo
  `financial.routes.ts`.
- **Desenlazar una nota de crédito** (`unlinkCreditNote`) existe en el backend pero no tiene
  botón en la UI todavía — solo se puede enlazar ("Aplicar aquí"), no revertir el enlace desde
  la mesa de trabajo.
- `SriDocument.paymentStatus`/`paidAt` no reflejan un cierre mixto pago+NC (ver
  `cxp-workbench-rediseno` en memoria) — cosmético, no afecta el saldo mostrado.

## 7. Referencias

- Memoria: `cxp-fase3-priorizacion-pagos`, `cxp-workbench-rediseno`, `cxc-workbench-rediseno`,
  `sri-ingreso-manual`.
- Código: `CxPWorkbench.tsx`, `CxCWorkbench.tsx`, `ap.service.ts`, `ar.service.ts`,
  `journal.service.ts` (`createReclassificationEntry`, genérico y reutilizado por ambos),
  `src/lib/permissions.ts` (frontend), `src/auth/roles.ts` (backend, catálogo completo de
  roles y permisos CASL-style — el que gobierna el resto del ERP, no solo Contabilidad).
