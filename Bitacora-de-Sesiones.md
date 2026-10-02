# 📓 Bitácora de Sesiones

> **Para Claude**: lee SOLO la primera entrada (la más reciente) al empezar una sesión —
> ahí está dónde quedamos y qué sigue. Al cerrar una sesión de trabajo real (no una
> pregunta rápida), agrega una entrada NUEVA arriba de todo con el formato de abajo.
> Este archivo reemplaza al sistema roto de `Credenciales/_Archivo/CONTEXTO-CONSOLIDADO.md`
> (hook automático que nunca capturó transcripts reales — ver entrada de hoy).

## Formato de una entrada
```
## AAAA-MM-DD — título corto de la sesión
**Se hizo**: qué se completó, con archivos/módulos tocados (usar [[wikilinks]]).
**Quedó pendiente / decisión del usuario**: qué falta o qué hay que decidir antes de seguir.
**Próximo paso sugerido**: la acción concreta más lógica para la siguiente sesión.
```

---

## 2026-10-01 (sesión más reciente) — Réplica llenable del Formulario 101 oficial del SRI
**Se hizo**: el usuario eligió continuar con el Formulario 101 entre las 3 opciones pendientes
(101, auditoría NIC/NIIF, reconciliar migraciones). Se investigó la estructura real con
WebSearch/WebFetch — el PDF oficial `cyte.com.ec/.../pdf-formulario-101.pdf` (Resolución
NAC-DGERCGC15-00000143) sí se pudo leer completo con el `Read` tool (WebFetch no procesa PDFs
binarios). Se aplicó el mismo patrón ya validado en 104/103, con el mismo criterio de alcance
(no reconstruir las ~500 casillas de detalle de balance, sí la parte tributaria real: Conciliación
Tributaria + Cálculo del Impuesto + Anticipo + Valores a Pagar, casillas 801-999, ~45 casillas,
con dos casillas puente 6999/7999 mapeables al Estado de Resultados). Ver [[06-contabilidad]]
"Ejecutado 2026-10-01 — Réplica llenable del Formulario 101" para el detalle completo: motor
`sri-form101-official.engine.ts`, servicio/controlador/rutas con período ANUAL (AAAA, no AAAA-MM),
UI `Form101OfficialReplica.tsx` junto al "Form 101 · Renta (anual)" simplificado ya existente.

**Bug real encontrado y corregido en la misma sesión** (verificando e2e): el controlador dividía
la tarifa de IR entre 100 dos veces (frontend ya manda fracción decimal 0.25, controlador volvía
a hacer `/100` → 0.0025), calculando $425 en vez de $42.500 de impuesto causado sobre una utilidad
gravable de $170.000. Corregido + test de regresión agregado.

1067/1067 backend (129 suites, confirmado en el run final) + 159/159 frontend, `tsc --noEmit`
limpio en ambos, sin regresiones. **Verificado e2e real en el navegador**: mapeo de cuenta a la casilla 6999,
edición manual de 6999/7999, y confirmación de que toda la cadena de fórmulas (801→803→819→832→
839→842→855→859→902→999) recalculó correctamente. Datos de prueba revertidos.

**Bug no relacionado encontrado durante la prueba, y corregido en la misma sesión** (el usuario
pidió el fix justo después de ver el reporte): `OnboardingTour.tsx` entraba en loop infinito
("Maximum update depth exceeded") y dejaba la app en blanco en el primer login de un rol sin el
tour marcado como visto. Causa: `steps` se recalculaba con `.filter()` en cada render (objeto
nuevo siempre), lo que le daba una identidad nueva a `step` y hacía que `measure` (`useCallback`
con dep `[step]`) disparara el `useLayoutEffect` en loop. Corregido memoizando `steps` con
`useMemo` (deps `[user?.role, open]`) — ver [[09-ux-transversal]]. Verificado e2e real: reseteado
`onboardingDone` del admin vía Prisma directo (no hay endpoint para desmarcarlo, es intencional),
login desde cero, tour abrió "Paso 1 de 4", avanzó a "Paso 2 de 4", cerrado con "Omitir" sin
crash. 159/159 frontend tras el fix. Tarea `task_a8f3092c` que lo flageaba, retirada (ya resuelta).

**Quedó pendiente / decisión del usuario**: con esto, los 3 formularios SRI (104, 103, 101) tienen
réplica oficial — no queda backlog de esa línea de trabajo, y el bug de `OnboardingTour` también
quedó cerrado. Lo que sigue del pedido grande original de la sesión 2026-09-28: (a) auditar
cumplimiento NIC/NIIF línea por línea en los motores puros (depreciación, diferidos, patrimonio)
— nunca tocado; (b) reconciliar el historial de migraciones Prisma (`task_ff9a163f`, drift
preexistente, bloquea `migrate dev`).

**Próximo paso sugerido**: preguntar al usuario si sigue con la auditoría NIC/NIIF o con la
reconciliación de migraciones Prisma, o si prefiere otra cosa.

---

## 2026-09-28 — Réplica llenable del Formulario 103 oficial del SRI
**Se hizo**: continuación directa de la sesión anterior — el usuario pidió seguir con el
Formulario 103 usando exactamente el mismo patrón ya validado en el 104. Reutilizando los
modelos genéricos `SriCasillaMapping`/`SriCasillaOverride` (soportaban `formType` desde el
diseño del 104, sin migración nueva), se construyó: motor puro `sri-form103-official.engine.ts`
(~65 casillas reales en 9 secciones, estructura ya investigada la sesión anterior y guardada en
memoria), `sri-form103-replica.service.ts` + controlador + rutas, y el componente
`Form103OfficialReplica.tsx` — ver [[06-contabilidad]] "Ejecutado 2026-09-28 — Réplica llenable
del Formulario 103" para el detalle completo.

1054/1054 backend + 159/159 frontend, `tsc --noEmit` limpio en ambos, sin regresiones. **Verificado
e2e real en el navegador**: layout completo de las ~65 casillas renderizado correcto, edité la
casilla 353 (honorarios retenidos) a mano a $42 y confirmé que 399/499/902/999 recalcularon en
cascada — el mismo comportamiento validado en el 104, ahora también en el 103. Datos de prueba
revertidos.

**Quedó pendiente / decisión del usuario**:
- El Formulario 101 (~800 casillas) sigue sin investigar su estructura real — requiere otra
  sesión de investigación (WebSearch) antes de poder aplicar el mismo patrón, ya probado dos
  veces (104 y 103) y directamente reutilizable.
- Reconciliar el historial de migraciones Prisma (`task_ff9a163f`, drift preexistente).
- Verificar cumplimiento NIC/NIIF línea por línea en los motores puros (punto (a) del pedido
  grande original, aún no tocado).

**Próximo paso sugerido**: preguntar al usuario si quiere que se investigue la estructura real
del Formulario 101 para aplicarle el mismo patrón, o si prefiere priorizar otra cosa (auditoría
NIC/NIIF de los motores existentes, o la reconciliación del historial de migraciones).

---

## 2026-09-28 — Réplica llenable del Formulario 104 oficial del SRI
**Se hizo**: continuación directa de la sesión anterior (mismo día) — con las 2 decisiones de
alcance ya confirmadas por el usuario (mantener el motor de cálculo actual + réplica visual del
104 con mapeo a cuentas; auditoría con middleware global, ya cerrada), se investigó con
WebSearch/WebFetch la estructura REAL del Formulario 104 y 103 del SRI a partir de declaraciones
reales presentadas (PDFs oficiales de una entidad pública) — guardado en memoria
`sri-formularios-104-103-estructura-real-2026-09-28.md` para no perder esa investigación.

Hallazgo importante antes de construir nada: `sri-casillas.service.ts` YA usaba numeración de
casilla REAL para un subconjunto (411, 419, 421, 429, 500, 507, 601, 602, 609, 902) — el gap
real frente al pedido del usuario era solo: no viene de cuentas contables, no es editable, sin
layout visual real. Se construyó la réplica completa (ver [[06-contabilidad]] "Ejecutado
2026-09-28 — Réplica llenable del Formulario 104"):
- Motor puro `sri-form104-official.engine.ts` con la estructura REAL completa (~45 casillas,
  fórmulas validadas exacto contra una declaración real para los totales).
- 2 modelos nuevos (`SriCasillaMapping`, `SriCasillaOverride`) — aplicados con `prisma db push`
  porque `migrate dev` falló por un drift preexistente del historial de migraciones (`P3006`,
  migración `arap_pro` no aplica limpio en la shadow DB por falta de `customer_segments`) — sin
  relación con este cambio, queda flageado como tarea aparte (`task_ff9a163f`).
- Servicio que calcula el valor sugerido de cada casilla hoja desde el MOVIMIENTO del período en
  el Mayor (no saldo acumulado), aplica overrides del contador, corre las fórmulas.
- UI nueva "Form 104 · Réplica oficial" en Contabilidad → Declaraciones: layout visual real por
  secciones, asignación de cuentas por casilla (reutiliza `AccountSelect`), edición manual con
  indicador sugerido (tachado) vs. valor aplicado (ámbar).

1045/1045 backend + 159/159 frontend, `tsc --noEmit` limpio en ambos, sin regresiones. **Verificado
e2e real en el navegador**: asigné una cuenta a la casilla 411, guardó correctamente; edité la
misma casilla a mano ($1200) y confirmé que se ve el sugerido tachado vs. el valor aplicado en
ámbar, y que la casilla 421 (fórmula, depende de 411) se recalculó sola a $180 (15% del override)
— el motor de fórmulas reacciona en cascada a un override. Datos de prueba revertidos.

**Quedó pendiente / decisión del usuario**:
- Extender el mismo patrón (motor + mapeo + UI) al Formulario 103 — su estructura real ya está
  investigada y guardada en memoria, falta solo construir el motor/servicio/UI análogos al 104.
- El Formulario 101 (Renta Sociedades, ~800 casillas) sigue sin investigar — no se encontró un
  ejemplo real completo esta sesión, necesita una investigación aparte antes de construir nada.
- Reconciliar el historial de migraciones Prisma (`task_ff9a163f`) antes de que otra sesión
  necesite correr `prisma migrate dev` y se tope con el mismo error.
- Sigue pendiente auditar cumplimiento NIC/NIIF línea por línea en los motores puros
  (depreciación, diferidos, patrimonio) — parte (a) del pedido grande, no tocada todavía.

**Próximo paso sugerido**: construir el Formulario 103 siguiendo exactamente el mismo patrón que
el 104 (ya validado end-to-end), reutilizando la estructura real ya investigada en memoria.

---

## 2026-09-28 — Tercera pasada de sincronización + arranque de mejoras contables NIIF/SRI
**Se hizo**: continuación del barrido de sincronización contable — un agente auditó los
`entityType` de `journal.service.ts` que quedaban sin revisar contra el patrón del reverso
genérico (`FX_REVALUATION`, `FIXED_ASSET`, `DEFERRED_ITEM`, `SRI_DOCUMENT`, `INVENTORY`,
`TAX_CLOSING`, `RECLASSIFICATION`, `CREDIT_NOTE`/`DEBIT_NOTE`/venta). 4 bugs reales más
corregidos (detalle técnico en [[06-contabilidad]] "Ejecutado 2026-09-28"): `FxRevaluation`
quedaba bloqueada para siempre por su `@@unique` igual que `DecimoLiquidation`; `FixedAsset`/
`DeferredItem` inflaban `accumulatedDepreciation`/`recognizedAmount` para siempre al reversar;
`SRI_DOCUMENT` ahora bloquea reversar una compra con pagos ya aplicados; limpieza genérica de
`InventoryAdjustment.journalEntryId`. Tests nuevos (`reverse-entry-sync-2.test.ts`, 4 casos),
1025/1025 backend + `tsc --noEmit` limpio, sin regresiones. No se hizo e2e visual de estos 4.

El usuario pidió a continuación, en el mismo mensaje, un alcance mucho más grande: (1) que todos
los cálculos/parametrizaciones contables a nivel transaccional sean automáticos, usando cuentas
transitorias que siempre neteen; (2) aplicar NIIF/NIC y normativa tributaria ecuatoriana; (3)
investigar los formularios de declaración de impuestos reales del SRI e implementarlos tal cual
son; (4) parametrizar las cuentas contables correspondientes; (5) habilitar la configuración de
cuentas para que el contador las ajuste; (6) auditoría de TODOS los usuarios y TODOS los cambios
del ERP con fecha/hora/IP/usuario. **Quedó como próximo paso de esta misma sesión — no se
investigó ni implementó nada de esto todavía**, ver abajo.

**Continuación misma sesión — mapeo de brechas + primer fix del pedido grande**: un agente mapeó
el pedido contra el código real (sin acceso a WebSearch, así que el punto de formularios oficiales
del SRI quedó sin comparar contra la ficha técnica real). Hallazgo con más impacto: las
retenciones en la fuente practicadas a proveedores (`RETENTION_PAYABLE_RENTA`/`_IVA`) se
acumulaban sin ningún asiento que las liquidara — bug real cuando el contador reconfigura esas
cuentas distintas de `IVA_DEBIT` (por defecto comparten código y quedan pagadas de rebote).
Corregido: `journal.service.createRetentionPaymentEntry` (Formulario 103, neteo exacto del saldo
real) + nueva obligación `TAX_RETENTION` en Tesorería (solo aparece si la cuenta está
reconfigurada, para no duplicar la de TAX_SRI) + validación de monto exacto en
`registerTransaction`. Ver [[06-contabilidad]] "Ejecutado 2026-09-28 — Neteo de cuentas
transitorias". `tests/integration/retention-payment-sync.test.ts` (3 casos), 1028/1028 backend +
`tsc` limpio. **Descartado tras investigar**: las cuentas PPE por categoría de activo fijo están
fijas a propósito (plan oficial Supercías, mismo criterio ya usado para subcuentas bancarias) —
no es la brecha de parametrización que parecía a primera vista.

**Se le preguntó al usuario las 2 decisiones de alcance y respondió**: (b) formularios SRI —
mantener el motor de cálculo actual (borrador para DIMM), PERO construir una **réplica visual
llenable del formulario maestro real del SRI**, previsualizable y editable mediante asignación de
cuentas contables a cada casilla oficial (no reconstruir la lógica tributaria completa de ~800
casillas, sí el LAYOUT real con mapeo casilla↔cuenta parametrizable). (c) auditoría transversal —
**middleware global por ruta** (cobertura total, sin diff campo-por-campo).

**(c) ejecutado esta misma sesión**: `middleware/audit-trail.ts` — intercepta TODA request que
modifica datos (POST/PUT/PATCH/DELETE) en TODOS los routers, registra en `AuditLog`
(`module='REQUEST'`, separado de la bitácora financiera encadenada) usuario + IP (`req.ip`, ya
resuelve `X-Forwarded-For`) + fecha/hora + módulo + ruta + estado. Ignora GET, requests sin
sesión y errores 5xx. Nueva sección "Trazabilidad del ERP" en la pestaña Auditoría de
Contabilidad (`AccountingControls.tsx`). Ver [[06-contabilidad]] "Ejecutado 2026-09-28 —
Auditoría transversal". `tests/integration/audit-trail-middleware.test.ts` (5 casos). 1033/1033
backend + 159/159 frontend, `tsc` limpio en ambos, sin regresiones. Sin e2e visual todavía.

**Quedó pendiente / decisión del usuario**: (a) verificar cumplimiento NIC/NIIF línea por línea
en los motores puros (depreciación, diferidos, patrimonio) — no se auditó esta sesión; (b) el
diseño e implementación de la réplica llenable de los formularios SRI (104/103/101) sigue sin
empezar — requiere investigar primero la estructura oficial real de casillas (WebSearch) antes
de diseñar el modelo de mapeo casilla↔cuenta.

**Próximo paso sugerido**: investigar con WebSearch la ficha técnica oficial 2026 de los
Formularios 104, 103 y 101 del SRI (números de casilla reales, agrupación por secciones) para
diseñar el modelo de datos del mapeo casilla↔cuenta contable antes de escribir código de UI.
Empezar por el 104 (IVA, el más simple y de mayor frecuencia mensual) como piloto del patrón,
luego extenderlo a 103 y 101.

---

## 2026-09-27 — Verificación e2e en navegador de los 5 fixes de sincronización contable
**Se hizo**: el usuario pidió validar en el navegador, como usuario real, los 5 fixes de
sincronización contable de las dos sesiones anteriores del mismo día. Se levantaron backend +
frontend reales (`preview_start`), login como admin@gmail.com, y se ejecutó cada escenario contra
la API real desde la consola del navegador autenticada (misma sesión/token que un usuario real),
verificando el resultado tanto por API como en la pantalla correspondiente:

- **Fix 1+2 (paymentStatus/paidAt + aging con saldo neto)**: factura de compra manual $200 →
  confirmada → NC manual por $200 enlazada por `docModificadoNumero` → al confirmar la NC, la
  factura pasó a `paymentStatus: PAID` (antes se quedaba `PENDING` para siempre) y el aging de
  CxP (`/finanzas?tab=pagos`) mostró **$0,00 / "No hay facturas de compra pendientes de pago"**
  en vez de seguir mostrando $200.
- **Fix 3 (ND suma a `Invoice.totalAmount`)**: factura de venta directa $100 → ND de $23 (interés
  de mora) → el detalle de la factura (`/financial/invoices/:id`) mostró **Total $123,00 / Saldo
  Pendiente $123,00** con la ND listada "+$23.00", no $100 como antes del fix.
- **Fix 4 (guardia anti-duplicado de décimos)**: liquidé el décimo tercero 2026 desde la UI de
  Nómina (botón "Liquidar $41,67" → badge "✓ Liquidado"); un segundo intento vía API devolvió
  correctamente `409 ALREADY_LIQUIDATED` — el guardia bloquea el duplicado en el camino feliz (el
  escenario específico de "falla a medias" que motivó el fix se prueba con inyección de fallo real
  en el test automatizado, no reproducible de forma segura en una sesión de navegador en vivo).
- **Fix 5 (reverso genérico resincroniza `PayrollPeriod`)**: generé/posteé/pagué un rol real de
  junio 2026 (empleado de prueba) → la UI de Nómina mostró el badge **"Pagado"**; reversé el
  asiento de pago desde `POST /financial/journal-entries/:id/reverse` (requiere `reason`, no
  documentado hasta probarlo) → la UI recargada mostró el badge **"Contabilizado"** de vuelta con
  el botón "💸 Registrar pago" reaparecido — exactamente el comportamiento esperado, antes habría
  quedado "Pagado" para siempre.

**Hallazgo colateral de UX/documentación** (no un bug, solo una fricción descubierta al probar):
el endpoint de reverso exige `body.reason` (≥5 caracteres, `controls.requireReason` — propuesta 06,
bitácora encadenada) y responde `400 REASON_REQUIRED` si falta; no estaba documentado en el
código de forma obvia hasta leer el controlador. La UI de `JournalEntriesPage.tsx` ya lo pide
correctamente (no es una brecha real, solo faltaba en mi contexto al probar por API directa).

Todos los datos de prueba (proveedor, 2 documentos SRI, factura+ND de venta, empleado, 2 períodos
de nómina, liquidación de décimo, 9 asientos contables) se crearon y **revirtieron por completo**
al terminar (script puntual vía Prisma, revisado antes de correr) — confirmado con
`suppliersCount: 0, periodsCount: 0, agingTotal: 0` al final. La empresa demo del usuario queda
exactamente como estaba.

**Quedó pendiente / decisión del usuario**: ninguno de los 5 fixes de sincronización contable
sigue sin validar — los 5 quedan confirmados e2e. Siguen sin decisión: Fase 3 de D1 (Company
switcher) y los 2 ítems de deuda técnica ya conocidos (`POST /sri/:id/pay`, `unlinkCreditNote`
sin botón).

**Próximo paso sugerido**: preguntar al usuario por el siguiente tema — no queda backlog de
sincronización contable pendiente de esta tanda. Candidatos: Fase 3 de D1, deuda técnica conocida,
o alguna brecha puntual de módulo.

---

## 2026-09-27 — Segunda pasada de sincronización: Tesorería/Nómina (2 bugs reales más)
**Se hizo**: continuación directa de la sesión anterior (mismo día) — el usuario pidió seguir el
barrido de sincronización contable, esta vez enfocado en Tesorería, Nómina e Inventario. Un
agente en background auditó los 3 módulos contra el código real (sin editar nada) y encontró 2
bugs reales del mismo patrón que los 3 de la sesión anterior; ambos corregidos con tests de
integración con BD real. Detalle técnico completo en [[05-07-tesoreria-nomina-biometrico]] §4.16.

- **`liquidateDecimo` podía duplicar el pago de un décimo**: el asiento contable se creaba
  ANTES que el registro `DecimoLiquidation` (el único guardia contra duplicado) en una escritura
  separada sin transacción — si esa segunda escritura fallaba, el asiento ya quedaba POSTED sin
  nada que bloqueara un reintento, y el sistema pagaba dos veces. Fix: el guardia se crea
  PRIMERO en estado `PENDING`; si falla la creación del asiento, se borra (reintento limpio sin
  haber pagado nada real).
- **El reverso genérico de asiento (`journal.reverseEntry`) no resincronizaba el documento
  origen**: cualquier CONTADOR puede reversar desde Contabilidad el asiento de un rol de pagos
  ya PAID, un pago/cobro de Tesorería o una liquidación de décimos, sin pasar por la acción
  propia de ese módulo. Dejaba 3 huérfanos: `PayrollPeriod` quedaba "PAID" para siempre,
  `BankTransaction.journalEntryId` apuntaba a un asiento REVERSED (bloqueando `voidTransaction`
  para siempre — movimiento "zombie"), y `RecurringCashItem.lastPaidPeriod` seguía bloqueando
  ese período. Corregido con validación previa (bloquea reversar el devengo de nómina si ya
  está PAID) y resincronización posterior de los 3 casos, más limpieza genérica de
  `BankTransaction.journalEntryId` para cualquier origen (no solo TREASURY).

Descartado con evidencia (sin bug): `getObligations` de Tesorería sigue leyendo `SriDocument`
real (fix de 2026-09-13 intacto); `cashAcct()` se usa de forma consistente en todos los asientos
de banco; la cuenta contable por producto/categoría se resuelve bien en COGS/Inventario;
Producción actualiza `ProductStock`/`avgCost` de forma atómica y consistente;
`inventory.service::registerMovement` es la única ruta real de cambio de stock fuera de
Producción (que es autocontenida).

1021/1021 backend + `tsc --noEmit` limpio en ambos, sin regresiones. Tests nuevos:
`tests/integration/reverse-entry-sync.test.ts` (6 casos) + 1 caso nuevo en
`tests/integration/decimo-liquidacion.test.ts`.

**Quedó pendiente / decisión del usuario**:
- No se hizo verificación e2e en navegador de ninguno de los 2 fixes (solo tests de integración
  con BD real) — sumado a los 3 fixes de CxP/CxC de la sesión anterior, quedan 5 fixes de
  sincronización contable sin probar visualmente en el panel.
- Los 2 ítems de deuda técnica ya conocidos siguen sin corregir (`POST /sri/:id/pay` bypasea la
  mesa CxP; `unlinkCreditNote` sin botón en UI).
- Fase 3 de D1 (Company switcher): invitación por correo + `CompanySwitcher` UI + "Mis empresas".

**Próximo paso sugerido**: verificar en navegador los 5 fixes de sincronización contable
acumulados (aging CxP, estado de cuenta tras NC, factura con ND, reverso de rol/pago/décimo), o
preguntar al usuario si quiere seguir con alguna brecha puntual del backlog (D1 Fase 3, deuda
técnica conocida) ya que no queda más backlog de sincronización pedido explícitamente.

---

## 2026-09-27 — Auditoría de mejoras pendientes + sincronización contable (3 bugs reales corregidos)
**Se hizo**: el usuario pidió (1) revisar todo el backlog de mejoras (`plan-mejoras-odoo18.md`,
`Modulos/*.md`, `propuestas de mejoras de internet/*.md`, `CLAUDE.md` §7) y depurar lo ya
implementado, y (2) enfocarse en que la parte CONTABLE esté sincronizada con todos los módulos,
sin nodos huérfanos, corrigiendo cualquier bug de sincronización que se detectara.

**(1) Auditoría de backlog** (3 agentes en paralelo, cada uno verificando contra el código real
antes de tachar, no solo confiando en lo que decía el propio documento):
- `propuestas de mejoras de internet/*.md`: ya estaban consistentes, no hizo falta editar nada
  (12/12 con cada sub-ítem interno correctamente tachado). Única excepción intencional sin
  tocar: 3 líneas de "Actualizaciones futuras IA" en `10-crm-vs-mercado.md`, marcadas "pendiente
  a propósito" por decisión de negocio (ML entrenado, agent-to-agent, LOGIFI v2).
- `Modulos/*.md`: cerró 3 ítems duplicados sin tachar en `08-analisis-financiero-cxp-cxc.md`
  (descuentos por pronto pago, límite de crédito proveedores, clasificación contable con score)
  y una nota obsoleta en `asistente-contable-cxp-cxc-permisos.md` sobre falta de `authorize()`.
- `plan-mejoras-odoo18.md` + `CLAUDE.md` §7: cerró 5 ítems del comparativo Odoo que ya estaban
  implementados (Chatter, Actividades programadas, Vistas múltiples, reglas push/pull,
  Dashboards por app) y **corrigió el estado de D1 (Company switcher)**, que decía "sin decisión,
  diseñar primero" — en realidad Fases 1-2 ya están hechas y validadas e2e (ver
  [[d1-company-switcher-fases-1-2]]), solo falta la Fase 3 (invitación + `CompanySwitcher` UI).

