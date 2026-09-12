# 19 — Sprint 6: Contabilidad Pro (períodos, balanza, tributario, roles y exports)

> **Fecha:** 2026-07-03
> **Objetivo:** contabilidad robusta en backend y flexible en frontend, al nivel de Odoo/Contífico,
> con vistas y acciones por perfil: **auxiliar contable, analista, contador, tributario y auditor**.
> **Guía visual:** contabilidad de Odoo (balanza con saldo inicial/movimientos/saldo final, fechas de
> bloqueo, informes fiscales por período, exports). *La extensión Claude-in-Chrome no conectó durante
> la sesión, por lo que no se tomaron capturas del Odoo de referencia; se usaron los patrones estándar.*
>
> **✅ ESTADO: EJECUTADO Y VERIFICADO E2E (2026-07-04)** — migración `fiscal_periods` aplicada,
> `tsc --noEmit` verde en back y front, **69/69 tests** verdes (3 nuevos de regresión), y flujo de
> cierre de período validado de punta a punta contra la BD real + navegador. Se encontraron y
> corrigieron **2 bugs reales** durante la validación manual (ver §9).

---

## 0. Lo que YA existía (verificado contra el código; NO se duplicó)

| Pieza | Dónde |
|---|---|
| Asientos automáticos de compras, ventas, COGS, retenciones (compra y venta), NC, pagos, ajustes | `journal.service.ts` |
| Plan de cuentas Supercías (Form. 101) jerárquico con seed idempotente | `finance/accounting.service.ts` + `data/planCuentasSupercias` |
| Mapeo evento→cuenta editable (`AccountMapping`) con defaults NIIF | ídem |
| Mayor por cuenta con saldo corrido y drill-down al documento origen | `getAccountLedger` |
| Balance General, Estado de Resultados, Flujo de Efectivo (NIC 7 directo) | ídem |
| Resúmenes 103/104 + calendario SRI | `finance/sri.service.ts` |
| Asiento manual validado (cuadre + cuentas existentes) y reversos espejo | `journal.service.ts` |
| Aging CxC/CxP, ratios, DCF, escenarios | `finance/*` |

## 1. Períodos fiscales y cierre contable  `[NUEVO]`

- **Modelo `FiscalPeriod`** (`companyId, year, month, status OPEN|CLOSED, closedAt/By, reopenedAt/By, notes`),
  única por empresa+mes. Migración `20260703120000_fiscal_periods`.
- **`finance/fiscal-period.service.ts`**: `listPeriods` (últimos 18 meses con nº de asientos y movimiento),
  `closePeriod` (no cierra meses futuros), `reopenPeriod` (deja huella), `assertPeriodOpen`.
- **Enforcement central**: `journal.service.nextEntryNumber(companyId, entryDate)` — el punto único por el
  que pasa TODO asiento — valida el período. Cubre asientos automáticos (fechados hoy), manuales
  (fecha propia) y reversos. Error `PERIOD_CLOSED:YYYY-MM` → 400 legible en el controlador.
- **Rutas**: `GET /financial/fiscal-periods`, `POST /financial/fiscal-periods/close|reopen`
  (estas dos con `authorize('configure','Accounting')` → solo ADMIN/CONTADOR).

## 2. Balanza de comprobación v2  `[NUEVO]`

- `getTrialBalance2(companyId, {from, to, level})` → filas con **saldo inicial + debe + haber + saldo final**
  (formato estándar de auditoría, 6 columnas) + totales; agrupable por **nivel 1–5** del plan
  (rollup por jerarquía de códigos Supercías). Endpoint `GET /financial/trial-balance-v2` (+`format=csv`).
- La v1 (`/trial-balance`) se conserva por compatibilidad.

## 3. Libro diario con filtros ricos  `[NUEVO]`

- `searchJournalEntries`: texto (descripción/Nº), cuenta (por prefijo → incluye hijas), origen, estado,
  rango de fechas, monto min/max, **paginación** y **totales debe/haber del filtro**.
- Mismo endpoint `GET /financial/journal-entries`: con `page` o `format=csv` usa el modo avanzado;
  sin ellos, respuesta legada (array) → no rompe páginas antiguas.

## 4. Exports (auditor)  `[NUEVO]`