**(2) Sincronización contable** (ver [[06-contabilidad]] para el detalle técnico completo):
3 bugs reales del mismo patrón — un campo persistido que un flujo actualiza y otro lector sigue
leyendo crudo sin resincronizar —, todos con test de integración con BD real nuevo:
- `SriDocument.paymentStatus`/`paidAt` no se resincronizaban al enlazar/desenlazar una NC de
  compra ni al confirmar una NC ya enlazada por XML. Nuevo `ap.service.syncPaymentStatusFromBalance()`.
- `getApAging` calculaba los buckets con el total bruto, no el saldo neto — desincronizado con
  `getApKpis`.
- `debit-note.service.createDebitNote` nunca sumaba el total de la ND a `Invoice.totalAmount` —
  el asiento contable quedaba bien, pero el auxiliar de CxC (aging/KPIs/cobro) subvaluaba el
  saldo real. Ahora también reabre a `PARTIAL` una factura que ya estaba `PAID`.

1014/1014 backend + `tsc --noEmit` limpio en ambos, sin regresiones. Un cuarto agente hizo una
primera pasada de búsqueda de más bugs del mismo patrón en Nómina/Producción/Tesorería y no
encontró nada adicional (trazabilidad asiento↔documento verificada correcta en esos dos); ofreció
una segunda pasada más profunda en Tesorería/Inventario que no se ejecutó por límite de tiempo.

**Quedó pendiente / decisión del usuario**:
- Segunda pasada de auditoría de sincronización enfocada en Tesorería/Nómina/Inventario (el
  agente la ofreció explícitamente, no se hizo).
- Los 2 ítems de deuda técnica ya conocidos siguen sin corregir (no se tocaron, fuera de
  alcance de esta sesión): `POST /sri/:id/pay` bypasea la mesa de trabajo CxP real, y
  `unlinkCreditNote` existe en `api/financial.ts` del frontend pero ningún componente lo invoca.
- Fase 3 de D1 (Company switcher): invitación por correo + `CompanySwitcher` UI + "Mis empresas".
- No se hizo verificación e2e en navegador de los 3 fixes (solo tests de integración con BD real).

**Próximo paso sugerido**: verificar en navegador los 3 fixes de sincronización contable (aging
CxP, estado de cuenta tras NC, factura con ND emitida), o continuar la segunda pasada de auditoría
en Tesorería/Nómina/Inventario que el agente dejó ofrecida.

---

## 2026-09-27 — Propuestas de mejora de internet: docs 09 y 10 cierran la tanda completa (12/12)
**Se hizo**:
- **09 UX transversal (16/16)**: centro de avisos in-app (`Notification`, `NotificationCenter.tsx`
  en el header con Avisos + Mis actividades vía XState), resumen diario/semanal opcional por
  correo (lo crítico va al instante); Lista/Kanban/Calendario persistente en Pedidos/Facturas/
  Requisiciones; breadcrumbs apilables al saltar desde smart buttons; inicio y recorrido guiado
  por rol; búsqueda sin acentos (`unaccent`); centro de reportes `/reportes/centro` con
  drill-down, export y resumen en lenguaje natural; copiloto contextual por documento
  (aceptar/editar/descartar); autonomía IA en Compras/Ventas (piloto automático solo prepara
  borradores); captura móvil (`/movil/recepcion`, `/movil/pedido`). Ver [[09-ux-transversal]].
- **10 CRM (8/8)**: enriquecimiento del lead en dos pasos — instantáneo y local (heurística +
  RUC, siempre al crear, sin red) y profundo vía el agente investigador real (job cada 30 min,
  nunca bloquea la captura); pantalla de fusión de duplicados campo a campo (corrigió de paso
  una ambigüedad real: `duplicateOfId` no decía si el duplicado era otro lead o ya un contacto);
  gate real de "Commit" con checklist estructurada que bloquea el paso de etapa; atribución
  multitoque base (`agentCode` en cada evento, automático); puntaje "sugerido por datos" (lift
  de conversión histórica); enrutamiento por reglas de enriquecimiento. Deliberadamente sin
  scoring con ML entrenado, patrón agent-to-agent ni la visión LOGIFI v2 (decisión de negocio
  pendiente). Ver [[10-crm]].
- **Las 12 propuestas de "mejoras de internet" quedan cerradas** — tablero en
  `Arquitectura KallpaPro/propuestas de mejoras de internet/00-README-indice.md`.
- Verificación: 1006/1006 backend + 159/159 frontend, `tsc --noEmit` limpio en ambos proyectos.
  Migración de doc 09 (`Notification`, `unaccent`) y de doc 10 (`crm_enrichment_merge_gate`)
  aplicadas. e2e con BD real vía tests de integración (7/7 doc 09, 7/7 doc 10) — no se hizo
  e2e en navegador esta sesión (quedó pendiente para el usuario, ver abajo).
**Quedó pendiente / decisión del usuario**:
- Verificar en el navegador como usuario real (admin@gmail.com) los flujos nuevos: campana de
  avisos, copiloto en factura/OC, centro de reportes, captura móvil, fusión de duplicados en
  `/crm/leads`, gate de Commit en `/crm/forecast` y el pipeline de CRM.
- Preguntar qué sigue: no queda backlog priorizado obvio (Fase D del plan Odoo solo tiene D1
  company switcher, sin decisión; brechas puntuales por módulo, ninguna urgente — ver
  `00 - Inicio.md` §Prioridades).
**Próximo paso sugerido**: validación e2e en navegador de los docs 09 y 10, y luego preguntar
al usuario si retoma D1 (company switcher) o alguna brecha puntual del backlog.

---

## 2026-09-24 — Propuestas de mejora de internet: docs 04, 04b y 05 implementados
**Se hizo** (continuación de la entrada de abajo, mismo formato de marcado ✅ ~~tachado~~):
- **04 Ventas (16/16; 6 ya existían)**: segmentos de cliente con lista de precios, crédito con
  exposición real (facturas + pedidos abiertos) y política BLOCK/HOLD/WARN heredable → pedido
  "Retenido por crédito" con liberación por Gerencia/Tesorería, semáforo en cotización y pedido,
  portal B2B público `/portal-cliente/:token` (PDF, estado de cuenta, "Repetir pedido" como
  cotización), motivos de NC, stock por bodega al cotizar, reorden predictivo, alerta de precio
  anómalo, pronóstico por segmento. Bug multi-tenant en `updateCustomer`. Ver [[04-ventas]].
- **04b Logística (20/20; 2 ya existían)**: transportistas/flota/zonas/tarifas, orden de entrega
  (modo, prioridad, ventana, peso por `Product.weightKg`, flete cotizado), tablero del día con
  riesgo de retraso, ruta sugerida + mapa (Leaflet + OSM, sin geocodificador de pago), app del
  repartidor con POD (firma/foto), ETA por histórico, elección asistida de transportista, margen
  de flete, devoluciones DEV-#### → NC (reingreso por línea). 3 roles nuevos (22 en total).
- **05 Nómina + Biométrico (15/15; 4 ya existían)**: reloj en línea (ZKTeco ADMS en `/iclock` +
  JSON con token), excepciones de marcación con revisión de la jefatura, asistencia de hoy,
  ausentismo + sugerencias de riesgo, portal del empleado `/mi-portal` (marcación web con
  geocerca/selfie, roles de pago PDF, vacaciones, firma de documentos), reglas salariales
  versionadas por vigencia, avisos de permisos, recargo nocturno sobre la jornada planificada.
  Ver [[05-07-tesoreria-nomina-biometrico]] §4.14.
- Fix colateral: `electronic-invoice.test.ts` limpiaba `User.companyId` (columna eliminada en D1).
Migraciones nuevas: `sales_segments_credit_portal`, `logistics_catalogs_pod_returns`,
`product_weight`, `hr_punches_exceptions_rules_docs`. Backend 920/920 · frontend 142/142 · `tsc` limpio en ambos.

**Quedó pendiente / decisión del usuario**: docs 06, 07, 08, 09 y 10. Probar el conector ZKTeco
con un reloj físico (PIN = cédula, registrar el serial en Config. RR.HH.). Verificación visual en
el navegador: el usuario debe iniciar sesión en el panel (Claude no escribe contraseñas).
**Próximo paso sugerido**: seguir con el doc 06 (Contabilidad), auditando primero lo que ya existe
(el plan SRI/NIIF cerró mucho de ese módulo).

---

## 2026-09-24 — Propuestas de mejora de internet: docs 01, 02, 03 y 03b implementados
**Se hizo**: el usuario pidió leer `Arquitectura KallpaPro/propuestas de mejoras de internet/`,
revisar qué faltaba e implementarlo en orden, marcando lo hecho. Cada ítem implementado queda
~~tachado~~ con ✅ y el "dónde" en su documento; tablero de avance en `00-README-indice.md`.
- **01 Presupuesto (12/12)**: triple capa en vivo presupuestado/comprometido/ejecutado (el campo
  `BudgetControl.consumed` quedó deprecado — se sumaba al crear la OC y nunca se descontaba),
  políticas por depto (umbrales + ciclo), excepción de sobregiro con motivo obligatorio en L3,
  reforecast trimestral por ritmo real, escenarios, alertas + badge, export Excel/PDF, anomalías y
  narrativa. RBAC en `budget.routes.ts` (no tenía). Ver [[01-planificacion-presupuesto]].
- **02 Compras (15/15)**: homologación de proveedores (preexistentes migrados como HOMOLOGADO),
  aprobación por política (`PurchaseApprovalRule`), categorías de gasto, scorecard real
  (OTIF/precio/NC), tolerancias configurables, sugerencia de proveedor, control de precio de la
  factura, recurrentes próximas, tail spend. Bug multi-tenant en `updateSupplier`. Ver [[02-compras]].
- **03 Inventario (13/13)**: cuentas contables por producto/categoría en los asientos, ABC +
  conteo cíclico, slotting, riesgo de quiebre, pronóstico en reabastecimiento, cross-docking,
  picking guiado (el estado PICKING por fin se asigna). Bug multi-tenant en `updateProduct`.
- **03b Producción y Calidad (15/15)**: salidas registran el lote consumido (FEFO,
  `InventoryMovementBatch`) → trazabilidad lote→cliente + CSV de retiro; recepción con cuarentena
  e inspección; ruta de operaciones que usa la cuenta WIP; centros de trabajo + carga; kanban;
  calibración con bloqueo; auditorías; documentos controlados; checklist tablet; IA de visión
  opcional; causa raíz sugerida. RBAC en `production.routes.ts` (no tenía ninguno).
Tests: backend 866/866 (antes de la UI del 03b; backend no cambió después) · frontend 134/134 ·
`tsc` limpio en ambos. 5 migraciones nuevas (budget, purchases_policy, inventory_abc, production_quality_pro).

**Quedó pendiente / decisión del usuario**: docs 04, 04b, 05, 06, 07, 08, 09, 10 (en ese orden).
**No se pudo verificar en el navegador**: el panel del navegador no tenía sesión y las reglas de
seguridad impiden que Claude escriba contraseñas — el usuario debe iniciar sesión en el panel
para la verificación visual. La cobertura es por tests (motores + integración con BD real + UI).

**Próximo paso sugerido**: continuar con `04-ventas-vs-mercado.md`.

---

## 2026-09-23 — D1: Fase 2 ejecutada (login multi-empresa + switch-company)
**Se hizo**: el usuario pidió continuar con D1. Con la Fase 1 ya cerrada (`UserCompany` como
fuente de membresía+rol, `User.companyId`/`role` todavía presentes como fuente del JWT),
ejecuté la Fase 2 completa según lo ya diseñado en [[diseno-d1-company-switcher]] (§10).

`auth.service.ts` reescrito: `issueSessionTokens` arma el JWT desde la `UserCompany` resuelta
en vez de columnas de `User`; `finishLogin` (tramo común post-password/post-2FA) resuelve la
empresa activa — 1 sola membresía entra directo (sin cambio de UX para el 99% de las cuentas
hoy), más de una devuelve `requireCompanySelection` con un `companySelectionToken` corto (mismo
patrón que el challenge de 2FA, de un solo uso). Decidí el orden 2FA→selección de empresa
(identidad antes que contexto) ya que el diseño no lo especificaba. Nuevos endpoints:
`POST /auth/login/select-company` y `POST /auth/switch-company` (cambia la empresa activa de
una sesión ya autenticada, revoca+recrea la `UserSession` reusando el mecanismo de
`rotateRefresh`). `rotateRefresh` ahora preserva explícitamente la empresa de la sesión.

Después de reescribir el código quedó claro que `User.companyId`/`role` ya no se leían en
ningún lado (verificado con `tsc` — los errores de compilación marcaron exactamente los
sitios), así que ejecuté también la eliminación de esas columnas planeada para esta fase
(migración `20260923000000_drop_legacy_user_company_role`). Esto es una operación irreversible
sobre la BD: el primer intento con `prisma migrate dev` lo bloqueó la clasificadora de
seguridad de Claude Code ("Irreversible Local Destruction"). Le mostré al usuario el SQL exacto
(`DROP CONSTRAINT`/`DROP INDEX`/`DROP COLUMN`) y por qué era seguro (el backfill de la Fase 1
ya garantizaba que toda fila de `User` tenía su `UserCompany` equivalente) — confirmó, y apliqué
la migración con `prisma migrate deploy` (no pide confirmación interactiva).

Frontend: `Login.tsx` gana una tercera pantalla (selección de empresa) con tarjetas clickeables
estilo `AppSwitcher.tsx`, invisible para cuentas mono-empresa.

8 tests de integración nuevos (`company-switcher-login.test.ts`) + arreglé 3 fixtures
preexistentes que sembraban un `User` con `companyId`/`role` directo (ya no compilan contra el
schema nuevo). 761/761 backend real (1 falla preexistente ajena) + 124/124 frontend, `tsc
--noEmit` limpio en ambos.

**Verificado e2e real en el navegador**: (1) regresión mono-empresa — admin@gmail.com inicia
sesión directo, exactamente como antes. (2) Sembré una segunda `UserCompany` (rol AUDITOR,
simulando lo que la Fase 3 hará vía invitación) → el login mostró el selector con ambas
empresas → al elegir la secundaria, aterricé en su Inicio con el nombre correcto, y el JWT
decodificado en el navegador confirmó `companyId`/`role` exactos de esa membresía. Datos de
prueba limpiados, sesión vuelta a la cuenta real al terminar.

**Quedó pendiente / decisión del usuario**: solo falta la **Fase 3** de D1 (invitación por
correo con aceptación pendiente + `CompanySwitcher` en el navbar + página "Mis empresas") —
hoy no hay forma de crear una segunda membresía desde la interfaz, solo por seed/soporte.

**Próximo paso sugerido**: preguntar al usuario si sigue con la Fase 3 de D1 (cierra el módulo
completo) o pasa a otra cosa del backlog.

---

## 2026-09-17 — D1: diseño del company switcher + Fase 1 ejecutada
**Se hizo**: el usuario pidió explícitamente diseñar D1 antes de escribir código. Investigué el
flujo de auth real (`auth.service.ts`, `auth.middleware.ts`, `AuthPayload`) antes de proponer
nada — hallazgo clave: el JWT lleva `companyId`/`role` horneados al emitirse, nunca se releen de
`User` por request, así que los 409 sitios que leen `req.user.companyId` en controladores NO
necesitan tocarse; el blast radius real son ~9 sitios que consultan `User` por `companyId`
directo en BD + `auth.service.ts`. Diseño completo en
[[diseno-d1-company-switcher]]: nuevo modelo `UserCompany` (rol **por empresa**, no global —
generaliza un patrón que `ap.service.ts`/`ar.service.ts` ya usaban parcialmente), 3 fases, y una
decisión de producto que le pregunté al usuario (invitar por correo a alguien que ya tiene
cuenta en otra empresa: ¿membresía instantánea o pendiente hasta aceptar?) — **confirmó
"pendiente hasta aceptar"**, más seguro contra un admin que escribe mal un correo.

El usuario pidió arrancar la Fase 1 en la misma sesión. Ejecutado: migración `UserCompany` +
backfill (con `pgcrypto` para `gen_random_uuid()`, Prisma no pone DEFAULT de `id` a nivel de
columna) + reescritura de los ~9 sitios (`activity.service.ts`, `payroll.service.ts` ×2,
`inventory-adjustment.service.ts`, `ap.service.ts`/`ar.service.ts`, y en `auth.service.ts`:
`listCompanyUsers`/`registerUser`/`createCompanyUser`/`updateUserRole`/`toggleUserActive`).
`updateUserRole` hace dual-write transicional (User.role Y UserCompany.role) porque el JWT
sigue leyendo `User.role` hasta la Fase 2 — documentado como transicional, no un shim permanente.

**Regresión real encontrada y corregida en el camino**: 2 tests de integración
(`treasury-obligations.test.ts`, `logifi-integraciones.test.ts`) sembraban un `User` de prueba
con `prisma.user.create()` directo, sin `UserCompany` — el gate de aprobación de pagos y la
asignación de actividades empezaron a rechazarlos. Corregido agregando la fila faltante en
ambos fixtures.

6 tests de integración nuevos, 754/754 backend completo, `tsc --noEmit` limpio. **Verificado e2e
real en el navegador** como admin en `/admin/users`: crear usuario (UserCompany se crea junto
al User), cambiar rol vía el badge clickeable (dual-write confirmado en BD consultando
directamente), desactivar con el modal de confirmación real (User.isActive cambia sin tocar la
membresía). Sin cambio de UX visible — como estaba planeado para esta fase. Usuario de prueba
limpiado al terminar.

**Quedó pendiente / decisión del usuario**: Fase 2 (login con selección de empresa si hay >1
membresía + endpoint `POST /auth/switch-company` + eliminar `User.companyId`/`role`) y Fase 3
(invitación por correo con aceptación + `CompanySwitcher` UI + página "Mis empresas") — sin
arrancar, sin decisión de cuándo.

**Próximo paso sugerido**: preguntar al usuario si sigue con la Fase 2 de D1 o pasa a otra cosa
del backlog (brechas puntuales de `CLAUDE.md` §7, o deuda técnica).

---

## 2026-09-16 — D2: Panel de indicadores configurable en Inicio
**Se hizo**: con los 3 hallazgos pendientes ya cerrados (NC inventario, Tesorería↔CxP,
Contabilidad), el usuario eligió seguir con la Fase D del plan Odoo → D2 (dashboard
configurable). Ver [[d2-dashboard-configurable]] y `Modulos/09-ux-transversal.md`.

Antes de escribir código encontré que `GET /dashboard/home-summary` (`home-summary.service.ts`)
ya calculaba exactamente los KPIs que pedía D2 (ventas/compras del mes con variación, aprobaciones
y OC pendientes, pipeline CRM, leads, producción activa, bajo stock, por cobrar) — pero era un
endpoint huérfano, ningún componente del frontend lo llamaba nunca. No hizo falta agregar
agregación nueva, solo conectarla a tarjetas visibles.

Implementado: catálogo de 10 tarjetas KPI (`dashboardLayout.ts`, frontend, puro) filtradas por
`Subject` CASL vía el mismo `useCan()` que ya usaban las tarjetas de módulo; `mergeDashboardLayout()`
puro (7 tests unitarios) combina el layout guardado con las tarjetas disponibles en la sesión.
Persistencia en `User.dashboardLayout` (Json, migración `user_dashboard_layout`) vía
`GET/PUT /dashboard/layout`. UI con `react-grid-layout` (nueva dependencia) reutilizando
`StatCard`/`Sparkline` ya existentes — modo "Personalizar" con drag/resize, quitar tarjeta y
selector "Agregar tarjeta".

3 tests de integración con BD real + 7 unitarios del merge, 748/748 backend (1 falla preexistente
ajena — timeout de firma XAdES-BES en `electronic-invoice.test.ts`, flageada como
`task_4552de56`, no tocada) + 124/124 frontend, `tsc --noEmit` limpio en ambos.

**Verificado e2e real en el navegador** como admin: 10 tarjetas con datos reales, modo
Personalizar activado, quité una tarjeta (persistido en BD), la reagregué desde el selector,
recargué la página y el layout guardado se mantuvo. Reverti el layout del admin a `null`
(default) al terminar.

**Quedó pendiente / decisión del usuario**: de la Fase D del plan Odoo solo queda **D1** (company
switcher, User↔Company N:M) sin decisión — es un cambio grande que requiere diseño previo. También
sigue pendiente el flag `task_4552de56` (timeout flaky en electronic-invoice.test.ts, no
relacionado a este trabajo).

**Próximo paso sugerido**: preguntar al usuario si quiere D1 (diseñarlo primero, sin arrancar
código todavía) o alguna de las brechas puntuales por módulo de `CLAUDE.md` §7 (comparativo
presupuesto-vs-real, cuenta contable por producto, comparador de cotizaciones, conector
biométrico, etc.).

---

## 2026-09-13 — 06 Contabilidad: fix inventario físico de NC de compra
**Se hizo**: cerré el último hallazgo pendiente de la lista (`task_2bbd5b71`), ver
[[06-contabilidad]]. `confirmSriDocument` (rama sin OC vinculada) usaba siempre
`type: 'IN'` en `registerMovement` sin mirar `doc.tipoDocumento` — confirmar una
`NOTA_CREDITO` de proveedor con ítems PRODUCTO **sumaba** stock en vez de restarlo (una NC de
compra es normalmente una devolución de mercadería). Fix: `type: doc.tipoDocumento ===
'NOTA_CREDITO' ? 'OUT' : 'IN'`, sin pasar `unitCost` en el caso OUT (el costeo real lo calcula
`registerMovement` con el método del producto — AVG/FIFO/LIFO). De paso corregí, otra vez, el
bug de `doc.numeroDoc ?? doc.claveAcceso` (falla con `''`) en el mismo bloque.

3 tests de integración con BD real nuevos (`tests/integration/credit-note-inventory-return.test.ts`),
745/745 backend completo, `tsc --noEmit` limpio.

**Verificado e2e real en el navegador** como admin@gmail.com: sembré un producto con stock=20,
creé una NC manual de $57.50 (5 unidades, 15% IVA) por `/sri/new`, la confirmé desde
`SriDocumentReviewPage` — mensaje "✓ Devolución de producto NC inventario e2e (5 unidades
devueltas)". BD confirmó `ProductStock` 20→15 y `InventoryMovement.type = 'OUT'`. Datos de
prueba limpiados. **Hallazgo de UX descubierto de paso** (no corregido, fuera de alcance): la
pantalla de revisión de documento SRI no tiene selector manual de "Producto ERP" por ítem — el
`productId` solo se llena vía pre-llenado por IA, nunca a mano; un documento manual con ítem
PRODUCTO queda "Sin asignar" para siempre si no se usa el asistente de IA.

**Nota sobre trabajo en paralelo**: el usuario había lanzado el mismo hallazgo como tarea en
segundo plano (`task_2bbd5b71`) en una sesión separada, que implementó un fix equivalente en un
worktree aislado (`.claude/worktrees/kind-cohen-caea7b`, nunca aplicado al checkout principal —
verificado con `git status`). No hubo conflicto real; el fix de esta sesión es el que quedó
aplicado. Ver [[06-nc-compra-inventario-fisico-fix]] para el detalle completo.

**Quedó pendiente / decisión del usuario**: ninguno de los 3 hallazgos que venían arrastrándose
(NC inventario, Tesorería↔CxP, FinancialPage.tsx) queda pendiente — todos cerrados. El worktree
`kind-cohen-caea7b` con el fix duplicado sin commitear puede descartarse si el usuario confirma
que no lo necesita.

**Próximo paso sugerido**: preguntar al usuario por el siguiente módulo/tema de su lista — no
queda backlog abierto en 05-07/06/Tesorería↔CxP.

---

## 2026-09-13 — 05-07: Fix real Tesorería↔CxP (Invoice legado→SriDocument)
**Se hizo**: retomé el hallazgo pendiente marcado en la entrada anterior (una tarea en segundo
plano lo había dejado documentado como "corregido" sin que el cambio llegara a guardarse en el
repo — verificado con grep antes de empezar). Ver [[05-07-tesoreria-nomina-biometrico]] §4.13.

`treasury.service.ts::getObligations()` armaba las obligaciones AP_INVOICE desde el modelo
`Invoice` legado (tipo PURCHASE, solo alimentado por la página huérfana de Financiero) en vez de
la CxP real (`SriDocument`). `registerTransaction()` con `sourceType=AP_INVOICE` tenía el mismo
problema al ejecutar el pago. Corregido: `getObligations()` ahora usa
`sri-document.service.getPayables()` (misma fuente que el aging/CxP real), y
`registerTransaction()` delega en `finance/ap.service.payPayable()` en vez de reimplementar la
lógica — como `payPayable` ya arma su propio `BankTransaction`, la rama retorna directo con ese
resultado para no duplicar el movimiento bancario (se extendió `PayPayableInput` con
`date`/`notes` para no perder esas dos opciones del flujo viejo).

742/742 backend (3 tests de integración nuevos con BD real) + 117/117 frontend, `tsc --noEmit`
limpio en ambos.

**Verificado e2e real en el navegador** (datos revertidos): sembré una factura CxP real de $175 —
apareció correctamente en "POR PAGAR" del dashboard de Tesorería y en la pestaña Pagos (antes
habría mostrado $0 o nada); la pagué desde ahí y confirmé en la BD: `paidAmount` actualizado,
exactamente UN `BankTransaction` (no duplicado), asiento enlazado, obligación desaparecida de la
lista tras pagarse.

**Quedó pendiente / decisión del usuario**: queda el hallazgo NUEVO encontrado ayer al cerrar
06-contabilidad (NC de compra suma inventario en vez de restarlo, chip `task_2bbd5b71`) — no se
tocó en esta sesión. Con esto, los 2 hallazgos pendientes que venían arrastrándose (Tesorería↔CxP
de esta entrada, y el de FinancialPage.tsx/nota de documentación ya corregido antes) quedan
resueltos; solo falta el de inventario en NC.

**Próximo paso sugerido**: retomar el hallazgo de inventario en NC de compra (`task_2bbd5b71`), o
preguntar al usuario por el siguiente módulo/tema de su lista — 05-07, 06 y el hallazgo de
Tesorería↔CxP quedan todos cerrados.

---

## 2026-09-13 — 06 Contabilidad: Diferidos + Reverso NC de compra (CIERRE)
**Se hizo**: los otros 2 ítems de las 3 brechas de [[06-contabilidad]] — con esto **las 3 brechas
originales del módulo quedan cerradas**. Ver `06-contabilidad.md` (tabla Ejecutado) para el
detalle completo de ambos.

**Diferidos** (gastos pagados por anticipado / ingresos cobrados por anticipado, NIC 1): mismo
diseño y alcance que Activos Fijos (B4) — el registro NO contabiliza el pago/cobro original (ya
vive como activo/pasivo diferido en una factura o asiento aparte), solo genera el asiento MENSUAL
de reconocimiento en línea recta. A diferencia de activos fijos, el usuario elige las DOS cuentas
(dónde vive hoy el diferido, y dónde se reconoce cada mes) del plan de cuentas real, porque la
naturaleza varía mucho (seguros, arriendos, publicidad...). Página nueva `/contabilidad/diferidos`.

**Reverso contable de NOTA_CREDITO de compra**: antes, confirmar una NC de proveedor solo
ajustaba el saldo de CxP "virtualmente" (neteo en `getPayables`) sin ningún asiento — el mayor
nunca reflejaba el reverso, violando la regla 2. Ahora genera el espejo EXACTO de la factura
original (mismo cálculo proporcional, débito/crédito invertidos): DR Cuentas por Pagar / CR
Inventario-Gasto + IVA crédito. Se dispara automáticamente al confirmar la NC, sin importar si la
factura original tenía OC o no. **Bug real corregido de paso**: `doc.numeroDoc ?? doc.claveAcceso`
no caía al fallback cuando `numeroDoc` es `''` (típico en documentos manuales) — mismo patrón de
bug `??`-vs-string-vacío que ya se había corregido antes en Cash Management, esta vez en 3
funciones de `journal.service.ts`.

**Hallazgo nuevo, sin resolver**: al probar la NC en el navegador noté que confirmar una NC con
ítems tipo PRODUCTO sigue cargando inventario con `type: 'IN'` (como una factura) en vez de
restarlo — una NC de compra normalmente es una devolución al proveedor y debería sacar stock, no
meterlo. Es un hallazgo DISTINTO al reverso contable (ese sí quedó cerrado): este es sobre el
movimiento físico de inventario, no contabilizado. Quedó como chip de tarea en segundo plano
(`task_2bbd5b71`), no corregido en esta sesión.

739/739 backend (9 motor + 4+5 integración, todos nuevos entre Diferidos y NC) + 117/117
frontend, `tsc --noEmit` limpio en ambos.

**Verificado e2e real en el navegador** (datos de prueba revertidos): registré un diferido de
seguro anual $1,200/12 meses, corrí el reconocimiento y confirmé en BD el asiento DR gasto/CR
activo diferido por $100 exacto; registré una NC de compra manual de $230 (base $200 + IVA $30)
vinculada a una factura sustento, la confirmé, y verifiqué en BD el asiento AST real: DR 2010301
(CxP) $230 / CR 1010306 (Inventario) $200 + CR 1010501 (IVA crédito) $30, balanceado.

**Quedó pendiente / decisión del usuario**: 06-contabilidad no tiene más brechas documentadas.
Sigue pendiente el hallazgo Tesorería↔CxP legado (`Invoice` vs `SriDocument` en
`treasury.service.ts`, chip `task_7d5f4d28`) y el nuevo hallazgo de inventario en NC de compra
(chip `task_2bbd5b71`) — ninguno de los dos se corrigió en esta sesión.

**Próximo paso sugerido**: retomar alguno de los 2 hallazgos pendientes (Tesorería↔CxP legado, o
inventario de NC de compra), o preguntar al usuario por el siguiente módulo de su lista.

---

## 2026-09-13 — 06 Contabilidad: Formulario 101 (conciliación tributaria)
**Se hizo**: primer ítem de las 3 brechas de [[06-contabilidad]] (Form 101 anual, diferidos,
reverso NC de compra) — Form 101. Ver `06-contabilidad.md` (tabla Ejecutado) para el detalle.

Es una **conciliación tributaria básica**, no el Formulario 101 completo (~800 casillas
oficiales) — mismo criterio ya usado para el ATS: un borrador para revisar/confirmar en DIMM
Formularios antes de presentar, con disclaimer explícito en la UI. Motor puro `form101.engine.ts`
(15% participación laboral CT art. 97, suma de gastos no deducibles, base imponible, impuesto
causado) + `form101.service.ts` que junta la utilidad contable REAL del ejercicio
(`getIncomeStatement` anual) con las cuentas marcadas `isDeductible: false` (campo nuevo en
`FinanceChartOfAccounts`, migración `chart_account_deductible` — se marca por CUENTA, porque la
no-deducibilidad es del concepto de gasto, no de un asiento puntual). Pestaña nueva
"Form 101 · Renta (anual)" en Declaraciones (ejercicio + tasa editables) + toggle "No deducible"
en Plan de Cuentas. Fuera de alcance explícito: Anticipo de IR (Formulario 115), créditos
tributarios, exoneraciones sectoriales, arrastre de pérdidas tributarias de años anteriores
(acepta un valor manual si aplica, sin control de historial).

**Antes de empezar, corregí un hallazgo pendiente**: la tarea en segundo plano de la sesión
anterior (bug de `treasury.service.ts` leyendo `Invoice` legado en vez de `SriDocument`) había
dejado una memoria diciendo "corregido", pero **el fix nunca se guardó en el código** —
verificado con grep, `treasury.service.ts` seguía igual y el test que la memoria mencionaba no
existe. Corregí la memoria (`treasury-obligations-sridocument-fix.md`) y `CLAUDE.md`/
`06-contabilidad.md` (que sí tenían aplicado el hallazgo colateral correcto sobre
`FinancialPage.tsx` SÍ enrutada) para que no se dé por resuelto algo que no lo está. El hallazgo
original sigue vigente y sin corregir — sigue habiendo un chip de tarea pendiente para retomarlo.

721/721 backend (12 motor + 14 integración, todos nuevos — 1 test de otro archivo
`electronic-invoice.test.ts` salió flaky por contención de conexiones, confirmado no relacionado
al reproducirlo en aislado 2 veces más) + 117/117 frontend, `tsc --noEmit` limpio en ambos.

**Verificado e2e real en el navegador** (datos de prueba revertidos): sembré una venta de $20,000
y un gasto de comisiones de $500, marqué esa cuenta como "No deducible" desde Plan de Cuentas, y
el Formulario 101 mostró exactamente: utilidad contable $19,500 → −15% ($2,925) → +gasto no
deducible ($500) → base imponible $17,075 → impuesto causado $4,268.75 (25%) — la cadena completa
backend→frontend→cálculo cuadra sin ajuste manual.

**Quedó pendiente / decisión del usuario**: de las 3 brechas de 06-contabilidad quedan diferidos
y reverso contable de NC de compra. Sigue sin resolver el hallazgo Tesorería↔CxP legado
(`Invoice` vs `SriDocument` en `treasury.service.ts`) — hay un chip de tarea en segundo plano
pendiente para eso, la ejecución anterior no llegó a aplicarlo.

**Próximo paso sugerido**: seguir con diferidos o reverso de NC de compra (las otras 2 brechas de
06-contabilidad), o retomar el hallazgo Tesorería↔CxP pendiente antes de seguir sumando features.

---

## 2026-09-12 — 05-07 §6: Décimos acumulados (liquidación anual)
**Se hizo**: siguiente ítem de la lista ordenada del usuario (05-07 Tesorería/Nómina, ítem 6).
Ver [[05-07-tesoreria-nomina-biometrico]] §4.12 para el detalle completo.

El rol mensual de quien NO mensualiza su décimo solo PROVISIONA (línea EMPLOYER en el rol) —
nunca se pagaba de verdad. Motor puro `decimo-liquidacion.engine.ts` con las ventanas legales
(tercero: dic-nov; cuarto: Sierra ago-jul / Costa mar-feb, según nueva config `payroll.region` en
Ajustes → Nómina). El servicio suma las provisiones mensuales ya guardadas (esa suma ES el valor
legal exacto, no hay que recalcular) y la liquidación contabiliza **DR provisión / CR banco**
(releva lo ya provisionado, no reconoce un gasto nuevo — eso lo duplicaría). Modelos nuevos
`DecimoLiquidation`/`DecimoLiquidationItem` con `@@unique([companyId, kind, year])` para que no se
pueda liquidar el mismo décimo dos veces. Panel nuevo en `/nomina` junto a Utilidades.

707/707 backend (10 motor + 5 integración, todos nuevos) + 117/117 frontend, `tsc --noEmit`
limpio en ambos.

**Verificado e2e real en el navegador** (datos revertidos): empleado sembrado con 12 meses de
provisión de $40.17 → el panel mostró $482.04 para el tercero (12/12 meses) y $321.36 para el
cuarto (solo 8 de los 12 meses sembrados caen en la ventana Sierra ago-jul, confirmando que la
intersección de ventanas funciona bien, no solo la suma total). Liquidé el tercero y confirmé en
la BD el asiento AST-0008 real: DR 2010704 / CR 10101 por $482.04, balanceado; reliquidar el mismo
año lo bloqueó (`ALREADY_LIQUIDATED`). Cambié la región de la empresa a Costa/Galápagos y de vuelta
a Sierra/Oriente desde Ajustes, confirmando persistencia real.

**Quedó pendiente / decisión del usuario**: del backlog 05-07 quedan: conector biométrico en línea
(requiere hardware/SDK real, no viable de construir/probar en este entorno), multi-moneda con
revalorización contable, más presets de banco a demanda. El backlog priorizado y autocontenible de
05-07 queda prácticamente agotado — el conector biométrico es el único ítem que necesita una
decisión externa (qué reloj/SDK usa la empresa) antes de poder empezar.

**Próximo paso sugerido**: preguntar al usuario si sigue con multi-moneda/presets de banco de
05-07, o salta al siguiente módulo de su lista (según Bitácora anterior: 06 Contabilidad — Form
101 anual, diferidos, reverso contable de NC de compra). También sigue pendiente revisar el
resultado de la tarea en segundo plano sobre el hallazgo Tesorería↔CxP legado (`Invoice` vs
`SriDocument`) que se lanzó en la sesión anterior.

---

## 2026-09-12 — 05-07 §2: Cash Management (archivo de pago masivo por banco)
**Se hizo**: siguiente ítem de la lista ordenada del usuario (05-07 Tesorería/Nómina, ítem 2).
Ver [[05-07-tesoreria-nomina-biometrico]] §4.11 para el detalle completo.

Motor puro `cash-management-export.engine.ts` con presets GENERICO/PICHINCHA/PRODUBANCO (mismo
patrón que el import de extractos, §4.7), nuevo `cash-management.service.ts` que arma los
candidatos **desde la CxP real** (`sri-document.getPayables`, no el `Invoice` tipo PURCHASE
legado que usa `treasury.service.getObligations` — hallazgo documentado, no corregido, fuera de
alcance de esta sesión) y explota la nómina **una línea por empleado**. Campos bancarios
estructurados nuevos en `Supplier`/`Employee` + tabla `CashManagementExport` de auditoría. Pestaña
nueva "📁 Cash Mgmt" en Tesorería.

**Bug real encontrado y corregido de paso**: el schema Zod compartido de KYC
(`uafe-kyc.schema.ts`) descartaba silenciosamente los 3 campos bancarios nuevos del formulario de
Proveedor (modo "strip" por defecto de `z.object()`) — la UI los mostraba llenos pero se guardaban
`null`. Se detectó al verificar e2e (payload correcto en la red, pero `null` en la BD) y se agregó
al schema compartido con test dedicado para que no se repita con un campo futuro.

690/690 backend (12 motor + 5 integración + 4 del schema Zod, todos nuevos) + 117/117 frontend,
`tsc --noEmit` limpio en ambos.

**Verificado e2e real en el navegador** (datos de prueba revertidos): proveedor con datos
bancarios vía KYC wizard, factura de compra confirmada contra él, archivo generado con esa línea;
empleado con banco propio + período de nómina POSTED, archivo PRODUBANCO de 2 líneas
(proveedor $115.00 + empleado $436.50 = $551.50) con formato interbancario correcto e historial de
lotes con las 2 generaciones. La BD demo no tenía NINGUNA cuenta bancaria ni bodega — se crearon
como infraestructura base (no se revirtieron, la empresa las necesita para cualquier prueba
futura).

**Quedó pendiente / decisión del usuario**: del backlog 05-07 quedan: conector biométrico en
línea, multi-moneda con revalorización, liquidación automática de décimos, más presets de banco.
Hallazgo sin resolver (mencionado arriba): `getObligations()`/`registerTransaction` de
`treasury.service.ts` para `AP_INVOICE` leen el modelo `Invoice` legado en vez de `SriDocument`
real — mismo cluster de deuda técnica que `POST /sri/:id/pay` y `FinancialPage.tsx` huérfana
(CLAUDE.md §7). No se tocó por ser una refactorización más grande y no pedida.

**Próximo paso sugerido**: seguir con el resto del backlog 05-07, o preguntar al usuario si quiere
abordar ahora el cluster de deuda técnica Tesorería↔CxP legado (`Invoice` vs `SriDocument`) antes
de seguir sumando features nuevas sobre una base parcialmente desalineada.

---

## 2026-09-12 — 05-07 §3: Feriados nacionales y jornada nocturna
**Se hizo**: siguiente ítem de la lista ordenada (05-07, ítem 3). Ver
[[05-07-tesoreria-nomina-biometrico]] §4.10 para el detalle completo.

Eran **dos huecos que pagaban de menos al trabajador**: (1) `classifyDay` solo trataba sábado y
domingo como descanso obligatorio, así que un 1 de mayo en viernes trabajado se pagaba como
jornada ordinaria en vez de extraordinaria al 100%; (2) la jornada nocturna (19h00–06h00, +25%
por CT art. 49) simplemente no existía.

- `holidays.engine.ts` (motor puro): Pascua por Meeus/Jones/Butcher + los 11 feriados nacionales,
  incluidos los **móviles** (Carnaval lunes/martes y Viernes Santo se derivan de la Pascua).
- Tabla **`Holiday` por empresa y editable** (migración `holidays_night_shift`). Decisión de
  diseño: el calculador **solo propone**, porque el Ejecutivo traslada feriados por decreto cada
  año y cada cantón tiene fiestas locales — la última palabra es lo que confirme TTHH.
- `night-shift.engine.ts` (motor puro): solape con la ventana nocturna recorriendo la ventana de
  cada día que toca el turno (soporta cruce de medianoche), y el recargo **topado a las horas
  ordinarias** porque las suplementarias/extraordinarias nocturnas ya cobran su 50%/100%.
- Nuevo tipo de novedad `RECARGO_NOCTURNO`, que paga **solo el 0.25** (no 1.25): la hora ya está
  dentro del sueldo mensual, a diferencia de las horas suplementarias/extraordinarias que son
  adicionales a la jornada. Es el error fácil de cometer acá.
- RBAC: los feriados son calendario laboral, así que los gestiona **TTHH** (mismo patrón que
  turnos y organigrama), declarados antes del gate de `PAYROLL_ROLES` para que TTHH no herede
  acceso a sueldos.
- UI: panel colapsable "Feriados {año}" en `/nomina/asistencia` + columna "Nocturnas (+25%)" y
  badge de feriados trabajados en el resumen mensual.

**Bug real encontrado y corregido de paso**: el import del biométrico **descartaba como
"marcaciones inválidas" todo turno nocturno** escrito `22:00;06:00` — el reloj exporta UNA fecha
con dos horas, así que la salida parecía anterior a la entrada. Sin esto la feature nueva no
habría servido para el caso de uso principal (turno de noche). Ahora, si la salida ≤ entrada, se
asume cruce de medianoche. Tiene test propio para que no se vuelva a romper.

669/669 backend (24 tests de motor + 6 de integración nuevos) + 117/117 frontend, `tsc` limpio.
Se actualizaron 3 asserts previos de `treasury-calc.test.ts` que fijaban la forma exacta del
retorno de `classifyDay` (ahora incluye `nightSurcharge`).

**Verificado e2e real en el navegador** (datos revertidos): sembré los 11 feriados de 2026 desde
la UI y los días de la semana salieron correctos (Carnaval lun 16-feb, Viernes Santo vie 03-abr);
importé 3 marcaciones incluyendo una 22:00→06:00, y el resumen mostró **2h suplementarias + 8h
extraordinarias (el feriado del 1-may) + 7h nocturnas** con las 3 novedades generadas en el rol.
Valorización comprobada contra la BD con hora de $2.00: feriado $32.00, suplementarias $6.00,
recargo nocturno $3.50.

**Quedó pendiente / decisión del usuario**: del backlog 05-07 quedan archivos Cash Management por
banco, conector biométrico en línea, multi-moneda con revalorización, liquidación automática de
décimos y más presets de banco.

**Próximo paso sugerido**: seguir con el ítem 2 de 05-07 (archivos Cash Management por banco) o
saltar al siguiente módulo de la lista del usuario (06 Contabilidad: Form 101 anual, diferidos,
reverso contable de NC de compra).

---

## 2026-09-12 — 05-07 §1: Subcuentas bancarias en el plan de cuentas
**Se hizo**: siguiente ítem de la lista ordenada del usuario (05-07 Tesorería/Nómina, ítem 1 de
su backlog): **subcuentas bancarias en el plan**. Ver [[05-07-tesoreria-nomina-biometrico]] §4.9
para el detalle completo.

El problema real: **todo** movimiento de Tesorería (pago a proveedor, cobro de cliente, nómina,
SRI/IESS) contabilizaba contra la MISMA cuenta CASH del posting setup (10101), así que el Mayor
no decía en qué banco se movió el dinero — con 3 bancos, la cuenta de efectivo era un agregado
inútil para conciliar.

- Motor puro `treasury/engines/bank-subaccount.engine.ts` (12 tests): siguiente código libre
  bajo la cuenta CASH (arranca en `02`, `01` es caja general por convención, y rellena huecos),
  validación de que la subcuenta **cuelgue de la cuenta CASH** (si no, el Balance dejaría de
  cuadrar — es la regla dura), y nombre sugerido con la cuenta enmascarada.
- `BankAccount.glAccountCode/glAccountName` nullable (migración `bank_account_gl_subaccount`):
  **sin configurar, el comportamiento es idéntico al anterior**, así que nada cambia para las
  empresas existentes hasta que lo activen.
- `bank-gl-account.service.ts`: al asignarla, **da de alta la cuenta en el plan de la empresa**
  con `parentId` → cuenta CASH y `level` = padre + 1, de modo que la balanza por nivel la
  consolide en 10101. Quitarla NO borra la cuenta del plan (tiene asientos históricos).
- `journal.service.ts`: nuevo resolvedor `cashAcct(companyId, bankAccountId?)`, usado por los 4
  asientos que nacen de Tesorería; `registerTransaction` y `payPeriod` reenvían el banco usado.
- UI: subcuenta visible con Asignar/Cambiar/Quitar en cada tarjeta de Tesorería → 🏦 Cuentas.

639/639 backend (12 tests de motor + 7 de integración con BD real nuevos, sin ningún flaky esta
vez) + 117/117 frontend, `tsc --noEmit` limpio en ambos.

**Verificado e2e real en el navegador** (datos de prueba revertidos al terminar): asigné la
subcuenta `1010102` a una cuenta Pichincha desde la UI (el editor precargó código y nombre
sugeridos), cobré una factura real de $460 por Tesorería, y confirmé **consultando la BD** que el
asiento `AST-0006` debitó `1010102 BANCOS - PICHINCHA GL TEST ****5777` en vez de 10101. Además
verifiqué la integridad contable: la balanza agrupada a nivel 3 consolidó los $460 en
`10101 EFECTIVO Y EQUIVALENTES AL EFECTIVO` y el **cuadre del Balance General quedó en 0**.

**Hallazgo de diseño que vale recordar**: la tentación era partir 10101 en hijas dentro del plan
estático `planCuentasSupercias.ts`, pero ese archivo es el plan OFICIAL de la Superintendencia
(Formulario 101) y 10101 es un código regulado de 5 dígitos; inventarle hijas ahí habría
afectado a TODAS las empresas y desalineado el Formulario 101. La solución fue dejar el plan
oficial intacto y dar de alta las subcuentas **por empresa** en `FinanceChartOfAccounts` al
momento de configurarlas, que es justo lo que haría un contador al abrir una cuenta bancaria.