- **Server-side CSV** (datasets grandes): libro diario (una fila por línea de asiento, hasta 5000),
  mayor por cuenta, balanza v2. `utils/csv.helper.ts`: UTF-8+BOM, separador `;`, decimales con coma
  → abre directo en Excel es-EC.
- **Client-side CSV** (datasets ya en pantalla): Balance General, Estado de Resultados,
  Formularios 103 y 104 (`src/lib/csv.ts`, mismo formato).

## 5. Roles nuevos  `[NUEVO]`

| Rol | Reglas backend (CASL) | En la UI contable ve |
|---|---|---|
| `AUDITOR` | `read all` (solo lectura; exports = GET) | Todas las pestañas de consulta + descargas; sin capturar, reversar, cerrar ni configurar |
| `TRIBUTARIO` | `create/read/update Accounting` + `read` Journal/Finance/Report/Purchase/Sales | Pestaña Tributario (103/104), catálogos IVA/retenciones, consulta contable |

- Frontend: `AppRole` ahora incluye además `TESORERIA` y `ANALISTA` (existían en UsersPage pero no en
  permissions). Nueva sección `PERMISSIONS.accounting`: `view / postManual / reverse / close / taxes / export / configure`.

## 6. ContabilidadPage por perfil  `[REDISEÑO]`

Pestañas y acciones según `PERMISSIONS.accounting`:

| Pestaña | Nueva | Qué tiene |
|---|---|---|
| Comprobación ⚖️ | ✅ | Balanza v2: fechas + nivel 1–5 + click→Mayor + totales + alerta de descuadre + CSV |
| Cierres 🔒 | ✅ | Grid de 18 meses (asientos, movimiento, estado); cerrar/reabrir con confirmación (solo `close`) |
| Tributario 🧾 | ✅ | Form 104 (IVA repercutido/soportado/neto) y 103 (detalle por código) por mes + avisos de vencimiento + CSV |
| Asientos 📓 | mejorada | Filtros (texto, cuenta, origen, estado, fechas, montos) + paginación + totales del filtro + CSV; captura manual solo `postManual`; reversar solo `reverse` |
| Mayor 📖 | mejorada | Botón CSV |
| Resumen 📊 | mejorada | BG y ER con botón CSV |
| Impuestos ⚙️ | gated | Solo `configure` (ADMIN/CONTADOR) |

**Mapa perfil → experiencia:**
- **Auxiliar contable** (`ASISTENTE_CONTABLE`): captura asientos, consulta todo, exporta; no reversa ni cierra.
- **Analista** (`ANALISTA`): consulta + balanza por niveles + exports; sin escritura.
- **Contador** (`CONTADOR`): todo — captura, reversa, cierres, tributario, configuración.
- **Tributario** (`TRIBUTARIO`): pestaña Tributario + catálogos de impuestos + consulta.
- **Auditor** (`AUDITOR`): consulta todo + descarga todo; cero escritura (también a nivel API).

## 7. Verificación

- `npx tsc --noEmit` verde en backend y frontend.
- `npm test`: **66/66** (10 nuevos: formato CSV, `PeriodClosedError`, tipado Supercías,
  validación/RBAC de fiscal-periods vía supertest sin BD, catálogo de roles).
- E2E con BD real **pendiente de Docker** (aplicar la migración primero).

## 8. Backlog

- Export **XLSX** con estilos (hoy CSV; Odoo confirmó que exporta a XLSX — ver §9).
- Asiento de **cierre anual** (resultado del ejercicio → patrimonio) al cerrar diciembre.
- ATS (Anexo Transaccional) exportable en XML.
- Casillas oficiales del SRI en el formulario 103 (302, 352…): Odoo las mapea explícitamente;
  nuestro Form103 agrupa por código de retención pero no por casilla oficial. Requiere un catálogo
  código→casilla normativo — no improvisar una tabla parcial que dé cifras incorrectas en un
  formulario tributario real.
- Selector de rango con presets (Este mes/trimestre/año fiscal, Mes/trimestre/año anterior) en los
  filtros de fecha de Comprobación y Mayor — hoy solo hay `from`/`to` libres; Odoo lo resuelve con
  un dropdown de presets + "Personalizado".
- Evaluar el modelo de **fecha de bloqueo única** de Odoo (Fechas bloqueadas: una fecha para
  no-asesores, otra para todos los usuarios, otra para impuestos) como alternativa/complemento al
  grid de cierre por mes que ya implementamos — es más simple para operar día a día, aunque el
  grid mensual da más trazabilidad por período.