**Quedó pendiente / decisión del usuario**: el resto del backlog 05-07 en su orden — archivos
Cash Management por banco, feriados nacionales + jornada nocturna (+25%) en `classifyDay`,
conector biométrico en línea, multi-moneda con revalorización, liquidación automática de décimos,
más presets de banco.

**Próximo paso sugerido**: seguir con el ítem 2 de 05-07 (archivos Cash Management por banco para
pagos masivos) o, si se prefiere algo de menor riesgo y más valor inmediato, el ítem 3 (feriados
nacionales + jornada nocturna en `classifyDay`, que hoy paga mal las horas de un feriado).

---

## 2026-09-12 — 03b: Reproceso automático desde disposición REWORK
**Se hizo**: se retomó la lista ordenada original del usuario (pausada por el pedido de
logística) en el punto donde quedó: **03b Calidad/Producción → reproceso automático desde
disposición REWORK** (ver [[03b-produccion-calidad]] §6).

- Motor puro `rework.engine.ts` (`src/services/engines/`): `shouldCreateReworkOrder` decide
  si el avance de una no conformidad debe disparar la creación de una orden de reproceso
  (exactamente al entrar a `IN_PROGRESS` con disposición `REWORK`, idempotente — nunca dos
  veces para la misma NC, y no dispara sin una orden de producción origen de la que copiar
  producto/BOM/bodega); `resolveReworkQuantity` calcula la cantidad (la declarada en la NC o el
  lote completo). 9 tests nuevos (`tests/rework-engine.test.ts`).
- Schema: `NonConformity.affectedQuantity` (opcional, declarable al registrar la NC) +
  `NonConformity.reworkOrderId` ⟷ `ProductionOrder.reworkFor` (relación 1:1 con nombre propio,
  trazabilidad bidireccional real, no solo un comentario). Migración `nonconformity_rework_order`
  — misma trampa EPERM ya conocida al regenerar el cliente Prisma (el backend real en el puerto
  5001 sigue fuera de mi control esta sesión), confirmada benigna otra vez (`tsc` limpio, tipos
  correctos, motor de consultas sin cambios).
- `nonconformity.service.ts`: `updateNonConformity` ahora llama a `createProductionOrder`
  (reutilizada de `production.service.ts`, sin duplicar numeración `PROD-`/expansión de BOM)
  cuando el motor puro lo autoriza.
- UI (`QualityPanel.tsx`): campo "Cantidad afectada" en el modal de alta de NC; banner
  "🔁 Reproceso generado automáticamente: orden PROD-XXXX (Planificada)" en el modal CAPA, con
  el selector de disposición bloqueado una vez creado el reproceso (evita reabrir la decisión
  a medias).

620/620 backend (1 test de integración SRI flaky de siempre — confirmado que pasa solo, no es
regresión) + 117/117 frontend, `tsc --noEmit` limpio en ambos.

**Verificado e2e real en el navegador**: sembré un producto + orden de producción COMPLETADA en
cuarentena (revertido al terminar), registré una NC con cantidad afectada = 30 (de un lote de
100), avancé el CAPA a "En tratamiento" con disposición Reproceso, y confirmé por la respuesta
real de la API (no solo la UI) que se creó `PROD-0001` PLANNED con `quantity: "30"` y la nota
`"Reproceso automático por no conformidad RNC-0001: ..."` — reabrí el modal y el banner de
reproceso ya generado se mostró correctamente con el selector de disposición bloqueado.

**Quedó pendiente / decisión del usuario**: siguen sin resolver del backlog 03b: calibración de
equipos (ISO 9001 §7.1.5), inspección de recepción de OC, firma electrónica del liberador,
auditorías internas/control de documentos, trazabilidad hacia adelante por cliente. También
quedaron pendientes de la sesión de logística: catálogo real de transportistas, POD con
firma/foto, logística inversa, gestión de flota propia.

**Próximo paso sugerido**: seguir con la siguiente brecha en el orden que dio el usuario —
tras 03b sigue 05-07 Tesorería/Nómina (o preguntar si prefiere seguir dentro de 03b con otra de
sus brechas).

---

## 2026-09-12 (sesión más reciente) — Enlace público de rastreo de envíos
**Se hizo**: pedido del usuario fuera de la lista ordenada previa ("mejora la integración de
logística"). Se aclaró el alcance con dos rondas de preguntas: (1) frente al documento
`04b-logistica-vs-mercado.md` (que documenta que Logística no es un módulo propio, vive dentro
de Ventas, y lista brechas frente al mercado 2026), el usuario eligió **portal de tracking para
el cliente**; (2) al descubrir que no existe NINGÚN portal de clientes (el `/portal` actual es
solo de proveedores — RFQs/cotizaciones/órdenes, con su propio JWT), se ofreció la alternativa
liviana de un **enlace público de rastreo sin login** (patrón Servientrega/DHL) en vez de
construir un portal de clientes completo con auth propia (módulo aparte, mucho más grande) — el
usuario confirmó la opción liviana.

Implementado ([[04-ventas]] y `04b-logistica-vs-mercado.md` actualizados):
- `Shipment.publicToken` (migración `shipment_public_tracking`): UUID opaco separado de
  `trackingNumber` porque ese último es único SOLO por empresa (colisionaría en una URL pública
  global entre dos empresas distintas).
- `POST /logistics/shipments/:id/tracking-link` (autenticado, staff): genera/recupera el token
  bajo demanda.
- `GET /api/public/tracking/:token` (público, `publicTrackingLimiter`, montado ANTES del router
  autenticado de logística en `app.ts`, mismo patrón que los webhooks de couriers): devuelve
  datos LIMITADOS (sin notas internas de los eventos, sin datos de otra empresa) por diseño.
- `PublicTrackingPage.tsx` en `/rastreo/:token` — ruta sin `<AppRoute>` (sin sidebar, sin login),
  con su propio cliente axios sin interceptores (`api/public-tracking.ts`) para no arrastrar el
  token/refresh de KallpaPro ni redirigir a `/login` en un 401. Se excluyó también del asistente
  IA flotante (`AiAssistantWrapper` en `App.tsx`) — bug real encontrado y corregido: sin la
  exclusión, un visitante que compartiera navegador con un usuario logueado vería el widget en
  una página pensada para verse sin cuenta.
- Botón "🔗 Copiar enlace de rastreo" en `ShipmentDetailPage.tsx` (solo envíos de venta).

**Migración con la misma trampa EPERM ya documentada**: el backend real en el puerto 5001 (fuera
del control de esta sesión) bloqueó de nuevo `prisma generate` en el paso de copiar el binario
del query engine — igual que en la sesión anterior (routeZone/routeSequence), la migración SQL y
los tipos TS se aplicaron bien antes de fallar en ese paso cosmético; `tsc --noEmit` limpio y
611/611 tests (1 test flaky de siempre, confirmado no-regresión corriéndolo solo) lo confirman.

Verificado e2e real: sembré un cliente+pedido+envío de prueba con 3 eventos de tracking
(revertido al terminar), generé el link desde el detalle del envío, lo abrí en una pestaña nueva
del navegador (sin sesión) y confirmé que renderiza completo sin login; probé también un token
inválido (mensaje de fallback correcto) y confirmé que el asistente IA NO aparece en la página
pública tras el fix.

**Quedó pendiente / decisión del usuario**: el resto de brechas de `04b-logistica-vs-mercado.md`
sin resolver (catálogo real de transportistas con tarifario/SLA — hoy `CARRIERS` es un array fijo
en el frontend; POD con firma/foto; logística inversa formal; gestión de flota propia). También
sigue pendiente retomar la lista ordenada original del usuario (03b Calidad/Producción en
adelante) que quedó pausada por este pedido.

**Próximo paso sugerido**: confirmar con el usuario si retomar la lista ordenada original
(03b: reproceso automático desde disposición REWORK) o seguir profundizando en Logística.

---

## 2026-09-12 (sesión más reciente) — D3: Pivot/Gráfico genérico (diario y ventas)
**Se hizo**: el usuario pidió recorrer en orden el backlog restante (D3 del plan Odoo 18, luego
las brechas sueltas por módulo) e ir tachando cada mejora conforme funcione. Se cerró **D3**:
- Motor puro `pivot.engine.ts` (`src/services/engines/`, nuevo — genérico, sin BD): agrupa filas
  planas por dimensión de fila y opcionalmente columna, agrega sum/count/avg. 5 tests nuevos
  (`tests/pivot-engine.test.ts`).
- `pivot.service.ts`: aplana `JournalEntry+JournalEntryLine` (dims cuenta/nombre/origen/estado/mes,
  medidas debe/haber) y `SalesOrder+SalesOrderItem` (dims cliente/producto/estado/mes, medidas
  monto/cantidad) — ambos filtrados por `companyId`.
- `pivot.controller.ts` + `GET /financial/pivot/journal` y `GET /sales/pivot` (rutas de solo
  lectura, sin gate extra — mismo patrón que el resto de GETs de esos routers).
- Frontend: `<PivotView/>` genérico (`components/common/`) con selectores Fila/Columna/Medida/
  Agregación + toggle Tabla/Barras/Líneas (recharts, ya instalada); montado como pestaña "Pivot"
  en [[06-contabilidad]] (`ContabilidadPage.tsx`, junto a "Asientos") y en [[04-ventas]]
  (`SalesPage.tsx`, junto a "Dashboard").

605/605 backend (600+5 nuevos) + 117/117 frontend, `tsc --noEmit` limpio en ambos. Verificado
e2e en el navegador real (login admin@gmail.com): ambas pestañas cargan, los selectores cambian
los `GET` correctamente (200 OK, payload correcto), tabla/barras/líneas renderizan sin errores de
consola. **La BD demo está actualmente vacía** (`journalEntry` y `salesOrder` en 0 filas — mismo
patrón errático que [[entorno-bd-reiniciada-2026-09-11]], no un bug de esta sesión) así que no se
pudo ver una tabla dinámica con datos reales poblada; la respuesta vacía es correcta (200 OK,
`rowKeys: []`), confirmado consultando la BD directamente con Prisma.

Se marcó D3 ✅ en `plan-mejoras-odoo18.md` (queda solo D1 y D2 en el backlog Odoo) y se documentó
en [[06-contabilidad]] y [[04-ventas]].

**Quedó pendiente / decisión del usuario**: la BD demo sigue vacía — antes de seguir con las
brechas de "Brechas activas por módulo" (03b calidad/producción, 05-07 tesorería/nómina, etc.)
convendría re-poblarla con datos de prueba para poder verificar e2e con datos reales, no solo con
respuestas vacías. El pedido del usuario fue "procede en ese orden a mejorar" sobre una lista
larga de brechas — cada una es un ciclo completo (motor+tests+servicio+UI+e2e+docs), así que se
seguirá una por sesión/turno en vez de todas de una vez.

**Actualización — misma sesión**: se resolvió también la siguiente brecha de la lista en orden:
**página de detalle de cotización** (`/sales/quotations/:id`, [[04-ventas]]). Antes solo existía
la fila en la tabla de Cotizaciones; el backend ya soportaba Chatter/Actividades para
`SALES_QUOTATION` desde A2.2 pero no había vista. `QuotationDetailPage.tsx` nuevo: header con
estado, aprobar/rechazar (`PENDING_APPROVAL`), convertir a pedido, cliente, ítems, totales,
notas, `<Activities/>` y `<Chatter/>` — reusa 100% de endpoints ya existentes (`salesApi`), sin
tocar backend. Se sembró un cliente+producto de prueba temporal (revertido al terminar) para
poder verificar e2e real en el navegador dado que la BD demo está vacía: creó COT-0001, se
convirtió a PV-0001 y navegó correctamente — flujo completo confirmado.

**Actualización 2 — misma sesión**: se resolvió también **planificación de rutas de despacho**
(`/logistica/rutas`). El usuario eligió explícitamente la versión simple frente a ruteo
optimizado con mapas (pregunta directa, ver [[04-ventas]]): agrupador por fecha estimada + zona
(ciudad del cliente o `routeZone` manual si la ciudad no alcanza), asignación de transportista y
reordenamiento manual (drag-and-drop) de la secuencia de visita dentro de cada grupo — sin
geocodificación ni algoritmo de optimización. Requirió migración (`Shipment.routeZone` +
`Shipment.routeSequence`); el backend real en el puerto 5001 (proceso fuera del control de esta
sesión — `Stop-Process` dio "Acceso denegado") bloqueó `prisma generate` con el EPERM ya conocido
en Windows, pero **la migración SQL se aplicó igual** y los tipos TS se regeneraron correctamente
antes de fallar en el paso de copiar el binario del query engine (que no cambia entre
generaciones de la misma versión) — `tsc --noEmit` limpio y 611/611 tests confirman que quedó
funcional pese al EPERM. Nuevo motor puro `route-planning.engine.ts` (6 tests). Verificado e2e
real: sembré un cliente+2 envíos de prueba (revertidos al terminar), la vista los agrupó
correctamente por zona/fecha, asigné transportista por PATCH y confirmé el 200 OK + re-render.

611/611 backend + 117/117 frontend, `tsc --noEmit` limpio en ambos.

**Próximo paso sugerido**: repoblar datos demo de forma permanente (no solo temporal para
verificar) y seguir con la siguiente brecha de la lista del usuario en orden — 03b
Calidad/Producción: reproceso automático desde disposición REWORK.

---

## 2026-09-12 (sesión posterior) — Pestaña "Reporte" + exports PDF/Excel + flujo de efectivo indirecto
**Se hizo**: pedido directo del usuario a partir de una captura de pantalla de Contabilidad
("no veo reporte de balance ahí, agrégale una pestaña que diga reporte... y en flujo de efectivo
la selección de método directo o indirecto"). Fuera del plan SRI (ya completo, ver entrada de
abajo) — es una mejora de UX/reportería sobre lo existente.

1. **Pestaña "Reporte"** en Contabilidad (`ReporteTab`, justo después de "Resumen"): selector de
   3 botones (Balance General / Estado de Resultados / Flujo de Efectivo) que renderiza el
   componente correspondiente — reusa `BalanceSheet`/`IncomeStatement`/`FlujoEfectivoTab` ya
   existentes, sin duplicar lógica ni llamadas a la API.
2. **Descarga PDF y Excel** para los 3 reportes: 6 funciones nuevas en `reports.service.ts`
   (`exportBalanceSheetPdf/Excel`, `exportIncomeStatementPdf/Excel`, `exportCashFlowPdf/Excel`),
   reusando los helpers de PDF (`sectionTitle`/`renderAmountRows`/`addPDFHeader`) que ya existían
   del paquete Supercías, y el patrón de Excel (`styleHeaderRow`) del resto de exports. Botones
   "PDF"/"Excel" agregados junto al CSV que ya tenía cada componente.
3. **Flujo de efectivo — método indirecto (NIC 7)**: `getCashFlowStatement` gana
   `opts.method: 'direct'|'indirect'`. El indirecto reconcilia desde la utilidad neta +
   depreciación del período (créditos a la cuenta mapeada `FIXED_ASSET_ACCUM_DEPRECIATION`) +
   una "variación de capital de trabajo" residual (`operativo directo − utilidad neta −
   depreciación`) — diseño deliberado: el residual GARANTIZA por construcción que el total
   operativo (y la caja final) sea IDÉNTICO al método directo, sin arriesgar una descomposición
   cuenta-por-cuenta que podría desviarse del efectivo real. Verificado con un caso económico
   real (aumento de CxP no pagada → el residual lo absorbe exactamente). Toggle "Método
   directo/indirecto" en la UI de Flujo de Efectivo (visible tanto en su pestaña propia como
   dentro de "Reporte", que reusa el mismo componente).

13 tests nuevos backend (2 `cash-flow-indirect.test.ts` + 3 `financial-report-exports.test.ts`
+ los ya contados de la sesión anterior), tsc limpio en ambos proyectos, 117/117 frontend sin
cambios (no hizo falta test nuevo de UI — son botones que llaman a `financialApi.downloadFile`,
ya cubierto indirectamente).

**Verificado e2e real en el navegador**: los 6 exports (Balance/Resultados/Flujo × PDF/Excel)
devolvieron 200 OK, incluido `cash-flow/export.pdf?method=indirect` y
`cash-flow/export.xlsx?method=indirect`; el toggle cambió correctamente entre método directo
(lista de cobros/pagos) e indirecto (utilidad neta + depreciación + variación de capital de
trabajo) sin recargar la página.

**Hallazgo de entorno**: los servidores Backend/Frontend de una sesión anterior en esta misma
conversación quedaron huérfanos en los puertos 5001/3001 (nodemon/vite siguieron vivos pese a
`preview_stop`) — no se pudieron matar ni con `Stop-Process -Force` ni `taskkill /T /F`
(acceso denegado, corren en un contexto de sandbox distinto). Se reusaron directamente
(seguían funcionando y con HMR aplicando los cambios nuevos) en vez de pelear con los puertos.

**Quedó pendiente / decisión del usuario**: ninguna específica de esta mejora. Backlog general
sigue igual que la entrada anterior (Fase D del plan Odoo, brechas sueltas por módulo).

**Próximo paso sugerido**: preguntar al usuario qué sigue — no hay prioridad obvia marcada.

---

## 2026-09-12 — Plan SRI: Etapas 7 (ATS real) y 8 (NIIF/Supercías) — plan completo
**Se hizo**: a pedido del usuario, se cerraron las 2 etapas que quedaban abiertas del plan
[[plan-contabilidad-tributaria-sri]] — con esto **el plan completo (Etapas 1-8) queda cerrado**.

1. **Etapa 7 (ATS real)**: `electronic-invoice.service.loadInvoiceForSri` (ya existía desde la
   Etapa 3) se exportó y se reusa en `ats.service.ts` — las ventas nacidas de un pedido ahora
   tienen desglose EXACTO de IVA por línea (`computeVentaBreakdownFromLines`, motor puro nuevo)
   en vez de la aproximación `total/(1+tasa)`, que queda como fallback solo para facturas
   manuales sin pedido. Sin migración (el dato ya existía en `SalesOrderItem`/`ShipmentItem`).
2. **Etapa 8 (NIIF/Supercías)**: Estado de Cambios en el Patrimonio (NIC 1) nuevo — motor puro
   `equity-statement.engine.ts` + `accounting.service.getEquityStatement`, con un invariante
   verificado con BD real (`equity.totalFinal === balance.totalPatrimonio`). Notas a los
   Estados Financieros (`FinancialStatementNote`, migración `financial_statement_notes`
   APLICADA). Paquete de exportación: PDF único (Balance+Resultados+Patrimonio+Flujo+Notas) en
   vez de un formato XBRL/Supercías específico sin verificar (decisión documentada en el plan
   §3, mismo límite de siempre: no hay API pública para automatizar la carga al portal).
   Pestaña nueva "Patrimonio y NIIF" en Contabilidad.

Ver [[plan-contabilidad-tributaria-sri]] §4 para el detalle técnico exhaustivo de ambas etapas.

**Hallazgo de entorno recurrente**: la BD volvió a aparecer vacía al generar la migración de la
Etapa 8 (mismo patrón ya documentado en [[entorno-bd-reiniciada-2026-09-11]]) — se resolvió
igual que las veces anteriores (`prisma migrate resolve --applied` para las migraciones
previas). Se recreó la cuenta demo `admin@gmail.com`/`12345678` para el e2e.

595/595 tests backend (+13: 4 ats-engine + 1 integración ATS mixta + 6 equity-statement +
2 financial-statements-package) + 117/117 frontend, tsc limpio en ambos. Nota: `npx jest` con
la concurrencia por defecto mostró 4 timeouts falsos en `electronic-deliveryguide.test.ts`
(contención de conexiones a Postgres, no relacionado con este trabajo) — con
`npx jest --maxWorkers=2` la suite completa pasa limpia; se documentó en `CLAUDE.md` §4.

**Verificado e2e real en el navegador**: aporte de capital ($5000) + venta de enero ($300,
utilidad no cerrada) + aporte adicional ($1000) + dividendo ($200) + venta de febrero ($150)
cargados como asientos manuales reales → la tabla de Cambios en el Patrimonio de febrero mostró
exactamente Capital $5000→$6000, Resultados Acumulados $0→-$200, Total Patrimonio
$5300,00→$6250,00 (cuadra con el cálculo esperado a mano); nota "Políticas contables" creada y
persistida; PDF del paquete NIIF/Supercías descargado con 200 OK. Datos de demostración
transaccionales eliminados después; cuenta admin conservada (recreada en esta sesión por el
hallazgo de entorno de arriba).

**Quedó pendiente / decisión del usuario**: el plan SRI/NIIF no tiene más etapas. Backlog
restante sin decisión: Fase D del plan Odoo (D1 company switcher, D2 dashboard configurable, D3
vista pivot) o las brechas sueltas por módulo listadas en `CLAUDE.md` §7 (Form 101 anual,
diferidos, reverso de NC de compra, comparador de cotizaciones, etc.).

**Próximo paso sugerido**: preguntar al usuario qué sigue — no hay una prioridad obvia marcada,
ver `CLAUDE.md` §7 para las opciones.

---

## 2026-09-11 (sesión posterior 5) — Plan SRI: Etapas 4 (Guía de Remisión), 5 y 6 completas
**Se hizo**: el usuario pidió continuar con las 3 opciones abiertas de la sesión anterior EN
BLOQUE: Guía de Remisión electrónica (resto de la Etapa 4), Etapa 5 (producción+contingencia) y
Etapa 6 (cierre de impuestos). Se cerraron las 3. Con esto, **las Etapas 1-6 del plan
`plan-contabilidad-tributaria-sri.md` quedan completas** — solo faltan la Etapa 7 (ATS con
desglose real) y la Etapa 8 (NIIF/Supercías completo). Ver esa nota (§4) para el detalle
técnico exhaustivo de cada una; resumen aquí:

1. **Guía de remisión electrónica**: modelo nuevo `DeliveryGuide`/`DeliveryGuideItem` ligado a
   un `Shipment` de venta — sin valores monetarios y sin exigir factura sustento AUTORIZADA (a
   diferencia de NC/ND). UI en Logística (`ShipmentDetailPage.tsx`), no en Contabilidad.
2. **Producción + contingencia**: `setAmbiente` ahora exige un comprobante AUTORIZADO en
   Pruebas antes de pasar a Producción (checklist visual nuevo); `tipoEmision`
   NORMAL/CONTINGENCIA expuesto por primera vez; cola de reintentos (`sri-retry.service.ts`,
   mismo patrón perezoso que B3/B4) para comprobantes que quedaron `ENVIADA`/`RECIBIDA`.
3. **Cierre de impuestos automático**: botón "🔒 Cerrar impuestos" en Declaraciones → Form 104,
   reusa el cálculo ya existente, postea el asiento de liquidación de IVA solo si hay A_PAGAR,
   y bloquea el período (mismo `FiscalPeriod` de Sprint 6).

546/546 → 579/579 tests backend (+33: 6 XML guía + 4 mapeo guía + 4 integración guía + 3
tax-closing + 3 fiscal-config ampliados + 2 sri-retry, más 2 tests preexistentes corregidos que
asumían poder pasar a Producción sin comprobante autorizado) + 117/117 front, tsc limpio en
ambos.

**Hallazgo de entorno recurrente**: la base de datos volvió a aparecer completamente vacía DOS
veces más durante esta sesión (después de cada `prisma migrate deploy`/reinicio del backend),
pese a que el contenedor Docker no se reinició (`StartedAt` sin cambios) y el volumen
`postgres_data` está correctamente declarado como named volume en `docker-compose.yml`. Esto ya
no parece ser un evento aislado — ver [[entorno-bd-reiniciada-2026-09-11]] (memoria). Vale la
pena investigarlo a fondo en una sesión dedicada si se repite otra vez, en vez de seguir
recreando la cuenta demo cada vez.

**Verificado e2e real en el navegador** (recreando la cuenta demo `admin@gmail.com`/`12345678`
y datos mínimos cada vez que la BD apareció vacía): GR-0001 creada desde el modal de un envío
real con panel SRI mostrando "No enviada al SRI" y PDF descargado (200 OK); Form 104 con $30 de
IVA a pagar → botón "Cerrar impuestos" → asiento AST-0001 contabilizado y período bloqueado;
checklist de producción mostrando ✓/○ por ítem; toggle de contingencia funcionando en ambos
sentidos. Datos de demostración transaccionales eliminados después; cuenta admin conservada.

**Quedó pendiente / decisión del usuario**: Etapa 7 (ATS con desglose real de impuestos por
línea, ahora posible porque el XML de factura SÍ desglosa IVA) o Etapa 8 (NIIF/Supercías
completo: notas a los estados financieros, estado de cambios en el patrimonio, paquete de
exportación Supercías). Ninguna depende de la otra.

**Próximo paso sugerido**: preguntar al usuario si sigue con la Etapa 7, la Etapa 8, o pasa a
otra área del backlog (guía de remisión y todo el plan SRI de comprobantes ya está agotado).

---

## 2026-09-11 (sesión posterior 4) — Etapa 4 del plan SRI: Nota de Débito electrónica
**Se hizo**: continuación del plan SRI, eligiendo entre las 3 opciones abiertas de la sesión
anterior ("resto de la Etapa 4 — ND y guía de remisión"). Se cerró la **Nota de Débito
electrónica** completa (queda pendiente solo la guía de remisión, que requiere otro modelo
nuevo). Ver [[plan-contabilidad-tributaria-sri]] §4 para el detalle técnico completo.

Modelo nuevo `DebitNote`/`DebitNoteConcept` (no existía nada de ND antes de hoy): a diferencia
de la NC, no toca stock/COGS (no hay devolución de mercadería) y no tiene `detalles` con
cantidad/producto sino `motivos` (razón + valor) con una tarifa de IVA única — así lo exige el
esquema real del SRI para este comprobante. Motores puros `nota-debito-xml.engine.ts` +
`debitnote-to-nd.engine.ts` (mismo patrón que NC), servicio `electronic-debitnote.service.ts`
(mismo patrón que `electronic-creditnote.service.ts`, exige factura sustento `AUTORIZADA`),
asiento propio `createDebitNoteEntry` (DR CxC / CR Otros ingresos + IVA débito). RIDE en PDF con
tabla de motivos. Frontend: `<SriEmissionPanel/>` ganó `kind: 'debitNote'`, botón/modal/tabla en
`InvoiceDetailPage.tsx`, smart button y fila en el estado de cuenta CxC. 546/546 back (+4) +
117/117 front, tsc limpio en ambos.

**Hallazgo de entorno importante** (no relacionado con este trabajo): la base de datos estaba
completamente vacía al empezar la sesión (0 companies, 0 usuarios) — el contenedor
`kallpapro-db` se reinició en algún punto sin volumen persistente. Además la tabla
`_prisma_migrations` estaba vacía pese a que el schema ya tenía 29 migraciones previas
aplicadas físicamente; se resolvió con `prisma migrate resolve --applied` antes de aplicar la
migración nueva. Se recreó la cuenta demo documentada (`admin@gmail.com`/`12345678` vía
`/api/auth/register`) para poder verificar e2e en el navegador — **la BD demo real quedó vacía
de resto de datos** (sin productos/clientes/pedidos de ejemplo más allá de la cuenta admin), a
diferencia de sesiones anteriores. Si la próxima sesión necesita datos de ejemplo (inventario,
pedidos, empleados...), hay que recrearlos o correr un seed si existe uno.

**Verificado e2e real en navegador**: se creó una factura+ND de demostración ($20 + 15% IVA =
$23.00 total), el asiento AST-0001 quedó cuadrado (DR CxC $23 = CR Otras Rentas $20 + CR IVA
débito $3), el PDF (RIDE) se descargó con 200 OK, y el panel SRI mostró "No enviada al SRI"
correctamente (no se emitió al SRI real para no gastar un secuencial de producción sin
necesidad). Datos de demostración transaccionales eliminados después; la cuenta admin se dejó
activa por ser la credencial documentada del proyecto.

**Quedó pendiente / decisión del usuario**: guía de remisión electrónica (Etapa 4, requiere
modelo nuevo — `Shipment` no es un comprobante SRI), Etapa 5 (producción+contingencia), o Etapa
6 (cierre de impuestos automático, no depende de las anteriores). También: recrear datos de
ejemplo en la BD demo si se necesitan para otra verificación e2e.

**Próximo paso sugerido**: a decisión del usuario — completar guía de remisión, Etapa 5, o
Etapa 6. Ver [[plan-contabilidad-tributaria-sri]] §2.

---

## 2026-09-11 (sesión posterior 3) — Etapa 4 del plan SRI: Nota de Crédito electrónica + RIDE
**Se hizo**: continuación directa ("sigue con la etapa 4 del plan SRI") de
[[plan-contabilidad-tributaria-sri]]. Cerrada la parte de **Nota de Crédito electrónica** de la
Etapa 4 (ND y guía de remisión quedan para después, son modelos nuevos que no existen hoy) y,
de paso, el **RIDE en PDF** con clave de acceso + código de barras (no estaba en el alcance
original de la etapa, pero es el complemento natural).

Backend: `CreditNote` ganó los mismos 12 campos SRI que `Invoice` (Etapa 3); `SriTransmission`
se generalizó (`invoiceId` nullable + `creditNoteId` nuevo, exactamente uno seteado, validado
en servicio no en BD — para no atar el schema a la lista de tipos de comprobante que seguirá
creciendo). Motores puros `nota-credito-xml.engine.ts` (con el bloque `docModificado` — el
"documento sustento" que el PDF de NC ya imprimía desde Sprint 4, ahora es dato tributario
real) y `creditnote-to-nc.engine.ts`. Servicio `electronic-creditnote.service.ts`: mismo
patrón exacto que `electronic-invoice.service.ts` (duplicado a propósito, no una abstracción
genérica sobre dos entidades con relaciones distintas), con el requisito propio de la NC: la
factura sustento debe estar `AUTORIZADA` antes de poder emitir. RIDE: se instaló `bwip-js`
(MIT, Code128 puro JS — mismo criterio que adoptar `ec-sri-invoice-signer` en la Etapa 2, no
reinventar la generación de barcodes); el bloque SRI del PDF solo aparece si el comprobante
tiene `claveAcceso` real (uno no emitido electrónicamente sigue viendo su PDF interno de
siempre). Migración `sri_credit_note` APLICADA — esta vez sí topó con el EPERM real del
`.dll.node` (nodemon bloqueándolo), resuelto deteniendo el preview del backend antes de
`prisma generate`, tal como documenta `CLAUDE.md`.

Frontend: `<SriEmissionPanel/>` generalizado con prop `kind: 'invoice'|'creditNote'` (antes
solo servía facturas), montado como fila expandible en la tabla de notas de crédito del
detalle de factura. 542/542 back (+22) + 117/117 front, tsc limpio en ambos.

**Verificado e2e real en navegador** (no solo tests): se armó una factura+NC de demostración
con estado AUTORIZADA simulado directamente en BD (para no gastar otra llamada real al SRI —
el circuito de envío/autorización ya se validó a fondo en la Etapa 3 y con la suite
automatizada de esta etapa, que sí ejercita `sendRecepcion`/`sendAutorizacion` mockeados). El
RIDE de ambos comprobantes se descargó como PDF real con clave de acceso y código de barras
visibles (enviados al usuario para inspección visual), y la fila expandible de la NC mostró
correctamente el estado "No enviada al SRI" con el selector de punto de emisión y el botón
"Emitir al SRI" — no se hizo clic para no volver a golpear el SRI real sin necesidad. Datos de
demostración eliminados después.

**Quedó pendiente / decisión del usuario**: Nota de débito y guía de remisión electrónicas
(ambas requieren modelo de datos nuevo, no existe ninguno hoy). Producción + contingencia
(cola de reintentos) sigue siendo la Etapa 5.

**Próximo paso sugerido**: a decisión del usuario — Etapa 5 (producción + contingencia),
completar el resto de la Etapa 4 (ND/guía), o el cierre de impuestos automático (Etapa 6, no
depende de las anteriores). Ver [[plan-contabilidad-tributaria-sri]] §2.

---

## 2026-09-11 (sesión posterior 2) — Propuestas de Mejora e Integración LOGIFI: 6 brechas cerradas
**Se hizo**: el usuario pidió implementar `Claude outputs/propuestas-mejora-integracion-modulos-erp.md`
(auditoría previa del código real que cerró varias brechas de la bitácora anterior — CxP/CxC y
SRI ya resueltos — y dejó 6 pendientes reales, priorizadas en su §10). Se cerraron las 6:
1. **CRM → Ventas** (la de mayor impacto, según el propio documento): deal ganado genera la
   cotización sola. `CrmDeal.customerId`/`salesQuotationId` + `CrmDealItem` (productos
   conversados); `updateDealStage` dispara `tryAutoConvertOnWon` no bloqueante al ganar; botón
   manual "Generar cotización" en `DealsPage` en cualquier etapa. Cliente emparejado por RUC →
   email → razón social exacta (nunca por nombre parecido). Ver [[10-crm]] / [[04-ventas]].
2. **Cobranza automática (dunning)**: escalones configurables (3/15/30 días → EMAIL/WHATSAPP/
   CALL) corren a diario o a demanda, registran `CollectionActivity` automática en el MISMO
   radar que la gestión manual. EMAIL vía SendGrid si está configurado. Ver
   [[08-analisis-financiero-cxp-cxc]].
3. **Webhooks de couriers**: endpoint público con token por empresa (rotable), normaliza
   cualquier payload de courier por alias de campo, reusa `addShipmentEvent` — misma
   facturación al entregar, alerta automática (`Activity`) al fallar. Ver [[04-ventas]].
4. **Costo real de flete** por envío (`Shipment.freightCost`). Ver [[04-ventas]].
5. **Participación de utilidades (15%, art. 97 CT)**: motor puro + panel de solo-cálculo en
   Nómina. Ver [[05-07-tesoreria-nomina-biometrico]] §4.8.
6. **"Mis permisos"**: panel en Seguridad derivado de las reglas CASL reales del rol (mismo
   dato que `authorize()` aplica, nunca se desincroniza). Ver [[09-ux-transversal]].

Backend: `deal-conversion.engine/service.ts`, `dunning.engine/service.ts` + `lib/mailer.ts` +
`jobs/dunning.job.ts`, `carrier-webhook.engine.ts` + `logistics-webhook.service.ts`,
`utilidades.engine.ts` + `payroll/utilidades.service.ts`, `auth/permissions-matrix.ts`.
Migración `logifi_integraciones` APLICADA (`CrmDealItem`, `CrmDeal.customerId/salesQuotationId`,
`Shipment.freightCost`, `CollectionActivity.automated/dunningStep`) — generada con `migrate
diff --from-url ... --script` + `migrate deploy` (mismo truco que la sesión anterior: `migrate
dev` exige TTY en este entorno). 529/529 back (+33: 27 motores + 6 integración con BD real) +
117/117 front, tsc limpio en ambos.

**Verificado e2e real en navegador** (no solo tests): (a) oportunidad demo real → agregué
productos → "Generar cotización" → COT-0003 creada con el cliente correcto emparejado por RUC
("Constructora Andes", sin duplicar) — revertido después (cotización borrada, deal restaurado
sin items/cliente, era la única oportunidad demo de la empresa); (b) panel de utilidades con
los 3 empleados demo reales: $100,000 de utilidad → $15,000 a repartir, tabla por trabajador
correcta (María Paredes 365d/2 cargas → $10,062.41; Luis Vera 356d/0 cargas → $4,937.59); (c)
"Mis permisos" renderizó la matriz completa para ADMIN; (d) sección de cobranza automática y
webhooks en Ajustes → Empresa: activé ambos, guardé, generé un token real, probé el webhook
real con `curl` (autenticación validada, rechazo esperado por guía inexistente) — **dunning y
webhookToken revertidos a su estado original (deshabilitados)** después de verificar, porque
activarlos de forma permanente es una decisión del usuario, no algo que deba quedar prendido
solo por haberlo probado.

**Quedó pendiente / decisión del usuario**: el propio documento fuente dejaba 2 preguntas sin
resolver que no son de código — si el alcance actual de agentes CRM es el definitivo o se
construye hacia LOGIFI v2 (inbox omnicanal, apps móviles), y si la suscripción por módulo
implica usuario↔empresa N:M (hoy 1:1, mismo tema que D1 del plan Odoo). Comparador de
cotizaciones de proveedores lado a lado y contratos marco (Compras) quedaron fuera de esta
sesión — no estaban en el orden de prioridad del documento. Retroalimentar el lead scoring con
resultados reales de Ventas/Financiero tampoco se abordó.

**Próximo paso sugerido**: a decisión del usuario — quedan las dos preguntas de producto de
arriba, más la Fase D del plan Odoo (`plan-mejoras-odoo18.md`) y la Etapa 4 del plan SRI (RIDE
+ NC/ND electrónicas, `plan-contabilidad-tributaria-sri.md`).

---

## 2026-09-11 (sesión posterior) — Etapa 3 del plan SRI: envío y autorización real
**Se hizo**: continuación directa ("continúa por favor") de [[plan-contabilidad-tributaria-sri]].
Antes de escribir código se verificó el WSDL real del SRI con `curl` (namespaces, nombres de
elementos, hijos sin prefijo) y que la red sale desde este entorno. Backend: 12 campos SRI en
`Invoice` + modelo `SriTransmission` (migración `sri_invoice_transmissions` APLICADA vía
`migrate diff` + `migrate deploy`, porque `migrate dev` exige TTY aquí — patrón reutilizable),
motores puros `sri-soap.engine.ts` e `invoice-to-factura.engine.ts`, transporte
`sri-soap-client.ts`, servicio `electronic-invoice.service.ts` (recepción → autorización con
reintentos, re-emisión con secuencial nuevo, AUTORIZADA inmutable, Chatter con cada cambio de
estado), rutas `/financial/invoices/:id/sri/*`. Frontend: `<SriEmissionPanel/>` en el detalle
de factura. 496/496 back (+28) + 117/117 front, tsc limpio en ambos.

**Verificación real**: se emitió una factura de prueba desde el navegador contra el SRI REAL
(celcer.sri.gob.ec) con el certificado autofirmado: el SRI respondió `DEVUELTA · [35] "No existe
un contribuyente registrado con el RUC 1790012345001"` — exactamente lo esperado con RUC
ficticio, y demuestra que sobre, firma, transporte, parseo, persistencia y UI funcionan de punta
a punta. Datos de prueba borrados, certificado demo desactivado, contadores `SRI_*` limpiados.

**Decisión revisada** (plan §1.3): el asiento contable NO se difiere hasta la autorización del
SRI — se postea al crear la FAC-V- como siempre (COGS ya ocurrió al despachar; las devoluciones
del SRI son técnicas y se re-emiten). Documentado en el plan con las razones.

**Quedó pendiente / decisión del usuario**: para obtener una AUTORIZADA real hacen falta el
RUC real de la empresa y el certificado .p12 real cargados en Contabilidad → Facturación
Electrónica (ambiente Pruebas primero). Las facturas FAC- manuales no se emiten (sin cliente ni
IVA por línea). No hay validación contra el XSD oficial.

**Próximo paso sugerido**: Etapa 4 — RIDE en PDF (reusar el generador de Sprint 5 con clave de
acceso + código de barras) y nota de crédito electrónica (`CreditNote` ya existe; falta el
builder XML `<notaCredito>` y reusar el mismo flujo de emisión). Ver el plan §2.

---

## 2026-09-11 — Etapa 2 del plan SRI: motor de XML + firma XAdES-BES
**Se hizo**: continuación directa de [[plan-contabilidad-tributaria-sri]] (pedido explícito del
usuario: "sigue con la etapa 2, el motor de XML y firma"). Investigado el web service del SRI,
el algoritmo de la clave de acceso (49 dígitos, verificador módulo 11 — mismo que cédula/RUC) y
las librerías Node/TS existentes para XAdES-BES antes de escribir nada propio: se adoptó
`ec-sri-invoice-signer` (MIT, pura TS/JS, sin Java) para la FIRMA — reimplementar XAdES-BES a
mano es exactamente el tipo de criptografía donde un error propio sale carísimo (comprobantes
rechazados en producción), así que se reusa una librería ya escrita para este propósito
específico en vez de fabricar la propia. El armado del XML del comprobante SÍ es código propio
(`factura-xml.engine.ts`): replica el schema oficial `<factura version="1.1.0">`
(infoTributaria/infoFactura/detalles), agrupa el IVA por tarifa, escapa XML correctamente.
Nuevo `clave-acceso.engine.ts` (verificador módulo 11 con tests calculados a mano, no solo
redondos) y `xml-signer.engine.ts` (envoltorio + traducción de errores al español, incluido un
error crudo de node-forge que la librería no tipa). Servicio `sri-preview.service.ts` + botón
"🔏 Probar firma" por punto de emisión en la UI de Facturación Electrónica: firma un comprobante
de EJEMPLO fijo (no un `Invoice` real todavía — esa integración es Etapa 3) con el certificado
real ya cargado en Etapa 1, bloqueado fuera de ambiente PRUEBAS para nunca gastar un secuencial
real de Producción. 468/468 back (+30) + 117/117 front, tsc limpio en ambos.

**Verificación real (no solo tests)**: se cargó un certificado autofirmado de prueba a la
empresa admin vía el endpoint real (`curl` con JWT real de login, no un mock — el
`<input type="file">` del navegador sigue sin poder probarse por la herramienta de
automatización de este entorno) y se hizo clic en "Probar firma" en el navegador real: devolvió
un comprobante firmado con clave de acceso de 49 dígitos y el nodo `<ds:Signature>` XAdES-BES
correcto, visible expandiendo el XML en la propia UI. El certificado de prueba se desactivó
después para no dejar configuración falsa activa.

**Quedó pendiente / decisión del usuario**: no se validó el XML contra el XSD oficial del SRI
(no se descargó el schema en esta sesión) — la cobertura actual son los tests propios de
estructura y cálculo. Sin lógica de envío todavía: nada se manda al SRI real ni al ambiente de
certificación (`celcer.sri.gob.ec`) — eso es la Etapa 3.

**Próximo paso sugerido**: Etapa 3 — `sri-soap-client.ts` (cliente SOAP contra
`celcer.sri.gob.ec`), wiring real de `Invoice` (campos claveAcceso/numeroAutorizacion/sriEstado
etc. descritos en el plan §1.2), y el cambio de regla de negocio de que el asiento contable se
postea solo cuando el SRI autoriza. Ver [[plan-contabilidad-tributaria-sri]] §2.

---

## 2026-09-10 (sesión posterior) — Plan contable/tributario robusto + Etapa 1 (base normativa SRI)
**Se hizo**: pedido directo del usuario — "démosle mucho amor a la contabilidad" (SRI en vivo con
firma electrónica, ATS descargable, NIIF/Supercías robusto). Se investigó (WSDL SRI
pruebas/producción, Ficha Técnica v2.3x, clasificación PYME Supercías) y se creó
[[plan-contabilidad-tributaria-sri]] con 8 etapas. El usuario confirmó: integración SRI
**completa** (firma + envío + autorización, no solo generar XML suelto), ya tiene certificado
.p12 de prueba, y la primera etapa es la **base normativa**.

**Etapa 1 implementada y validada e2e**: modelos nuevos `CompanyFiscalConfig` (RUC, régimen,
ambiente PRUEBAS/PRODUCCION), `Establishment`/`EmissionPoint` (numeración SRI independiente de
la interna FAC-V-####, reusa `getNextDocumentNumber`) y `DigitalCertificate` (.p12 cifrado
AES-256-GCM en reposo, nunca expuesto por ningún GET) — migración `fiscal_config_base`
APLICADA. Motores puros `cert-crypto.engine.ts` (cifrado) y `p12-inspector.engine.ts`
(node-forge: valida contraseña y extrae vigencia ANTES de guardar nada, falla rápido en vez de
descubrirlo el día de firmar una factura real). Pestaña nueva "Facturación Electrónica" en
Contabilidad (`FiscalConfigPanel.tsx`): datos fiscales, cambio de ambiente con confirmación
explícita (bloqueado hasta tener certificado + establecimiento activos), CRUD de
establecimientos/puntos de emisión, carga de certificado. 438/438 back (+15: 8 motor + 7
integración con BD real) + 117/117 front, tsc limpio en ambos. Bug real encontrado y corregido
en el proceso: el regex de validación de RUC exigía 13+3=16 dígitos en vez de 13 totales
(`\d{13}001` en vez de `\d{10}001`) — se descubrió probándolo en el navegador real, no en los
tests (los tests unitarios usaban un RUC que por coincidencia no lo exponía). Verificado e2e en
navegador real (no solo API): guardó datos fiscales de la empresa admin, creó establecimiento
"001 Matriz" y punto de emisión "001", ambos persistidos y visibles tras recargar.

**Quedó pendiente / decisión del usuario**: la carga de certificado `.p12` vía UI se validó por
API/integración (contraseña incorrecta rechazada sin guardar nada; .p12 válido cifrado y
recuperable solo por el firmador interno) pero NO se probó el `<input type="file">` en el
navegador real (la herramienta de automatización de este entorno no soporta adjuntar archivos).
Sin lógica SRI todavía (Etapa 2 en adelante): no se arma XML, no se firma, no se envía nada al
SRI. El RUC/razón social guardados en la empresa admin de desarrollo son de PRUEBA
("1790012345001" / "COMERCIAL KALLPAPRO PRUEBA S.A.") — reemplazar por los datos reales antes
de usar el módulo en serio.

**Próximo paso sugerido**: Etapa 2 del plan — motor de armado de XML (`xml-builder.engine.ts`)
+ firma XAdES-BES (`signer.ts`) contra el certificado ya cargado, todavía sin enviar nada al
SRI. Ver [[plan-contabilidad-tributaria-sri]] §2.

---

## 2026-09-10 — Auditoría del vault + documento de base de datos + regrupación de "terminados"
> ⚠️ Nota de fecha: el reloj del sistema en esta sesión marca 2026-09-10, pero las entradas
> de abajo ya llegan hasta 2026-09-11 — es una inconsistencia del entorno (fechas de sesiones
> distintas no siempre avanzan en el mismo orden que el calendario real), no un error de esta
> entrada. Esta sigue siendo la **más reciente** — va arriba porque es la última sesión
> ejecutada, sin importar la etiqueta de fecha.

**Se hizo**: el usuario pidió verificar que los "nodos" (documentos) del vault estén
correctos, agrupar lo ejecutado como "terminado", e implementar flujo de trabajo/
arquitectura/base de datos/mejoras por módulo, reagrupando todo según su contenido.
- **Auditoría**: esta Bitácora en realidad SÍ estaba al día (tiene una entrada detallada por
  cada sesión desde el 05 hasta el 11 — la corrección es sobre lo que dije al iniciar esta
  entrada). Lo que estaba desincronizado con todo ese trabajo real eran los documentos
  **índice/resumen**, que nadie había vuelto a tocar tras escribirlos la primera vez:
  - [[flujo-trabajo-erp]]: la tabla-índice de módulos seguía diciendo "🟡 A3/A5 pendientes"
    (módulo 9) y "Fase 4-5 pendiente" (módulo 8) pese a que ambos llevan días cerrados —
    corregida contra el contenido real de cada `Modulos/*.md`.
  - [[Arquitectura KallpaPro/Modulos/02-compras|02-compras.md]]: `reqNumber` y B3 seguían
    marcados ❌ aunque `reqNumber` se corrigió antes de julio y B3 se cerró el 09-09 — eran
    directamente información falsa, no solo desactualizada.
  - `CLAUDE.md` §4 (tests 229/229, "Sprint 12 cerrado") y §7 (backlog con A3/A5/C1/C2 como
    pendientes) reescritos con el estado real; ya no hace falta la nota de "esto está
    desactualizado" que había quedado ahí desde el 09-09 — ahora el contenido ES correcto.
  - [[00 - Inicio]]: prioridades reemplazadas — el "próximo paso" ya no lista cosas cerradas.