## 9. Guía visual de Odoo y validación E2E (2026-07-04)

**Guía visual** (solo lectura, sesión ya abierta por el usuario, nada modificado): se navegó
Contabilidad → Informe → Balance general / Auditoría de diarios / Informe de impuestos, y
Contabilidad → Fechas bloqueadas. Confirmó que la Balanza v2 (saldo inicial+movimientos+saldo
final) ya implementada coincide con el estándar; reveló el modelo de fecha de bloqueo única
(alternativa anotada arriba); y las casillas oficiales del Form 103 SRI (302, 352…) como mejora
pendiente de catálogo normativo.

**Ejecución de la migración pendiente:** con Docker levantado por el usuario, se aplicó
`npx prisma migrate deploy` (`fiscal_periods` creada con sus índices y FK) y se regeneró el cliente
Prisma.

**Validación E2E contra BD real:** con backend+frontend corriendo, se registró una empresa de
prueba (`QA Contabilidad Sprint6`, sin tocar datos existentes), se sembró su plan de cuentas, y se
ejercitó el flujo completo vía API: crear asiento → cerrar mes → verificar bloqueo de creación y
reverso → verificar que otros meses no se ven afectados → reabrir → reintentar con éxito. Esto
expuso **2 bugs reales**, ya corregidos:

1. **Bug de zona horaria en la clasificación de mes.** `assertPeriodOpen`/`listPeriods` usaban
   `date.getFullYear()`/`getMonth()` (hora **local** del servidor) sobre fechas "solo fecha"
   (`"2026-08-01"`) que JS parsea como medianoche **UTC**. En un servidor con offset negativo
   (Ecuador, UTC-5, confirmado con `getTimezoneOffset()` = 300), un asiento del 1 de agosto se
   reclasificaba como 31 de julio → quedaba bloqueado por el cierre de julio. Corregido:
   `fiscal-period.service.ts` ahora clasifica y construye los rangos de mes enteramente en **UTC**
   (`utcYearMonth()`, `monthRangeUTC()`), incluida la aritmética de "mes actual" para no cerrar
   futuro y el bucle del grid de `listPeriods`.
2. **El reverso de un asiento no validaba el período del asiento ORIGINAL.** `reverseEntry` solo
   comprobaba que la fecha del *nuevo* asiento de reversa (siempre "hoy") no cayera en un mes
   cerrado, pero no el mes del original. Como los reportes excluyen asientos `status=REVERSED`,
   esto permitía modificar retroactivamente el contenido de un período ya cerrado (el original
   dejaba de contarse en la balanza/mayor de su propio mes, aunque ese mes siguiera "cerrado").
   Corregido: `reverseEntry` ahora exige `assertPeriodOpen` también sobre `original.entryDate` —
   reversar un asiento de un mes cerrado exige reabrir ese mes primero (huella explícita en Cierres).
3. **Hallazgo no relacionado al Sprint 6, corregido para poder verificar en navegador:** el proxy
   de Vite (`vite.config.ts`) apuntaba a `localhost:5001`, pero el backend corre en `5000`
   (default de `src/index.ts` si `PORT` no está seteado — coincide con `.claude/launch.json`). El
   `.env` decía `PORT=5001` pero no se aplicaba en este entorno, y el desajuste causaba `500` en
   TODO login desde el navegador (proxy con `ECONNREFUSED`). Se corrigió el proxy para apuntar al
   puerto real (`BACKEND_PORT` env override, default 5000).

**Cobertura añadida:** 3 tests de regresión en `sprint6-contabilidad.test.ts` para `utcYearMonth`
(clasificación correcta en el borde del mes, cambio de año). Suite completa: **69/69 verdes**.

**Verificado visualmente en navegador:** login (tras el fix de proxy), pestaña Cierres con el grid
mostrando los conteos correctos por mes, y pestaña Comprobación con la balanza renderizando las
cuentas y el botón de exportar CSV. (La prueba interactiva de clic en "Cerrar"/"Reabrir" no se pudo
completar por consola: el `window.confirm()` nativo del navegador embebido del entorno de preview
bloquea el hilo de JS de forma irrecuperable — se validó la misma acción exhaustivamente por API.)