- **Regrupación de "terminados"** en [[plan-mejoras-odoo18]]: Fases A, B y C marcadas
  `✅ TERMINADO` en sus encabezados y filas C1/C2 (que no tenían el ✅ aunque estaban hechas)
  corregidas. Fase D marcada `🔵 ACTIVA` como la única con ítems pendientes reales. No se
  movió nada a histórico todavía (solo se etiquetó) — queda como candidato para una limpieza
  futura si el usuario lo pide, tal como pauta [[protocolo-mejoras]].
- **Documento nuevo**: [[base-de-datos]] — mapa de los 113 modelos Prisma verificado contra
  `schema.prisma` real (grep, no memoria), agrupado por los mismos dominios que `Modulos/`,
  con el patrón de relación FK vs polimórfica (`entityType`/`entityId`, confirmado en 8+
  modelos reales) documentado explícitamente.

**Corrección durante la propia auditoría**: al listar archivos encontré
[[plan-contabilidad-tributaria-sri]] (creado 2026-09-10, sin indexar en ningún lado) — un plan
activo de 8 etapas para facturación electrónica SRI real (firma + envío SOAP + autorización),
con decisiones YA confirmadas por el usuario y certificado .p12 disponible. Esto vuelve
obsoleto lo que había escrito hace un momento en `CLAUDE.md` §7 y `04-ventas.md` sobre
"facturación electrónica SRI: futuro, no priorizado" — corregido en ambos, y promovido a
primera opción en [[00 - Inicio]] (tiene decisión confirmada, a diferencia de la Fase D).

**Quedó pendiente / decisión del usuario**:
- No se auditaron línea por línea `01-planificacion-presupuesto.md`, `03b-produccion-calidad.md`,
  `10-crm.md` ni `asistente-contable-cxp-cxc-permisos.md` esta sesión (menos probable que hayan
  cambiado, pero no verificado) — confirmar antes de asumirlos 100% vigentes.
- Las tablas de Fases A/B/C en `plan-mejoras-odoo18.md` siguen completas ahí (marcadas pero no
  movidas) — mover a `Documentacion de la Arquitectura Paso a Paso/` queda pendiente si se pide.
- `Credenciales/_Archivo/` sigue sin poder borrarse por el clasificador de seguridad.

**Próximo paso sugerido**: preguntar al usuario si arranca la Fase D (y cuál: D1/D2/D3) o
prefiere seguir cerrando brechas puntuales de módulo — ver [[00 - Inicio]] §Prioridades.

---

## 2026-09-11 (continuación) — C3 (resto): unidad de compra ≠ unidad de venta/stock
**Se hizo**: el usuario pidió continuar con la mitad pendiente de C3 (Fase C del backlog
priorizado) — el estándar negativo de stock ya estaba cerrado en la sesión anterior.
- Schema: `Product.purchaseUnit`/`purchaseConversionFactor` (default `null`/`1`, sin distinción
  configurada = comportamiento previo intacto) y `POItem.purchaseQuantity`/`purchaseUnitLabel`
  (snapshot informativo, regla 4 de trazabilidad). Migración `c3_unidad_compra_venta` APLICADA
  (backend detenido antes por la trampa EPERM conocida).
- Motor puro nuevo `purchase-unit.engine.ts` (11 tests): `purchaseToStockQuantity` (×factor,
  redondeado a entero porque `POItem.quantity` es `Int`), `purchaseToStockUnitPrice` (÷factor,
  redondeado a 2 decimales). Insight que simplificó todo el frontend: como `cantidad×precio`
  es matemáticamente invariante bajo esta conversión (72×$1 = 3×$24), el total de línea nunca
  cambia sin importar en qué unidad ingrese el usuario — no hizo falta tocar ningún cálculo de
  total ya existente.
- `createPurchaseOrder` acepta `items[].quantityUnit: 'PURCHASE'|'STOCK'` (default `STOCK` =
  comportamiento de siempre); si el producto tiene conversión real configurada, convierte antes
  de guardar y deja el snapshot de compra. El resto del flujo (recepción, kardex, costeo) no se
  tocó porque ya recibe todo en unidad de stock — verificado con una prueba de integración que
  recibe una OC creada en CAJA y confirma que el stock sube en UNIDAD correctamente.
- Alcance deliberado: solo Órdenes de Compra, no Requisiciones (esfuerzo/beneficio y la
  limitación de `POItem.quantity: Int`).
- UI: configuración de unidad de compra en la ficha de producto (`ProductDetailPage.tsx`,
  pestaña Editar) + badge "Compra: 1 CAJA = N UNIDAD" en el header; en `NewOrderPage.tsx`,
  selector "CAJA (compra)" / "UNIDAD (stock)" por línea (solo aparece si el producto tiene
  unidad de compra configurada, vuelve a STOCK automáticamente al cambiar de producto); en
  `OrderDetailPage.tsx`, texto "Se compró: N CAJA (M UNIDAD)" bajo el nombre del producto.
- 423/423 tests backend (+11 motor +4 integración con BD real) + 117/117 frontend, `tsc --noEmit`
  limpio en ambos.
- **Verificado e2e real en el navegador**: configuró "Tornillo Inox M6" con CAJA=100 UNIDAD →
  creó una OC nueva con el selector en "CAJA (compra)", 2 CAJA a $500/CAJA → la orden se guardó
  como 200 UNIDAD a $5,00 c/u, total $1000,00 (invariante confirmado) → el detalle de la OC
  mostró correctamente "Se compró: 2 CAJA (200 UNIDAD)". OC de prueba cancelada y configuración
  del producto revertida después (sin afectar su stock/costo real, que quedó exactamente igual).
- Documentación actualizada: [[03-inventario]] (C3 completo), `plan-mejoras-odoo18.md`
  (registro de avance + roadmap: Fases B y C del plan quedan 100% completas).

**Quedó pendiente / decisión del usuario**: ninguna brecha conocida de C3. El backlog priorizado
de Fases A→C del plan Odoo 18 queda cerrado por completo; solo restan los ítems de Fase D
(company switcher, dashboard configurable, vista pivot/gráfico) y "Contable/tributario" (cierre
de impuestos con asiento de liquidación de IVA, comparación entre períodos) — ninguno pedido
todavía por el usuario.

**Próximo paso sugerido**: preguntar al usuario qué sigue — no hay un siguiente ítem obvio de
mayor prioridad ya que el backlog activo (Fases B y C) está agotado.

---

## 2026-09-10 (continuación 2) — B2: Import de extracto bancario OFX/CSV con presets
**Se hizo**: el usuario pidió continuar con B2 del backlog priorizado (Fase B del plan Odoo 18).
- Investigado primero qué ya existía (regla del proyecto: no reconstruir lo que funciona): la
  conciliación bancaria automática/semiautomática de Sprint 9.1 ya estaba completa y probada —
  el gap real era que `ReconciliationPanel` solo aceptaba **pegar texto** en un formato fijo
  propio (`fecha;descripción;referencia;monto`), así que el usuario tenía que reformatear a
  mano el CSV real que exporta su banco antes de poder pegarlo.
- Motor puro `bank-statement-parser.engine.ts` (9 tests): detecta columnas por una lista amplia
  de alias en español, no por acertar el nombre EXACTO de la cabecera (que cambia entre
  versiones del portal bancario y no tenía forma de verificar con certeza) — presets
  **Pichincha** y **Produbanco** (fecha DD/MM/AAAA, columna de valor con signo o débito/crédito
  separados) + **Genérico** (preserva el formato fijo anterior tal cual, sin encabezado, para
  no romper nada) + parser **OFX/QFX** (formato SGML típico de bancos, con tags a menudo sin
  cierre — `<STMTTRN>` sin `</STMTTRN>`).
- Nuevo endpoint `POST /treasury/reconciliation/import-file`: parsea el texto del archivo y
  llama a la MISMA función `reconciliation.importStatement` que ya existía desde Sprint 9.1 —
  cero lógica de conciliación duplicada, el parser solo produce la forma
  `StatementLineInput[]` que el matcher automático/semiautomático ya consumía.
- UI en `TesoreriaPage.tsx` (`ReconciliationPanel`): selector de preset de banco + zona de
  carga de archivo (`.csv/.txt/.ofx/.qfx`, detecta OFX por extensión); el textarea de pegar
  texto se conservó plegado como fallback "Genérico" (compatibilidad hacia atrás).
- 408/408 tests backend (+11: 9 del motor + 2 de integración con BD real, incluyendo
  conciliación automática real por referencia idéntica) + 117/117 frontend, `tsc --noEmit`
  limpio en ambos.
- **Verificado e2e real en el navegador**: un CSV con encabezado `Fecha,Concepto,Referencia,Valor`
  y fechas en formato DD/MM/AAAA (formato real de Pichincha, no el genérico) se importó con el
  preset Pichincha contra una cuenta bancaria real del sistema — las dos líneas aparecieron
  correctamente en el panel de conciliación (fecha convertida, monto con signo, referencia).
  Datos de prueba borrados después.
- Documentación actualizada: [[05-07-tesoreria-nomina-biometrico]] §4.7 (de paso se corrigió
  el backlog de ese documento: el ítem "conciliación bancaria" ya estaba cerrado desde Sprint
  9.1, quedó mal listado como pendiente), `plan-mejoras-odoo18.md` (B2 cerrado).

**Quedó pendiente / decisión del usuario**: más presets de banco a demanda (Banco Guayaquil,
Bolivariano...) — el motor ya soporta agregar uno nuevo solo con su lista de alias de columna.
Solo falta unidad de compra≠venta (mitad pendiente de C3) para cerrar TODAS las Fases B y C del
plan de mejoras Odoo 18.

**Próximo paso sugerido**: unidad de compra≠venta, o retomar Fase D (company switcher,
dashboard configurable, vista pivot/gráfico), a decisión del usuario.

---

## 2026-09-10 (continuación) — ATS: Anexo Transaccional Simplificado
**Se hizo**: el usuario pidió continuar con ATS del backlog "Contable/tributario" de `CLAUDE.md`.
- Investigado el formato público del ATS del SRI: XML mensual con el detalle de compras,
  ventas y retenciones (catálogos de tipo de identificación — RUC/cédula/pasaporte — y tipo de
  comprobante son estables y públicos).
- Motor puro `ats.engine.ts` (11 tests): clasifica identificación (RUC = 13 dígitos terminados
  en 001, cédula = 10 dígitos, resto = pasaporte), mapea tipo de documento al código ATS, y
  aproxima el neto de cada venta con `total/(1+tasa)` — misma limitación ya aceptada en el
  Formulario 104 (`Invoice` no guarda el desglose IVA por línea, así que no hay forma de sacar
  el neto exacto sin ese dato).
- `finance/ats.service.ts` reusa `periodRange`/`ivaRateForDate` de `sri-casillas.service.ts`
  (se exportaron para esto) — misma ventana de fechas y misma tarifa vigente que el 104, para
  no tener dos criterios distintos. Compras exactas desde `SriDocument` CONFIRMED (desglose
  real); ventas aproximadas desde `Invoice`.
- Export XML con la estructura pública de la Ficha Técnica del SRI (sección IVA:
  compras/ventas) — marcado explícitamente, tanto en el propio XML como en la UI, como
  **borrador a validar en DIMM Formularios antes de presentar**. Esto es deliberado: no hay
  forma de garantizar coincidencia byte a byte con el schema oficial sin acceso al validador
  del SRI, así que se es honesto sobre el alcance en vez de sobre-prometer cumplimiento exacto
  — mismo criterio que cualquier software contable comercial (siempre se valida en DIMM antes
  de subir).
- Nueva pestaña "ATS · Anexo Transaccional" en Contabilidad → Declaraciones (junto a 104/103,
  mismo `PeriodPicker`): tablas de detalle compras/ventas + botón "Descargar XML".
- 397/397 tests backend (+15: 11 del motor + 4 de integración con BD real) + 117/117
  frontend, `tsc --noEmit` limpio en ambos.
- **Verificado e2e real en el navegador**: la pestaña ATS renderiza correctamente (estado
  vacío, la BD de desarrollo no tenía documentos confirmados en el período de prueba) y la
  descarga de XML generó un documento bien formado — verificado inspeccionando el contenido
  real de la respuesta HTTP (estructura `<iva><compras>...</compras><ventas>...</ventas></iva>`
  con año/mes/razón social correctos).
- Documentación actualizada: [[06-contabilidad]], `plan-mejoras-odoo18.md`, `CLAUDE.md` §7
  (ATS ya no aparece como pendiente).

**Quedó pendiente / decisión del usuario**: validar el XML generado contra el validador real
de DIMM Formularios con datos de producción reales antes de una presentación oficial — este
export es un borrador que reduce el tipeo manual, no un reemplazo del validador del SRI.

**Próximo paso sugerido**: unidad de compra≠venta, o B2 (extracto bancario OFX/CSV), a
decisión del usuario.

---

## 2026-09-11 (continuación 2) — B4: Activos fijos y depreciación
**Se hizo**: el usuario pidió continuar con B4 del backlog priorizado (Fase B del plan Odoo 18).
- Investigado el método legal en Ecuador: depreciación en línea recta (art. 28 RLRTI) con
  vida útil por categoría (edificios 20 años, vehículos 5, muebles/maquinaria 10, equipo de
  cómputo 3, terrenos no deprecian). Las cuentas NIIF/Supercías correspondientes YA existían
  en el plan de cuentas (1020101-1020110 por categoría de activo, 1020112 depreciación
  acumulada) — solo hizo falta encontrar la cuenta de gasto correcta: **52022101** (Gastos
  Administrativos → Depreciaciones → PPE), no 510401 como se anotó originalmente en el plan
  (esa es costo de fabricación, solo correcta para maquinaria de planta, no para el caso
  general de una PYME depreciando muebles/cómputo/vehículos administrativos).
- Modelo `FixedAsset` (categoría → cuenta + vida útil sugerida automáticamente, costo, valor
  residual, depreciación acumulada, `lastDepreciatedPeriod` para idempotencia, estado
  ACTIVE/FULLY_DEPRECIATED/DISPOSED) — migración `b4_fixed_assets_depreciation` aplicada sin
  problemas.
- Motor puro `computeMonthlyDepreciation` (10 tests): línea recta mensual, capa el último
  período al saldo depreciable restante para no pasarse del costo, terrenos con vida útil 0
  nunca deprecian.
- `generateDueDepreciation` reusa el patrón exacto de B3 (perezoso, sin cron, idempotente por
  período, cada activo se procesa independiente) pero con una diferencia deliberada: el
  asiento se **auto-postea** directo (status POSTED) en vez de quedar `PENDING_REVIEW` como
  las facturas recurrentes — la depreciación es una rutina automática del sistema, no un
  documento que necesite revisión humana, mismo criterio que ya se usa para COGS y asientos
  de venta. Nueva función `journal.service.createDepreciationEntry` + 2 claves nuevas en
  `DEFAULT_MAPPINGS` (regla 3, editables en Ajustes).
- UI en `/contabilidad/activos-fijos` (enlazada en el sidebar bajo Contabilidad): registro de
  activo con categoría que autocompleta cuenta y vida útil sugerida, botón "Correr
  depreciación" con resultado detallado, dar de baja (detiene depreciación futura sin
  revertir lo ya contabilizado — regla 5), tarjetas de costo total/depreciación acumulada/
  valor en libros.
- **Alcance explícito, documentado**: el registro del activo NO contabiliza la adquisición
  (la sigue haciendo la factura de compra normal por su cuenta) — solo genera la depreciación
  mensual. Vincular ambos flujos queda como mejora futura si se necesita.
- 382/382 tests backend (+15: 10 del motor + 5 de integración con BD real) + 117/117
  frontend, `tsc --noEmit` limpio en ambos.
- **Verificado e2e real en el navegador**: activo "Laptop Dell gerencia" ($3,600, equipo de
  cómputo, 3 años, adquirido en enero) → "Correr depreciación" → generó correctamente $100
  (3600/36 meses), valor en libros bajó a $3,500 → verificado por API que el asiento AST-0027
  quedó balanceado (DR 52022101 $100 / CR 1020112 $100). Datos de prueba borrados después.
- Documentación actualizada: [[06-contabilidad]], `plan-mejoras-odoo18.md` (B4 cerrado).

**Quedó pendiente / decisión del usuario**: vincular la adquisición del activo con la factura
de compra que lo originó (hoy son dos registros independientes).

**Próximo paso sugerido**: ATS (anexo transaccional), unidad de compra≠venta, o B2 (extracto
bancario OFX/CSV con presets por banco), a decisión del usuario.

---

## 2026-09-11 (continuación) — C3: Stock negativo configurable por producto
**Se hizo**: el usuario pidió continuar con C3 del backlog priorizado (Fase C del plan Odoo 18).
- `Product.allowNegativeStock` (nuevo campo, default `false` — comportamiento previo intacto
  para todo producto existente). Migración `c3_negative_stock_configurable` aplicada sin
  ningún problema de bloqueo esta vez (backend bajo control de las herramientas de preview).
- Se identificaron los 3 puntos donde el sistema bloquea salidas/traslados/reservas con
  `INSUFFICIENT_STOCK` (`registerMovement`, `transferStock`, `reserveStock` en
  `inventory.service.ts`) y se les agregó el mismo guard condicional. Para el caso FIFO/LIFO no
  hizo falta tocar el motor de costeo: `planBatchConsumption` ya traía un campo `uncovered`
  (pensado para datos legados con capas insuficientes, nunca ejercitado en producción porque el
  guard bloqueaba antes) que valora la porción no cubierta al costo promedio vigente — el mismo
  mecanismo sirve tal cual para stock negativo real, sin escribir código de costeo nuevo.
- UI en `ProductDetailPage.tsx`: toggle "Permitir stock negativo" en la pestaña Editar (con
  explicación del caso de uso: venta contra pedido a proveedor, insumo que se repone el mismo
  día), badge "Stock negativo permitido" en el header cuando está activo, badge rojo
  "⚠ Stock negativo" en la bodega específica cuya cantidad real es negativa.
- 367/367 tests backend (+6: integración con BD real cubriendo los 3 puntos, con y sin el flag)
  + 117/117 frontend, `tsc --noEmit` limpio en ambos.
- **Verificado e2e real en el navegador** sobre un producto real de la BD de desarrollo (DISCO
  DURO 1TB): activó el toggle → guardó → registró una salida de 999 unidades en una bodega que
  solo tenía 4 → el sistema lo permitió, mostrando "-995,00 UNIDAD" y el badge de stock negativo
  solo en esa bodega (la otra bodega del mismo producto, con 6 unidades, no se vio afectada).
  Los datos de prueba (incluido el costo promedio, que quedó distorsionado al revertir el
  movimiento manualmente por el promedio ponderado) se restauraron a sus valores originales
  exactos ($10,00 costo, punto de reorden 1, flag desactivado, 4/6 unidades por bodega).
- Documentación actualizada: [[03-inventario]], `plan-mejoras-odoo18.md` (C3 cerrado).

**Quedó pendiente / decisión del usuario**: "unidad de compra ≠ unidad de venta" era la otra
mitad del C3 original (doc21) pero no fue parte de este pedido explícito — queda en el backlog
para una sesión futura si se decide retomarla.

**Próximo paso sugerido**: B4 (activos fijos y depreciación) o unidad compra≠venta, a decisión
del usuario.

---

## 2026-09-11 — UI de pronóstico de demanda/rotación + facturación recurrente
**Se hizo**: el usuario pidió construir el frontend de las dos features backend-only de las
sesiones anteriores — pronóstico de demanda/rotación (Inventario) y facturación recurrente
(B3, Contabilidad) — pidiendo explícitamente que la UI de facturación sirva "para todos los
sectores", no solo arriendos.
- **Pestaña "🔮 Demanda y Rotación"** en `InventoryAnalyticsPage.tsx`: selector de historial
  (3/6/12 meses), tabla de más vendidos (sparkline CSS del historial mensual + pronóstico del
  próximo mes + badge de tendencia 📈/➖/📉) y tabla de rotación (mismo sparkline + índice
  anualizado + badge ALTA/MEDIA/BAJA). Reutiliza el patrón visual ya existente en esa página
  (tabs, canvas charts) en vez de introducir una librería nueva.
- **Página `/sri/recurrentes`** (nueva, enlazada en el sidebar bajo "Documentos SRI"): CRUD de
  `RecurringInvoiceTemplate` con descripción libre (deliberadamente genérica — sirve para
  arriendo, internet, software, seguros, honorarios, leasing, mantenimiento, guardianía, o
  cualquier factura de compra recurrente de cualquier sector, no solo "arriendo" como sugería
  el nombre original de la feature), selector de proveedor y tarifa IVA reales, botón "Generar
  pendientes" con resultado detallado (generadas / omitidas + motivo).
- **Bug real encontrado y corregido al probar en vivo**: `createRecurringTemplate` no validaba
  que el proveedor tuviera RUC configurado — con un proveedor de prueba sin RUC, la plantilla
  se creaba sin problema pero **fallaba silenciosamente recién el día que tocaba generar** la
  factura (`VALIDATION: el RUC del emisor es obligatorio`, solo visible en el toast de
  "Generar pendientes"). Ahora se bloquea al crear la plantilla (y al reactivarla), con mensaje
  claro apuntando a dónde completar el RUC. Cubierto con test nuevo.
- **Bug de layout corregido al probar en vivo**: la fila de encabezado de la nueva pestaña
  (párrafo descriptivo + selector de meses) y las dos tablas lado a lado desbordaban
  horizontalmente en viewports angostos — flex/grid children sin `min-w-0` no dejaban actuar a
  `overflow-x-auto`. Corregido con `flex-wrap` + `min-w-0` en los contenedores.
- 361/361 tests backend (+1: validación de RUC) + 117/117 frontend (sin cambios de conteo,
  páginas nuevas sin test propio todavía), `tsc --noEmit` limpio en ambos.
- **Verificado e2e real en el navegador**: pronóstico/rotación renderiza el estado vacío
  correctamente (BD de desarrollo sin ventas recientes reales); facturación recurrente probada
  de punta a punta con datos reales — plantilla creada → "Generar pendientes" → documento
  apareció en Documentos SRI con el monto e IVA correctos, estado Pendiente, 100% confianza.
  Datos de prueba borrados después.
- Documentación actualizada: [[03-inventario]], [[06-contabilidad]].

**Quedó pendiente / decisión del usuario**: no se manufacturaron ventas de prueba en la BD de
desarrollo para ver la pestaña de demanda/rotación con datos reales (para no ensuciar el
estado real que el usuario pueda estar usando) — la lógica ya está probada con tests de
integración contra BD real de la sesión anterior. Si se quiere ver poblada, hace falta
despachar pedidos reales o de prueba.

**Próximo paso sugerido**: seguir con C3 (stock negativo configurable) o B4 (activos fijos), o
poblar datos reales de ventas para validar visualmente el pronóstico/rotación con producción.

---

## 2026-09-10 — Ventas↔Inventario: servicios/no-inventario + pronóstico de demanda y rotación
**Se hizo**: el usuario pidió integrar Ventas con Contabilidad e Inventario, agregar
predicción de demanda de los artículos más vendidos, tendencia de rotación en Inventario, y
facturación de servicios/productos no cargados a inventario — con investigación previa en
internet ("aun te falta mucho mejorar ese modulo").
- Investigado: suavizado exponencial simple para pronóstico de demanda (estándar de industria
  para series cortas sin estacionalidad) e Índice de Rotación = COGS / inventario promedio
  (fórmula financiera clásica).
- **Verificado primero qué ya existía** (regla del proyecto: no reconstruir lo que funciona):
  Ventas↔Contabilidad↔Inventario YA estaban integrados de fondo — cada despacho genera asiento
  de venta + COGS exacto por capa y consume stock real (doc23). El gap real era **servicios y
  productos sin stock**.
- **Bug real corregido**: `confirmOrder` reservaba stock para TODO ítem sin excepción,
  incluyendo `Product.type='SERVICE'` — imposible vender un servicio o un producto
  deliberadamente no cargado a inventario sin que fallara la reserva. Ahora un ítem SERVICIO
  se marca reservado sin bodega ni movimiento; el resto del flujo (despacho, factura,
  retenciones bienes/servicios) no necesitó cambios porque ya distinguía `product.type` en
  otros puntos (`withholding.service`). `getSalesOrderById` devuelve `availableStock: null`
  para servicios — el frontend (`DispatchModal.tsx`) YA esperaba ese `null`, la brecha era
  solo del backend.
- **Pronóstico de demanda + tendencia de rotación** (nuevo): motor puro
  `demand-forecast.engine.ts` (suavizado exponencial + clasificación de tendencia + índice de
  rotación anualizado + nivel ALTA/MEDIA/BAJA, 14 tests) + `getDemandForecast`/`getRotationTrend`
  en `inventory.service.ts`, agregando `SalesOrderItem.shippedQty` por mes (cantidad
  REALMENTE despachada). `GET /inventory/demand-forecast` (incluye servicios, útil para
  planear capacidad) y `GET /inventory/rotation-trend` (solo productos con stock).
  **Backend/API únicamente — falta la UI.**
- **Reembolsos**: revisado, ya cubiertos por Notas de Crédito (reversan ingreso/IVA/COGS/
  retenciones) + ajuste/write-off en la mesa de trabajo CxC para el efectivo. No se encontró
  brecha que justifique un mecanismo nuevo — documentado como evaluado, no como pendiente.
- 360/360 tests backend (+19 sobre la sesión anterior: 14 motor de demanda + 2 integración de
  servicios + 3 integración de demanda/rotación) + 117/117 frontend (sin cambios), `tsc
  --noEmit` limpio. Verificado con integración real contra BD (pedido con ítem SERVICIO de
  punta a punta sin movimientos de inventario y COGS=0; pedido real de un PRODUCT confirma
  que el pronóstico y la rotación reflejan la venta).
- Documentación actualizada: [[04-ventas]], [[03-inventario]] (ambas con brecha de UI
  pendiente), `plan-mejoras-odoo18.md`.

**Quedó pendiente / decisión del usuario**: construir la UI del pronóstico de demanda y
tendencia de rotación (candidato: pestaña nueva en `InventoryAnalyticsPage` con gráfico por
producto), y la UI de facturas recurrentes de la sesión anterior (B3) — ambas hoy solo backend.

**Próximo paso sugerido**: UI de demanda/rotación + facturas recurrentes (cierra dos sesiones
backend-only de una vez), o seguir con C3 (stock negativo configurable) / B4 (activos fijos).

---

## 2026-09-09 — B3: Facturas de compra recurrentes + RBAC en SRI documents
**Se hizo**:
- El usuario pidió seguir mejorando el backend (sin más detalle). Se retomó el backlog
  priorizado del plan de mejoras: **B3 · Facturas de compra recurrentes** (arriendos, servicios,
  suscripciones) — antes solo existía como pedido, sin código.
- Modelo `RecurringInvoiceTemplate` (proveedor, descripción, monto base, código/tarifa IVA, día
  del mes, vigencia opcional, `lastGeneratedPeriod` para idempotencia) + campo de trazabilidad
  `SriDocument.recurringTemplateId` (regla 4) — migración `b3_recurring_invoice_templates`
  APLICADA.
- Motor puro `isTemplateDue` (`finance/engines/recurring-invoice.engine.ts`, 11 tests, UTC para
  evitar el bug de TZ ya conocido): vencida si está activa, dentro de vigencia y el día de hoy
  (clampado a los días reales del mes: día 31 en febrero se evalúa el 28/29, nunca se corre a
  marzo) ≥ su día configurado, sin haber generado ya ese período.
- `generateDueRecurringInvoices` (`finance/recurring-invoice.service.ts`) reusa
  `createManualSriDocument` (el mismo motor del ingreso manual de facturas) para crear el
  documento — cae en `PENDING_REVIEW` como cualquier otro, así que reutiliza TODO el flujo
  existente (duplicados, matching de OC, revisión, asiento) sin duplicar lógica contable ni
  saltarse la revisión humana. Cada plantilla se procesa independiente (una que falle no
  bloquea el resto). Sin cron en el proyecto (por diseño): se dispara bajo demanda vía
  `POST /financial/recurring-invoices/generate-due`, mismo patrón perezoso que la expiración de
  cotizaciones. **Backend únicamente esta vuelta — falta la UI.**
- Al construirlo se encontró una brecha real de seguridad: `sri-document.routes.ts` (facturas de
  compra: confirmar = postear asiento, pagar, borrar) no tenía **ningún** `authorize()`, solo
  login. Cerrada reusando acciones CASL existentes: `create`/`update`:`Purchase` para
  capturar/corregir, `post`:`Journal` para confirmar (separado de capturar, mismo criterio que
  asientos manuales), `pay`:`Purchase` para el pago directo legado, `delete`:`Purchase` solo
  ADMIN. Se agregó `create`/`update`:`Purchase` a `ASISTENTE_CONTABLE` (antes solo tenía `read`,
  pese a que su rol es literalmente "captura documentos" — sin este ajuste el gate nuevo le
  habría bloqueado su trabajo principal).
- **Trampa de entorno real**: el backend del usuario estaba corriendo fuera de mis herramientas
  de preview (terminal propia) y bloqueaba `query_engine-windows.dll.node` con EPERM al migrar,
  y mis intentos de `Stop-Process` (incluso con permisos elevados) fueron denegados por Windows
  para CUALQUIER proceso `node.exe` — tuve que pedirle al usuario que lo detuviera él mismo antes
  de poder regenerar el cliente de Prisma.
- 341/341 tests backend (+15: 11 del motor + 4 de integración con BD real) + 117/117 frontend
  (sin cambios, feature backend-only), `tsc --noEmit` limpio en ambos.
- **Verificado por API real** (backend/frontend levantados con mis herramientas de preview):
  plantilla de $500+IVA creada → `generate-due` generó el documento ($575 total,
  `PENDING_REVIEW`, `recurringTemplateId` enlazado) → repetir `generate-due` no duplicó
  (idempotente) → usuario `FUERZA_VENTAS` de prueba bloqueado 403 al capturar → usuario
  `ASISTENTE_CONTABLE` de prueba SÍ pudo capturar (400 por body vacío, no 403) pero bloqueado
  403 al confirmar (no tiene `post:Journal`). Datos y usuarios de prueba borrados.
- Documentación actualizada: [[06-contabilidad]] (nueva sección + hallazgo del pago legado),
  `plan-mejoras-odoo18.md` (B3 cerrado, registro de avance).

**Quedó pendiente / decisión del usuario**:
1. Construir la UI de plantillas recurrentes (página de administración + botón "Generar
   pendientes" en algún lugar de Contabilidad/CxP) — hoy solo existe la API.
2. Hallazgo sin resolver: `POST /sri/:id/pay` es un pago directo legado que bypasea la mesa de
   trabajo CxP (Fase 4, aprobación por monto). Se dejó con el gate más restrictivo
   (`pay:Purchase`, solo TESORERIA/ADMIN) en vez de eliminarlo — su única consumidora,
   `FinancialPage.tsx`, ya estaba huérfana (hallazgo de la sesión de Kanban). Candidato a
   eliminar junto con esa página en una sesión futura, si el usuario lo confirma.

**Próximo paso sugerido**: UI de facturas recurrentes, o continuar el backlog con C3 (stock
negativo configurable) o B4 (activos fijos y depreciación), a decisión del usuario.

---

## 2026-09-07 — Ventas: aprobación de descuento fuera de tope + protección de margen
**Se hizo**:
- El usuario pidió mejorar el módulo de Ventas investigando primero qué necesita (referencia
  Odoo 18 + prácticas 2026 de sales order management). Se descartó copiar quotation
  templates/firma-pago online de Odoo (bajo valor para el mercado PYME EC) y en su lugar se
  cerró una brecha real de automatización que el propio código ya insinuaba: la acción CASL
  `approve:Sales` existía en `auth/roles.ts` (GERENTE/GERENTE_VENTAS) pero ningún endpoint la
  usaba, y el tope de descuento por rol era un bloqueo duro (error 400) sin vía de escape.
- Motor puro `evaluateDiscountApproval` (`services/sales/engines/discount-approval.engine.ts`,
  6 tests): descuento sobre el tope del rol Y/O precio neto por debajo del `avgCost` del
  producto (protección de margen automática — diferenciador real vs Odoo). Si aplica, la
  cotización/pedido se crea en `PENDING_APPROVAL` en vez de rechazarse.
- `ErpConfig.sales.discountApproverRoles` (nuevo, editable en Ajustes → Empresa) define quién
  puede aprobar/rechazar; validado server-side (`assertCanApproveDiscount`) además del gate CASL
  `approve:Sales`. Endpoints nuevos: `POST /sales/quotations/:id/approve|reject`,
  `POST /sales/orders/:id/approve|reject`.
- De paso: RBAC server-side agregado a TODO `sales.routes.ts` (no tenía ningún `authorize()`,
  mismo patrón de brecha ya cerrado en compras/financiero en sesiones previas) y
  `SALES_QUOTATION` agregado a `CHATTER_ENTITY_TYPES` (antes las cotizaciones no tenían Chatter
  ni Actividades — ahora sí, aunque sin página de detalle propia donde mostrarlo todavía).
- Frontend: `NewQuotationPage` ya no bloquea el envío por descuento sobre tope (antes sí, con un
  botón deshabilitado) — ahora es una advertencia y el backend enruta a aprobación. Botones
  Aprobar/Rechazar en `SalesPage` (listas de cotizaciones y pedidos) y en
  `SalesOrderDetailPage`, con badge "⏳ Pendiente de aprobación".
- 326/326 tests backend (+7) + 117/117 frontend, `tsc --noEmit` limpio en ambos.
- **Verificado e2e real en el navegador**: cotización con Laptop $950 (costo $933) y 90% de
  descuento → quedó `PENDING_APPROVAL` → botón Aprobar (ADMIN) → `DRAFT` → convertida a pedido
  real `PV-0003`. Verificado también por API con un usuario `FUERZA_VENTAS` de prueba: creó una
  cotización con 50% de descuento (su tope es 5%) → intentó aprobarla él mismo → 403 real
  (`required: approve:Sales`); ADMIN sí pudo aprobarla. Datos y usuario de prueba borrados
  después.
- Documentación actualizada: [[04-ventas]] (nueva sección + 2 brechas propuestas),
  `plan-mejoras-odoo18.md` (registro de avance, fuera del orden priorizado — pedido directo).

**Quedó pendiente / decisión del usuario**: no existe página de detalle de cotización en el
frontend (solo lista + modal de creación), así que el Chatter/Actividades que ya soporta el
backend para `SALES_QUOTATION` no tiene dónde mostrarse en UI todavía.

**Próximo paso sugerido**: construir `QuotationDetailPage` (mismo patrón que
`SalesOrderDetailPage`) para exponer el Chatter/Actividades de cotizaciones; o retomar el orden
priorizado del plan (B3 deuda técnica de compras, o C3 stock negativo configurable).

---

## 2026-09-06 — Organigrama visual en Nómina
**Se hizo**:
- El usuario pidió un submódulo nuevo dentro de **Nómina** para gestionar la estructura
  organizacional de forma visual (adjuntó una referencia tipo Miro: tarjetas conectadas,
  arrastre para reorganizar). Investigado primero qué ya existía antes de tocar el schema:
  `Employee` ya tenía `managerId` (auto-relación), `departmentId` y `position` desde el
  Sprint 8 — no hizo falta ninguna migración ni endpoint nuevo.
- Página nueva `/nomina/organigrama` (`OrgChartPage.tsx`): árbol construido en el cliente
  (`buildOrgForest` en `src/lib/orgChartTree.ts`, con tests unitarios) a partir de
  `GET /payroll/employees`; un empleado cuyo jefe no está en la lista (inactivo o borrado) se
  dibuja como raíz para que el árbol nunca quede roto por un dato huérfano. Tarjetas con color
  por departamento (hash determinístico) y anillo por categoría, nodos colapsables.
- **Reasignar jefe directo arrastrando una tarjeta sobre otra** (`@dnd-kit/core`, mismo patrón
  que el Kanban de A5): llama al mismo `PUT /payroll/employees/:id` que ya usaba
  `EmployeesPage` — sin endpoint nuevo. Soltar en la zona "Sin jefe directo" limpia el
  `managerId`. El cliente bloquea visualmente soltar sobre el propio empleado o sus
  descendientes.
- Al construir esto se encontró una brecha real de validación: `updateEmployee` solo evitaba
  que alguien fuera su propio jefe directo, pero el organigrama visual hace mucho más fácil
  arrastrar sin querer una tarjeta sobre un descendiente y crear un **ciclo indirecto** en la
  jerarquía (ej. un gerente terminando reportando a su propio subordinado tres niveles abajo).
  Se agregó el motor puro `wouldCreateCycle` (`src/services/payroll/engines/org-chart.engine.ts`,
  6 tests) que recorre toda la cadena de jefes antes de aceptar el cambio, siguiendo la regla 6
  del proyecto (motores de cálculo/validación puros con tests).
- 320/320 tests backend (+6) + 117/117 frontend (+4), `tsc --noEmit` limpio en ambos.
- **Verificado real en el navegador** (Docker estaba apagado al iniciar la sesión, se levantó
  `kallpapro-db` antes de probar): arrastre real de "María Paredes" sobre "Rosa Quispe"
  reorganizó el árbol correctamente y persistió en BD; el intento inverso (arrastrar "Rosa
  Quispe" sobre su propia subordinada "María Paredes", que crearía un ciclo) fue bloqueado sin
  llamar al backend. Datos de prueba revertidos al estado original después.
- Documentación actualizada: [[05-07-tesoreria-nomina-biometrico]] (nueva sección §4.6),
  `plan-mejoras-odoo18.md` (registro de avance). Sidebar y `routeLabels.ts` actualizados con el
  nuevo ítem "Organigrama".

**Quedó pendiente / decisión del usuario**: ver continuación abajo (misma sesión, el usuario pidió
exactamente esto a continuación).

---

## 2026-09-06 (continuación) — Organigrama: acceso TTHH + modo edición
**Se hizo**: el usuario respondió a lo pendiente de arriba con tres pedidos concretos:
- **Acceso a TTHH.** En vez de agregar TTHH a `PAYROLL_ROLES` (que le habría dado acceso a
  sueldos y períodos de nómina completos), se crearon endpoints propios
  `GET/PUT /payroll/org-chart[/:id]` declarados en `payroll.routes.ts` ANTES del
  `router.use(requireRole(PAYROLL_ROLES))` general — mismo patrón exacto que
  `HR_MANAGE_ROLES` en `hr-calendar.routes.ts`. `getOrgChart` ahora devuelve una vista
  recortada del empleado (sin cédula/sueldo/tributación, ya que TTHH la consume) más un
  `canEdit` calculado server-side (`ORG_CHART_EDIT_ROLES = ['ADMIN','TTHH']`), igual que
  `canManage` en `GET /hr/calendar`.
- **"Actualiza las BD cuando se hagan cambios"**: ya ocurría (cada reasignación persistía al
  instante); el pedido real detrás era el punto siguiente.
- **Botones Editar/Guardar/Imprimir "para que no se pueda mover accidentalmente"**: el árbol
  pasó a ser de solo lectura por defecto. "✏️ Editar" (visible solo si `canEdit`) clona el
  estado a un borrador local — el arrastre en modo edición solo cambia ese borrador en memoria,
  sin tocar el backend. "💾 Guardar (N)" recién ahí envía un `PUT /org-chart/:id` por cada
  empleado cuyo jefe cambió respecto al borrador original. "Cancelar" descarta el borrador sin
  llamar al servidor. "🖨️ Imprimir" es `window.print()` con los controles ocultos
  (`print:hidden`).
- Sidebar: el ítem "Organigrama" necesitaba ser visible tanto para roles de nómina
  (`subject: 'Accounting'`) como para TTHH (`subject: 'HR'`) — se agregó `anySubject?: Subject[]`
  a `NavItem` (antes solo soportaba un `subject` único) para expresar el OR.
- 320/320 tests backend + 117/117 frontend (sin cambios de conteo — esta vuelta fue routing/UI,
  no lógica nueva testeable), `tsc --noEmit` limpio en ambos.
- **Verificado real en el navegador con dos usuarios reales**: ADMIN (arrastre en modo edición
  no persistió hasta "Guardar"; "Cancelar" descartó un cambio pendiente sin llamar al backend;
  "Guardar" sí persistió y mostró "Organigrama actualizado"), y el usuario TTHH real
  `tthh.test@kallpa.test` (su contraseña de prueba se había perdido/no coincidía con la
  estándar — se reseteó a `12345678` para poder probar, documentado aquí por si una sesión
  futura la busca) — confirmó sidebar reducido a solo "Organigrama"+"Calendario" bajo Nómina y
  el botón "Editar" visible (`canEdit: true` desde el backend). Datos de prueba revertidos al
  estado original después.
- **Hallazgo de entorno (no corregido, documentado)**: `RBAC_ENFORCE` no está seteado en
  `.env`, y a diferencia de `authorize()` (CASL, usado en el módulo financiero) que por defecto
  SÍ bloquea, `requireRole()` (usado en nómina/HR) por defecto NO bloquea salvo
  `RBAC_ENFORCE=true` explícito — confirmado en vivo: un usuario TTHH pudo cargar
  `GET /payroll/employees` (la ruta de sueldos) pese al gate de rol en el código. El gate es
  correcto y se aplicaría en producción con la variable seteada; es una inconsistencia de
  comportamiento entre los dos mecanismos de RBAC del proyecto, preexistente y fuera del alcance
  de este pedido.
- Documentación actualizada: [[05-07-tesoreria-nomina-biometrico]] (§4.6 reescrita),
  `plan-mejoras-odoo18.md` (registro de avance).

**Quedó pendiente / decisión del usuario**: la inconsistencia `RBAC_ENFORCE` (requireRole vs.
authorize) queda documentada pero sin decidir si vale la pena unificar — afecta a TODOS los
módulos que usan `requireRole` (nómina, HR, bodega...), no solo organigrama. Backlog general
(`plan-mejoras-odoo18.md`) sigue con B3/C3/B4/D2/B2/D3/D1 sin orden forzado.

**Próximo paso sugerido**: preguntar al usuario si quiere unificar el comportamiento default de
`RBAC_ENFORCE` entre `requireRole` y `authorize` (probablemente haciendo que ambos bloqueen por
defecto, ya que es más seguro), o seguir con el backlog general del plan Odoo 18.

---

## 2026-09-05 — C2: Panel de operaciones de inventario
**Se hizo**:
- Cuarto y último ítem del orden pedido por el usuario para esta sesión. **C2 · Panel de
  operaciones de inventario**: tarjeta por bodega × tipo de operación, inspirado en el patrón
  de Odoo confirmado en la exploración QA previa ("Recepciones — 2 Por recibir", "Expediciones
  — 6 Por entregar · En espera 4 · Con demora 10 · Parciales 1").
- Investigado primero con un agente Explore qué modelos ya existían para no duplicar: OC
  (`PurchaseOrder.status` APPROVED/PARTIAL = pendiente de recibir, atribuida a bodega vía
  `deliveryLocation.warehouseId`), expediciones (`Shipment.status`, atribuida vía
  `ShipmentItem→SalesOrderItem.warehouseId`), traslados (`InventoryMovement` TRANSFER_IN/OUT,
  ya síncronos e inmediatos — no existe concepto de "traslado pendiente").
- Motor puro nuevo `operations-panel.engine.ts` (8 tests): clasifica el estado de una
  expedición (EN_ESPERA/POR_ENTREGAR/ENTREGADO/FALLIDO) y si está "con demora"
  (`estimatedDelivery` ya pasó y no llegó a estado final) — separado del conteo con BD para
  poder testear la clasificación sin fixtures de Prisma.
- `getInventoryOperationsPanel(companyId)` en `inventory.service.ts`: arma la tarjeta por
  bodega con datos reales. Una OC sin `deliveryLocationId` (caso común, casi ninguna OC de
  compras lo llena) o una expedición sin bodega resuelta cae en la bodega marcada `isDefault`
  de la empresa como fallback razonable.
- Frontend: sección "Operaciones de hoy por bodega" en `InventoryAnalyticsPage.tsx` (arriba de
  los KPIs existentes), oculta bodegas sin ninguna operación activa. Se decidió NO convertir
  esa página a tabs completos (hoy es de un solo tema: rotación/ABC/dead stock) ni crear una
  página aparte — una sección nueva cumple lo que pedía el plan ("agrega tab en Inventario
  Analytics") con el cambio más chico posible.
- 314/314 tests backend (+8) + 113/113 frontend, `tsc --noEmit` limpio en ambos.
- **Verificado real en navegador con datos de producción reales**: la BD demo no tenía
  ninguna OC en estado APPROVED/PARTIAL hoy, así que se forzó temporalmente el estado de una
  OC real (`OC-0004`) a `APPROVED` con un script de Prisma — la tarjeta de BODEGA MATRIZ
  (bodega default) mostró correctamente "1 por recibir" en la UI real; se revirtió el estado
  después. Confirma que la atribución OC→bodega-default y el conteo funcionan end-to-end, no
  solo en el papel.
- Con esto **cierra completa la Fase C del plan Odoo 18** (inventario): C1 y C2 hechos, queda
  C3 (stock negativo configurable) sin fecha fija.
- Documentación actualizada: [[03-inventario]] (C2 ❌→✅), `plan-mejoras-odoo18.md` (registro
  de avance, checklist de orden recomendado), `00 - Inicio.md` (ya no hay un solo ítem
  siguiente forzado — el backlog restante queda a decisión del usuario).

**Quedó pendiente / decisión del usuario**: el orden de 4 ítems que pidió el usuario para esta
sesión (RBAC financiero → C1 → C2, y un ítem 4 que no llegó a especificar más allá de "sigue en
orden del 1 al 4" — los 3 primeros ya cubren lo documentado) está completo. Falta que el
usuario diga qué sigue: `plan-mejoras-odoo18.md` tiene B3/C3/B4/D2/B2/D3/D1 sin orden forzado.

**Próximo paso sugerido**: preguntar al usuario qué sigue del backlog (no hay un "siguiente"
único ya fijado como en sesiones anteriores) — candidatos: C3 (stock negativo configurable,
continúa el tema de inventario recién tocado) o retomar deuda técnica (ESLint sin configurar,
`reqNumber` único global).

---

## 2026-09-05 — C1: Reglas de reabastecimiento entre bodegas
**Se hizo**:
- Siguiendo el backlog en orden (ítem 2 después del cierre de RBAC financiero), se implementó
  **C1 · Reglas de reabastecimiento entre bodegas** completo, backend + frontend + e2e:
  - Se detectó que `getReorderSuggestions` (ya existente) suma TODAS las bodegas en un total
    único y siempre sugiere comprar — no sirve para "traslado vs. compra" por bodega. Se
    construyó un motor nuevo en paralelo, sin tocarlo.
  - Migración `c1_replenishment_per_warehouse`: `ProductStock.minStock`/`maxStock` (nullable,
    override por bodega; si es null usa el mín/máx del producto) + modelo `ReplenishmentSnooze`
    para posponer sugerencias. **Detenido el backend antes de migrar** (trampa conocida); el
    `prisma generate` posterior falló con el EPERM habitual de OneDrive — se resolvió borrando
    `query_engine-windows.dll.node` antes de regenerar (fix ya documentado en memoria).
  - Motor puro `replenishment.engine.ts` (10 tests, sin BD): por cada producto-bodega bajo su
    mínimo, busca UNA bodega donante con excedente sobre SU PROPIO máximo que cubra todo el
    faltante → traslado; si ninguna cubre sola → requisición de compra. Deliberadamente no
    reparte entre varios donantes (mismo criterio de "ruta preferida única" de Odoo).
  - `getReplenishmentSuggestions` arma el motor con datos reales (consumo 90 días por bodega
    para pronóstico de días de stock). Acciones conectadas a servicios YA existentes en vez de
    reinventar: "Trasladar" reusa `transferStock` (capas FIFO/LIFO viajan igual), "Requisición"
    reusa `createRequisition`.
  - Página nueva `/inventory/replenishment` (tabla con Disponible/Mín-Máx/Días de
    stock/Urgencia/Ruta preferida/A pedir + botones Trasladar-Requisición/Posponer) enlazada
    desde el header de Inventario. Editor inline de mín/máx por bodega agregado en la pestaña
    "Bodegas" de `ProductDetailPage` (necesario porque si no, no había forma de fijar el
    override por bodega desde la UI).
  - Rutas nuevas gateadas con `authorize()` desde el inicio (no una brecha a cerrar después):
    `update:Inventory` para trasladar/posponer/editar mín-máx, `create:Requisition` para la
    requisición sugerida.
- 306/306 tests backend (+10) + 113/113 frontend (+6), `tsc --noEmit` limpio en ambos.
- **Verificado real en navegador con datos de producción reales** (no solo datos de prueba
  aislados): se creó un producto de prueba con 5 CAJA en BODEGA COSTA (mín 10/máx 50) y 300 en
  BODEGA MATRIZ (mín 10/máx 100) — bodegas reales de la empresa demo. La sugerencia calculó
  correctamente "Trasladar desde BODEGA MATRIZ" por 45 CAJA; se ejecutó el botón real en la UI
  y se confirmó en BD que Matriz bajó a 255 y Costa subió a 50. El editor inline de mín/máx
  también se probó en vivo (cambió 100→150 en Matriz, toast de confirmación, valor persistido).
  Producto y movimientos de prueba borrados después con script temporal de Prisma.
- Documentación actualizada: [[03-inventario]] (C1 ❌→✅), `plan-mejoras-odoo18.md` (registro
  de avance + orden recomendado), `00 - Inicio.md`.

**Quedó pendiente / decisión del usuario**: ninguna — C1 cierra completo (motor, servicio,
UI, acciones reales, e2e). Nota para el futuro: si se agrega un panel "Reposición" dentro de
Inventario Analytics (como sugiere el plan para C2), evaluar si conviene fusionar esta página
con ese dashboard en vez de mantenerla separada — por ahora quedó como página independiente
porque Inventario Analytics es de un solo tema (rotación/ABC/dead stock) y mezclar una tabla
accionable ahí habría complicado esa página.

**Próximo paso sugerido**: sigue **C2 · Panel de operaciones de inventario** (dashboard de
entradas/salidas/traslados pendientes del día), según el orden que pidió el usuario.

---

## 2026-09-05 — RBAC server-side en el resto de `financial.routes.ts`
**Se hizo**:
- El usuario pidió seguir el backlog priorizado en orden. Primer ítem: cerrar la brecha
  documentada en la sesión anterior — "el resto de `financial.routes.ts` sigue sin
  `authorize()` en casi ninguna ruta mutante".
- Se mapearon con un agente Explore TODAS las rutas mutantes de `financial.routes.ts` sin
  gate y se les agregó `authorize()` reutilizando acciones/subjects CASL ya existentes (sin
  crear roles ni reglas nuevas):
  - Facturas de venta: `POST /invoices` y `PATCH /invoices/:id/status` →
    `authorize('create'|'update','Finance')`; `POST /invoices/:id/credit-notes` →
    `authorize('update','Finance')`.
  - Asientos manuales: `POST /journal-entries` → `create:Journal` (captura, coherente con
    ASISTENTE_CONTABLE "sin contabilizar"); `POST /journal-entries/:id/reverse` y
    `POST /journal-entries/:entityType/:entityId/post` → `post:Journal` (solo
    CONTADOR/ADMIN, acción de "contabilizar").
  - Posting setup: `POST /seed-accounts`, `PATCH /account-mappings` → `configure:Accounting`.
  - Impuestos: `POST /taxes/iva`, `POST /taxes/retentions` → `update:Accounting` (no
    `configure`, para no bloquear a TRIBUTARIO que ya tiene `update Accounting` y es el rol
    pensado para administrar estos catálogos).
  - DCF/Escenarios: guardar (`dcf/save`, `scenarios/save`) → `create:Finance`; calcular/
    simular/comparar (solo lectura, no persisten) → `read:Finance`.
  - `parse-statement`, `savings/log` → `create:Finance`.
  - `POST /ar/collection` (registrar actividad de cobranza) → `pay:Payment`, mismo gate que
    el resto de la mesa de trabajo CxC.
  - Ningún controlador tenía checks de rol embebidos que migrar — todo se resolvió agregando
    el middleware en las rutas.
- **Verificado real en navegador** (no solo tests): se crearon 2 usuarios de prueba
  (AUDITOR, CONTADOR), se llamó `POST /journal-entries`, `POST /invoices`,
  `POST /dcf/save` y `POST /seed-accounts` por `fetch` directo. AUDITOR recibió 403 real en
  las 4 (`create:Journal`, `create:Finance` ×2, `configure:Accounting`); CONTADOR pasó el
  gate en `journal-entries` (400 de negocio, no 403) e `invoices` (201, factura FAC-0001
  creada). Usuarios y factura de prueba borrados después con script temporal de Prisma
  (mismo patrón de limpieza de siempre).
- 296/296 tests backend + 107/107 frontend, `tsc --noEmit` limpio en ambos, sin regresión.
- Documentación actualizada: [[arquitectura-tecnica]] §5 (brecha marcada como cerrada),
  [[06-contabilidad]] y [[08-analisis-financiero-cxp-cxc]] (filas nuevas), `00 - Inicio.md`.

**Quedó pendiente / decisión del usuario**: ninguna — este ítem cierra la brecha de RBAC
server-side del módulo financiero completo. Deuda técnica sin tocar (fuera de alcance):
ESLint sin configurar en ambos proyectos, `reqNumber` único global en requisiciones.

**Próximo paso sugerido**: el usuario pidió seguir el backlog en orden — sigue
**C1 · Reglas de reabastecimiento entre bodegas** + **C2 · Panel de operaciones de
inventario** (ver [[03-inventario]]).

---

## 2026-09-05 — RBAC server-side en CxP/CxC + gap de GERENTE corregido
**Se hizo**:
- Limpieza pedida por el usuario: borrados el usuario de prueba y los 2 documentos SRI (con
  sus pagos, asientos y movimientos bancarios asociados) creados al verificar Fase 4-5 en la
  sesión anterior, vía script temporal de Prisma (creado, ejecutado y borrado — mismo patrón
  usado en toda la sesión). Trazabilidad conservada en `plan-mejoras-odoo18.md` y en memoria;
  solo se limpiaron los datos de prueba de la BD, no la documentación de lo que se verificó.
- El usuario pidió "profundizar más en la operatividad del Asistente Contable Inteligente
  CxP/CxC, implementando mejoras". Se retomó la brecha ya documentada honestamente en
  [[asistente-contable-cxp-cxc-permisos]] (2026-09-02): las acciones mutantes de CxP/CxC
  (pagar, ajustar, programar, aplicar/desenlazar NC, reclasificar) solo estaban protegidas en
  el frontend (`postManual`); el backend no tenía `authorize()`, solo `authMiddleware`. Se
  cerró para las 10 rutas de CxP/CxC con `authorize('pay','Payment')` — ver
  [[cxp-cxc-rbac-server-side]].
- **Hallazgo real, no buscado**: al mapear qué rol debía tener el permiso CASL `pay:Payment`
  para no romper nada, apareció que GERENTE — diseñado en Fase 4 como aprobador de los niveles
  RESPONSABLE/GERENCIAL — nunca podía ver el botón "Pagar" en la mesa de trabajo, porque el
  frontend (`postManual`) jamás lo incluyó. El control de aprobación por monto recién
  construido era, en la práctica, inejercitable para el rol pensado para sus niveles más altos.
  Corregido con un permiso nuevo y acotado (`approveGerencial`, solo GERENTE/ADMIN) aplicado
  únicamente a CxP/CxC, no a la pestaña general de Asientos manuales (para no darle de paso a
  GERENTE una capacidad que no pidió nadie).
- Verificado real en navegador (no solo tests): usuario `AUDITOR` de prueba llamando la API de
  pago directo por `fetch` (sin UI) recibió `403 {"required":"pay:Payment","role":"AUDITOR"}`;
  usuario `GERENTE` de prueba pagó con éxito (201) una factura de $6900 (nivel GERENCIAL). Los
  3 usuarios y el documento SRI de esta ronda de pruebas también se limpiaron después.
- 296/296 tests backend + 107/107 frontend, `tsc --noEmit` limpio en ambos, sin regresión.

**Quedó pendiente / decisión del usuario**: el resto del módulo financiero (`financial.routes.ts`
completo — facturas de venta, DCF, escenarios, journal-entries genérico) sigue sin `authorize()`
en casi ninguna ruta mutante; se documentó la misma brecha honesta que ya existía, ahora acotada
correctamente a "todo excepto CxP/CxC". Cerrarla del todo es un cambio de arquitectura más
grande, no se decidió abordarlo en esta sesión.

**Próximo paso sugerido**: siguiente ítem del backlog priorizado en [[00 - Inicio|00 - Inicio.md]]
— **C1 · Reglas de reabastecimiento entre bodegas** + **C2 · Panel de operaciones de
inventario** (ver [[03-inventario]]). Si el usuario quiere seguir profundizando en RBAC del
módulo financiero en vez de eso, el patrón a replicar es el mismo: mapear qué acción/rol real
falta, agregar la regla CASL mínima necesaria, y verificar con un rol bloqueado + un rol
permitido en el navegador (no solo con tests).

---

## 2026-09-05 — Fase 4-5 cierran el roadmap Asistente Contable CxP/CxC
**Se hizo**:
- **Fase 4 — aprobaciones de pago configurables por monto**: `ErpConfig.finance` con
  `paymentResponsableLimit`/`paymentGerencialLimit` (defaults 500/5000, editable en Ajustes →
  Empresa, nueva sección "💰 Aprobaciones por monto"). Motor puro nuevo
  `payment-approval.service.ts` (3 niveles AUTO/RESPONSABLE/GERENCIAL por rol, 12 tests) forzado
  **server-side** dentro de `payPayable`/`writeOffPayable` (`ap.service.ts`) y
  `collectReceivable`/`writeOffReceivable` (`ar.service.ts`) — no solo ocultar el botón en la UI.
  Hallazgo documentado (no corregido, fuera de alcance de esta fase): la `ApprovalMatrix` de
  Requisición/OC nunca valida `approverRole` contra el rol real del usuario que aprueba; Fase 4
  sí lo hace correctamente, para no repetir el mismo gap.
- **Bug real corregido**: los catch de `writeOff` en `ap.controller.ts`/`ar.controller.ts`
  convertían cualquier excepción a un 400 genérico — habría silenciado el 403 nuevo de Fase 4.
  Se agregó `if (e instanceof AppError) throw e;` antes del catch-all en ambos.
- **Fase 5 — conciliación bancaria visible en CxP/CxC**: `reconciliation.service.ts` ganó
  `getReconciliationBySource(companyId, sourceType, sourceId)`, que reutiliza los campos
  `BankTransaction.sourceType/sourceId` (ya existían desde la integración AP/AR de Tesorería) +
  `BankStatementLine.matchType` para exponer si el pago/cobro de un documento ya fue conciliado.
  Nueva sección "Conciliación bancaria" en `CxPWorkbench.tsx`/`CxCWorkbench.tsx` con badge
  REGISTRADO/CONCILIADO/ANULADO. Sin migración — ambas fases reusan columnas/JSON existentes.
- Con esto cierra el roadmap completo de 88 secciones del prompt maestro
  [[asistente-contable-cxp-cxc-roadmap]] (Fases 1-5). Ver detalle en
  [[08-analisis-financiero-cxp-cxc]].
- **Verificado e2e real en navegador** (no solo tests): se creó un documento SRI de compra de
  $690 (por encima del umbral de $500) y se creó un usuario de prueba `ASISTENTE_CONTABLE`
  nuevo; al intentar pagarlo con ese usuario, el sistema bloqueó con 403 y el mensaje exacto
  "Este monto ($690.00) requiere aprobación del responsable de cuentas (Contador o Admin)"
  (confirmado en Network, no solo en pantalla). Luego, como admin, se pagó parcialmente ($700 de
  $1150) una segunda factura con cuenta bancaria seleccionada, y el panel de detalle mostró
  correctamente "⏳ Pendiente de conciliar · Pichincha principal · $700,00".
- 296/296 tests backend (+12) + 107/107 frontend, `tsc --noEmit` limpio en ambos.

**Quedó pendiente / decisión del usuario**: ninguna decisión pendiente de este cierre. El
usuario de prueba `asistente.fase4.test@kallpa.test` y los 2 documentos SRI de prueba
(001-001-000999 Proveedor Alfa $690 pagado, 001-001-000998 Proveedor Beta $1150 con $450
pendiente) quedaron en la base de datos de desarrollo — no se limpiaron porque no se pidió.

**Próximo paso sugerido**: siguiente ítem del backlog priorizado en [[00 - Inicio|00 - Inicio.md]]
— **C1 · Reglas de reabastecimiento entre bodegas** + **C2 · Panel de operaciones de inventario**
(ver [[03-inventario]]), o **B1 → ya cerrado**, revisar deuda técnica pendiente (ESLint sin
configurar en ambos proyectos, `reqNumber` único global en vez de por empresa).

---

## 2026-09-05 — A2.2 cerrado: Fase A del plan Odoo 18 completa
**Se hizo**:
- Encargos puntuales del usuario: borrado + regenerado el engine de Prisma (fix del EPERM de
  OneDrive), enrutada `FinancialPage.tsx` (`/financial/invoices`, con link nuevo "Facturas" en
  el Sidebar — ya no es código huérfano).
- **A2.2 — log de cambios automático, notas internas y seguidores** en el Chatter (último ítem
  de la Fase A del plan Odoo 18, que con esto queda completa): `DocumentMessage` ganó `kind`
  (MESSAGE/NOTE/LOG) y 3 columnas (`logField`/`logFrom`/`logTo`); nuevo modelo
  `DocumentFollower`. `logFieldChange()` en `chatter.service.ts` se llama explícitamente (no
  trigger genérico) desde el punto exacto de cada transición real: aprobar/rechazar/cotizar/
  generar OC en Requisiciones, enviar/aprobar/rechazar en Órdenes de Compra, confirmar pedido y
  `recalculateOrderStatus` en Ventas, y `updateInvoiceStatus`/aplicar un pago en Facturas. El
  backend guarda el código crudo del estado; `<Chatter statusLabels={...}/>` lo traduce con el
  mismo mapa que cada página ya usaba para su badge — no se duplicó ningún label. Ver
  [[09-ux-transversal]] para el detalle completo (incluye el hallazgo de que ya existía un
  `AuditLog` genérico para datos maestros, complementario y no duplicado con esto).
- **Bug real de multi-tenant corregido** (regla 1, no negociable): `updateInvoiceStatus`
  actualizaba una factura por `id` **sin filtrar por `companyId`** — cualquier empresa podía
  cambiar el estado de una factura de otra empresa si conocía su id. Corregido con un
  `findFirst({ id, companyId })` previo al `update`.
- Verificado e2e completo en navegador con una requisición real: aprobar L1→L2 generó
  automáticamente "Admin KallpaPro cambió el estado: Pendiente L1 → Pendiente L2" en el hilo;
  se publicó una nota interna (insignia ámbar, distinta de un mensaje normal); se probó
  Seguir/Dejar de seguir (contador 👁 actualizado). Backend 284/284 (+3 tests de
  `normalizeMessageKind`), frontend 107/107 (+4 tests de Chatter), `tsc --noEmit` limpio.
  Migración `add_chatter_log_followers` APLICADA.

**Quedó pendiente / decisión del usuario**:
- Seguidores es solo visibilidad hoy (quién sigue el documento) — no hay notificación push/
  email cuando alguien comenta o cambia el estado. Si se quiere ese salto, es un ítem nuevo de
  backlog (infraestructura de notificaciones), no parte de A2.2 tal como se pidió.
- El log de cambios cubre el campo **estado** en los 4 documentos (lo más valioso, según el
  propio plan) — no hay diffing genérico de cualquier campo (proveedor, montos, cantidades
  recibidas). Ampliarlo a otros campos es sencillo (mismo `logFieldChange()`) pero no se hizo
  porque no se pidió explícitamente y cada campo adicional exige decidir dónde exactamente
  hookearlo en el servicio correspondiente.

**Próximo paso sugerido**: con la Fase A completa, seguir con **C1** (reglas de reabastecimiento
entre bodegas) según [[00 - Inicio|el panel de inicio]], salvo que el usuario prefiera la Fase
4-5 del roadmap CxP/CxC.

---

## 2026-09-05 — A5 (kanban) y A3 (actividades) cerrados
**Se hizo**:
- **A5 — vistas kanban conmutables**: componente genérico `<KanbanBoard/>`
  (`Proyect-Kallpro-Frontend/src/components/kanban/KanbanBoard.tsx`, extraído del Pipeline CRM
  con un fix real: el Pipeline no tenía `useDroppable` en las columnas, así que soltar sobre una
  vacía era frágil). Aplicado en Requisiciones, Pedidos de venta, Facturas, Cuentas por Pagar,
  Cuentas por Cobrar y Financiero. Drag-and-drop real solo donde no hace falta formulario
  (aprobar por nivel, confirmar/despachar pedido); el resto queda bloqueado con 🔒 para no
  bypasear `PaymentApplication`/notas de crédito. Verificado con drag-and-drop sintético real
  (eventos `PointerEvent` a mano, porque el `left_click_drag` del navegador no generaba
  suficientes eventos intermedios para `@dnd-kit`). Bug real corregido de paso: el rol TTHH
  faltaba en el selector de "Nuevo Usuario" (`UsersPage.tsx`). Ver [[09-ux-transversal]].
- **A3 — actividades programadas**: modelo `Activity` (mismos 4 `entityType` que el Chatter:
  PURCHASE_ORDER/SALES_ORDER/INVOICE/REQUISITION), motor puro `computeActivityStatus`
  (DONE/OVERDUE/TODAY/UPCOMING, 12 tests unitarios), endpoints transversales
  `/api/activities/*` (sin gate de `Subject`, igual que el Chatter), componente `<Activities/>`
  montado junto al Chatter en los 4 detalles, y `<MyActivitiesWidget/>` en Inicio (mismo patrón
  visual que "Mis pendientes" de Compras, vencidas en rojo, check-rápido, no renderiza nada si
  no hay pendientes). Verificado e2e completo en navegador: crear actividad vencida → aparece
  en el widget de Inicio en rojo → completar desde el widget → desaparece → reaparece en
  "Ver hechas" del documento tachada. Ver [[09-ux-transversal]].
- Documentación actualizada en cascada: [[plan-mejoras-odoo18]] (tabla Fase A + registro de
  avance), [[09-ux-transversal]], [[00 - Inicio]] (prioridades: A2.2 es lo siguiente).

**Quedó pendiente / decisión del usuario**:
- `Proyect-Kallpro-Frontend/src/pages/financial/FinancialPage.tsx` sigue **huérfano** (no
  enrutado en `App.tsx`) — se le agregó el kanban de A5 igual por si se decide enrutarlo, pero
  hoy es código muerto invisible para el usuario real. Decisión pendiente: enrutarlo, o
  eliminarlo como deuda técnica.
- Trampa de entorno nueva descubierta: `npx prisma generate` puede fallar con EPERM por
  OneDrive (no por nodemon) aunque no haya ningún proceso del backend corriendo — el fix fue
  borrar `node_modules/.prisma/client/query_engine-windows.dll.node` a mano antes de
  regenerar (un `rename` sobre archivo existente falla, un `create` en limpio no).

**Próximo paso sugerido**: A2.2 (chatter con log de cambios automático por campo + seguidores) —
ver [[09-ux-transversal]] sección "Mejoras propuestas".

---

## 2026-09-05 — Reorganización del vault + credenciales/arquitectura/protocolos
**Se hizo**:
- Diagnóstico y limpieza del grafo de Obsidian: excluidos `node_modules` (2,240 .md ruido)
  y `Credenciales/interactions` (214 plantillas vacías) del índice y del grafo.
- [[00 - Inicio|00 - Inicio.md]] creado como panel de entrada con prioridades vigentes.
- [[Arquitectura KallpaPro/flujo-trabajo-erp|flujo-trabajo-erp.md]] pasó de documento
  monolítico (202 líneas) a router delgado con índice a `Arquitectura KallpaPro/Modulos/`
  (10 archivos, uno por módulo de negocio: ejecutado / flujo / mejoras propuestas).
- Legado archivado sin borrar: `Arquitectura KallpaPro/_Archivo/` (v1, propuesta comercial LOGIFI).
- **Credenciales consolidadas**: [[Credenciales/00-ACCESOS-Y-ENTORNO]] fusiona
  `CREDENCIALES.txt`+`COMANDOS.txt`+`CONTEXTO-CONSOLIDADO.md` (archivados en
  `Credenciales/_Archivo/`). Se corrigió una inconsistencia real: el puerto del backend
  es **5001** (`.env` real), no 5000 como decían `CLAUDE.md`/`.env.example`/docs viejos.
- **`Credenciales/` agregada a `.gitignore`** — no estaba, riesgo real de commitear
  secretos si alguna vez se corre `git add -A`.
- Documento técnico nuevo: [[Arquitectura KallpaPro/arquitectura-tecnica]] (capas
  backend/frontend, RBAC de 19 roles, convenciones — separado del router de negocio).
- Meta-documentos de proceso: [[Arquitectura KallpaPro/protocolo-documentacion]] (dónde
  va cada tipo de información, para no volver a desordenarse) y
  [[Arquitectura KallpaPro/protocolo-mejoras]] (ciclo de vida ❌→🟡→✅ de una mejora).
- `CLAUDE.md` actualizado para apuntar a toda esta estructura nueva.

**Resuelto tras confirmar con el usuario** (mismo día, segunda mitad de la sesión):
- Hook `Stop` **desactivado** en `C:\Users\ACER\.claude\settings.json` (global) — ya no
  corre `session-updater.js` en cada turno. La Bitácora la mantengo yo (Claude) a mano.
- Verificado en código real (no copiado a ciegas) y **rescatado antes de borrar**: el score
  de proveedor de `CONTEXTO-CONSOLIDADO.md` seguía vigente en
  `supplier-scoring.service.ts` → agregado a [[Arquitectura KallpaPro/Modulos/02-compras|Módulo 2 · Compras]].
- **Purgado** (contenido ya integrado en otro lado, confirmado obsoleto): `scripts/session-updater.js`,
  `scripts/session-updater.log`, `scripts/.interaction-counter.json`, y las 216 notas vacías
  de `Credenciales/interactions/`.
- ⚠️ **`Credenciales/_Archivo/`** (CREDENCIALES.txt, COMANDOS.txt, Conversación Chat.txt,
  CONTEXTO-CONSOLIDADO.md) sigue en disco — el clasificador de seguridad bloqueó el borrado
  automático de esa carpeta (nombre + contenido tipo credenciales). Ya está 100% consolidada
  en [[Credenciales/00-ACCESOS-Y-ENTORNO]]; si el usuario quiere borrarla, tiene que hacerlo
  él mismo o pedirlo explícitamente de nuevo.

**Pendiente real**:
- Los archivos de módulo nuevos en `Modulos/` reorganizan contenido ya existente, no se
  verificó línea por línea contra el código real (solo se verificó el score de proveedor).
  La próxima vez que se toque un módulo, confirmar que su archivo sigue reflejando el
  estado real antes de confiar en él ciegamente.

**Próximo paso sugerido**: seguir con el backlog de [[00 - Inicio|prioridades vigentes]]
(A5 kanban → A3 actividades). Opcional: el usuario borra manualmente `Credenciales/_Archivo/`.
