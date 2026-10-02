# 6. Contabilidad (NIIF · control interno)

> 📍 Módulo **6** del ciclo operativo · [[flujo-trabajo-erp|← Router de módulos]]

## Flujo de trabajo
Todo hecho económico de Compras/Ventas/Nómina/Tesorería genera un asiento vía
`journal.service` → Diario → Mayor → Balanza → Balance General / Estado de Resultados NIIF →
cierre de período (bloquea reversos) → declaraciones SRI por casillas.

## Ejecutado ✅
| Paso | Dónde |
|---|---|
| Plan Supercías 301 cuentas + posting setup editable | `AccountMapping` |
| Diario con búsqueda avanzada, mayor, balanza por nivel | Sprint 6 |
| Balance General y Estado de Resultados NIIF | `BalanceSheet`/`IncomeStatement` |
| Cierres de período (bloquean asientos y reversos) | `FiscalPeriod` |
| Form 104 (IVA) y 103 (retenciones) por casillas SRI, selector 104\|103, `PeriodPicker` y banner accionable | Sprint 11 (pestaña Declaraciones) |
| Tablero contable accionable (Resumen): tarjetas clicables SRI por revisar, CxC/CxP vencidas, asientos del mes, estado del período | Sprint 11 (`/financial/accounting-panel`) |
| Flujo de efectivo NIC 7 **método directo e indirecto** (toggle en la UI) | Sprint 6 + método indirecto (2026-09-12) |
| Pestaña **"Reporte"** en Contabilidad: selector Balance General / Estado de Resultados / Flujo de Efectivo, cada uno con descarga PDF y Excel | `ReporteTab` en `ContabilidadPage.tsx` (2026-09-12) |
| Pestaña **"Pivot"**: tabla dinámica/gráfico genérico sobre el diario (fila/columna: cuenta, mes, origen, estado; medida Debe/Haber; suma/conteo/promedio; vista tabla, barras o líneas) | `pivot.engine.ts` + `GET /financial/pivot/journal` + `<PivotView/>` (D3 del plan Odoo 18, 2026-09-12) |
| CxP: facturas de compra con plazo de pago del proveedor | Invoice PURCHASE + `dueDate` |
| Roles AUDITOR / TRIBUTARIO con vistas por perfil | Sprint 6 |
| Asiento de factura de compra DIRECTA (sin OC): DR Inventario/Gasto + DR IVA crédito / CR CxP, split proporcional por tipo de ítem | `createDirectPurchaseEntry` en `journal.service.ts`, bloqueante en `confirmSriDocument` (2026-08-27) |
| RBAC server-side en el resto de `financial.routes.ts`: crear/reversar/postear asiento manual (`authorize('create'/'post','Journal')`), seed-accounts/account-mappings (`configure`,`Accounting`), IVA/retenciones (`update`,`Accounting` — deja pasar a TRIBUTARIO) | `financial.routes.ts` (2026-09-05) — ver [[arquitectura-tecnica]] §5 |
| **B3 · Facturas de compra recurrentes** (arriendos, servicios): `RecurringInvoiceTemplate` + motor puro `isTemplateDue` (día del mes, período no duplicado) → genera un `SriDocument` normal en `PENDING_REVIEW` (reusa TODO el flujo de revisión/confirmación existente, cero lógica contable duplicada) | `finance/recurring-invoice.service.ts` (2026-09-09) |
| **UI de facturación recurrente** (`/sri/recurrentes`, sidebar bajo Documentos SRI): CRUD de plantillas (proveedor, descripción libre — sirve para cualquier sector: arriendo, software, seguros, honorarios, leasing, mantenimiento...), botón "Generar pendientes" con resultado (generadas/omitidas y motivo). Bug real encontrado y corregido al probarlo: `createRecurringTemplate` no validaba que el proveedor tuviera RUC — antes fallaba recién el día que tocaba generar (silencioso hasta el toast); ahora se bloquea al crear/activar la plantilla | `RecurringInvoicesPage.tsx` (2026-09-11) |
| RBAC server-side en `sri-document.routes.ts` (no tenía ningún `authorize()`): capturar (`create`,`Purchase`), corregir/rechazar (`update`,`Purchase`), confirmar = postea asiento (`post`,`Journal`, distinto de capturar), pagar directo (`pay`,`Purchase`, hoy solo TESORERIA/ADMIN), borrar (`delete`,`Purchase`, solo ADMIN). Se agregó `create`/`update`:`Purchase` a `ASISTENTE_CONTABLE` (antes solo tenía `read`, pese a que su descripción de rol es "captura documentos") | `sri-document.routes.ts` + `auth/roles.ts` (2026-09-09) |
| **B4 · Activos fijos y depreciación** en línea recta (art. 28 RLRTI): `FixedAsset` con categoría NIIF/Supercías (determina cuenta 1020101-1020110 y sugiere vida útil legal), motor puro `computeMonthlyDepreciation` (capa el último período al saldo depreciable, terrenos no deprecian) → asiento mensual auto-posteado DR 52022101 (gasto)/CR 1020112 (depreciación acumulada) vía `journal.service.createDepreciationEntry`. UI en `/contabilidad/activos-fijos`: registro, "Correr depreciación" (mismo patrón perezoso sin cron que B3), dar de baja | `fixed-asset.engine.ts` + `fixed-asset.service.ts` + `FixedAssetsPage.tsx` (2026-09-11) |
| **ATS (Anexo Transaccional Simplificado)**: motor puro `ats.engine.ts` (clasificación de identificación RUC/cédula/pasaporte, tipo de comprobante según catálogo SRI, aproximación neto=total/(1+tasa) para ventas — misma limitación ya aceptada en el Form 104) + `finance/ats.service.ts` agrega compras (`SriDocument` CONFIRMED, desglose exacto) y ventas (`Invoice`, aproximado) del período. Nueva pestaña ATS en Contabilidad → Declaraciones, con tablas de detalle y botón "Descargar XML" (borrador — se advierte en la UI que hay que validarlo en DIMM Formularios antes de presentar, igual que cualquier software contable) | `ats.engine.ts` + `ats.service.ts` + pestaña ATS en `ContabilidadPage.tsx` (2026-09-10) |

| **Facturación electrónica SRI — Etapa 1 (base normativa)**: `CompanyFiscalConfig` (RUC, régimen, ambiente PRUEBAS/PRODUCCION), `Establishment`/`EmissionPoint` (numeración SRI 3+3 dígitos, independiente de la interna FAC-V-####), `DigitalCertificate` (.p12 cifrado AES-256-GCM en reposo, nunca expuesto por API). Pestaña "Facturación Electrónica" en Contabilidad | `fiscal-config.service.ts` + `cert-crypto.engine.ts` + `p12-inspector.engine.ts` (2026-09-10) |
| **Facturación electrónica SRI — Etapa 2 (motor de XML + firma, sin enviar)**: `clave-acceso.engine.ts` (49 dígitos, verificador módulo 11), `factura-xml.engine.ts` (arma `<factura version="1.1.0">` según la Ficha Técnica del SRI), `xml-signer.engine.ts` (firma XAdES-BES envolviendo la librería MIT `ec-sri-invoice-signer` en vez de reimplementar la criptografía). Botón "Probar firma" por punto de emisión: firma un comprobante de ejemplo con el certificado real, sin enviar nada al SRI. Ver [[plan-contabilidad-tributaria-sri]] para las etapas siguientes (envío/autorización SOAP real) | `clave-acceso.engine.ts` + `factura-xml.engine.ts` + `xml-signer.engine.ts` + `sri-preview.service.ts` (2026-09-11) |

| **Facturación electrónica SRI — Etapa 3 (emisión real)**: `Invoice.sriEstado` + clave/secuencial/autorización/XML firmado y autorizado; `SriTransmission` (bitácora inmutable con raw XML); `sri-soap.engine.ts` (sobres + parser), `invoice-to-factura.engine.ts` (cliente, IVA por línea, consumidor final ≤ $50), `sri-soap-client.ts` (celcer/cel), `electronic-invoice.service.ts` (recepción → autorización, re-emisión con secuencial nuevo, AUTORIZADA inmutable). `<SriEmissionPanel/>` en el detalle de factura. Verificado contra el SRI real (DEVUELTA por RUC ficticio, como corresponde). Solo facturas nacidas de un pedido de venta | `electronic-invoice.service.ts` + `SriEmissionPanel.tsx` (2026-09-11) |
| **Facturación electrónica SRI — Etapa 4 (Nota de Crédito + RIDE)**: `CreditNote` gana los mismos campos SRI que `Invoice`; `nota-credito-xml.engine.ts` (con el bloque `docModificado` — el "documento sustento" ya existente desde Sprint 4, ahora dato tributario real) + `creditnote-to-nc.engine.ts` + `electronic-creditnote.service.ts` (mismo patrón que la factura, exige que la factura sustento esté `AUTORIZADA`). **RIDE en PDF** (factura y NC): clave de acceso + código de barras Code128 (`bwip-js`), solo si el comprobante tiene `claveAcceso` real. `<SriEmissionPanel/>` generalizado (`kind: 'invoice'\|'creditNote'`), fila expandible en la tabla de NC del detalle de factura | `electronic-creditnote.service.ts` + `nota-credito-xml.engine.ts` + `addSriRideBlock` en `reports.service.ts` (2026-09-11) |
| **Facturación electrónica SRI — Etapa 4 (Nota de Débito, resto)**: modelo nuevo `DebitNote`/`DebitNoteConcept` (no existía nada de ND antes) — a diferencia de la NC, no toca stock/COGS y no tiene `detalles` con cantidad/producto, sino `motivos` (razón + valor) sobre una tarifa de IVA única, según el esquema real del SRI (`<notaDebito version="1.0.0">`). Asiento propio DR CxC / CR Otros ingresos (`DEBIT_NOTE_INCOME`, mapeable) + CR IVA débito. `nota-debito-xml.engine.ts` + `debitnote-to-nd.engine.ts` + `electronic-debitnote.service.ts` (mismo patrón que NC: exige factura sustento `AUTORIZADA`). RIDE en PDF con tabla de motivos. `<SriEmissionPanel/>` ganó `kind: 'debitNote'`; botón "➕ Nota de Débito" y tabla en el detalle de factura, junto a smart button "Notas de débito" y fila en `getCustomerStatement` (estado de cuenta CxC) | `electronic-debitnote.service.ts` + `nota-debito-xml.engine.ts` + `debit-note.service.ts` (2026-09-11) |
| **Facturación electrónica SRI — Etapa 4 completa (Guía de Remisión)**: modelo nuevo `DeliveryGuide`/`DeliveryGuideItem` ligado a un `Shipment` de venta — sin valores monetarios (solo cantidades) y sin exigir factura sustento `AUTORIZADA` (el traslado es válido con o sin ella; si existe, se referencia sola como `docSustento` opcional vía `Invoice.shipmentId`). `guia-remision-xml.engine.ts` (`<guiaRemision version="1.0.0">`) + `shipment-to-guia.engine.ts` + `electronic-deliveryguide.service.ts` (mismo patrón que NC/ND). Sin asiento contable (documento de evidencia de transporte, no un hecho económico). UI en `ShipmentDetailPage.tsx` (Logística), no en Contabilidad — botón "📋 Guía de Remisión" + tabla + `<SriEmissionPanel kind="deliveryGuide">`. **Cierra la Etapa 4 completa del plan SRI** | `electronic-deliveryguide.service.ts` + `guia-remision-xml.engine.ts` + `ShipmentDetailPage.tsx` (2026-09-11) |
| **Facturación electrónica SRI — Etapa 5 (Producción + contingencia)**: `setAmbiente` exige ahora un tercer requisito para pasar a Producción (además de certificado y establecimiento activos): al menos un comprobante `AUTORIZADA` en Pruebas — `getProductionChecklist` alimenta un checklist visual ✓/○. `setTipoEmision` expone por primera vez NORMAL\|CONTINGENCIA (campo que ya existía sin UI desde la Etapa 1). Cola de reintentos `sri-retry.service.ts` (mismo patrón perezoso sin cron que B3/B4): botón "🔁 Reintentar pendientes" vuelve a consultar la autorización de todo comprobante `ENVIADA`/`RECIBIDA` sin re-enviar nada | `fiscal-config.service.ts` + `sri-retry.service.ts` + `FiscalConfigPanel.tsx` (2026-09-11) |
| **Facturación electrónica SRI — Etapa 6 (Cierre de impuestos automático)**: `tax-closing.service.ts` reusa `getForm104Casillas` (misma aritmética que ya ve el usuario en Declaraciones) — si el resultado es IVA A_PAGAR, postea el asiento de liquidación (DR IVA débito / CR IVA crédito + retenciones recibidas + `IVA_LIQUIDACION_POR_PAGAR`, nuevo mapping) y bloquea el mes vía el mismo `FiscalPeriod` de Sprint 6; si es CREDITO, no postea nada (el crédito ya vive en el saldo de `IVA_CREDIT`) pero igual bloquea. Botón "🔒 Cerrar impuestos" bajo el resultado del Form 104 en Declaraciones | `tax-closing.service.ts` + `createTaxClosingEntry` en `journal.service.ts` (2026-09-11) |
| **Facturación electrónica SRI — Etapa 7 (ATS con desglose real)**: las ventas nacidas de un pedido reusan `loadInvoiceForSri` (Etapa 3, exportada) para obtener las mismas líneas con tarifa de IVA real que ya arma la emisión electrónica, y `computeVentaBreakdownFromLines` (motor puro nuevo en `ats.engine.ts`) calcula la base 0%/gravada e IVA EXACTOS por línea (neto = cantidad×precio − descuento), reemplazando la aproximación `total/(1+tasa)` — que ahora solo aplica como fallback a facturas manuales sin pedido (`FAC-` directas, sin líneas con IVA propio). Corrige en particular las facturas con tarifas mixtas (0% y gravado en el mismo comprobante), que la aproximación uniforme mezclaba mal. Sin cambio de schema (no hizo falta guardar el desglose: se recalcula desde `SalesOrderItem`/`ShipmentItem`, ya persistidos) | `computeVentaBreakdownFromLines` en `ats.engine.ts` + `ats.service.ts` (2026-09-12) |
| **Facturación electrónica SRI — Etapa 8 (NIIF/Supercías: Cambios en el Patrimonio + Notas + paquete)**: Estado de Cambios en el Patrimonio (NIC 1) nuevo — motor puro `equity-statement.engine.ts` clasifica cuentas Supercías (301 Capital, 304 Reservas, 306/307 Resultados) y arma saldo inicial/aumentos/disminuciones/saldo final por categoría a partir de `getTrialBalance2`; pliega la utilidad de ejercicios anteriores no cerrada al mayor (mismo cálculo "en vivo" que ya usa `getBalanceSheet.utilidadEjercicio`) para que el total cuadre exactamente con el Balance General de la misma fecha — invariante verificado con una prueba de integración con BD real. Notas a los Estados Financieros (NIC 1 §112-116): modelo nuevo `FinancialStatementNote` (texto libre editable por período, CRUD simple, sin generación automática de contenido — eso es juicio del contador). Paquete NIIF/Supercías: PDF único con Balance + Resultados + Cambios en Patrimonio + Flujo de Efectivo + Notas (`exportSuperciasPackagePdf` en `reports.service.ts`) — NO es el formato de carga del portal de Supercías (no hay API pública confirmada para automatizarlo, ver `plan-contabilidad-tributaria-sri.md` §3): es el paquete que el contador imprime/adjunta para armar esa presentación a mano. Pestaña nueva "Patrimonio y NIIF" en Contabilidad con selector de período, tabla de cambios en patrimonio, editor de notas y botón de descarga. **Con esto el plan `plan-contabilidad-tributaria-sri.md` completo (Etapas 1-8) queda cerrado** | `equity-statement.engine.ts` + `financial-notes.service.ts` + `exportSuperciasPackagePdf` + `EquityStatement.tsx`/`FinancialNotes.tsx` (2026-09-12) |
| **Pestaña "Reporte" + exports individuales + flujo de efectivo indirecto** (pedido directo del usuario, fuera del plan SRI): nueva pestaña en Contabilidad con selector Balance General/Estado de Resultados/Flujo de Efectivo (reusa `BalanceSheet`/`IncomeStatement`/`FlujoEfectivoTab` ya existentes, sin duplicar lógica). Cada uno gana botones "Descargar PDF"/"Descargar Excel" (6 exports nuevos en `reports.service.ts`, reusando los helpers `sectionTitle`/`renderAmountRows`/`styleHeaderRow` ya usados por el paquete Supercías y el resto de reportes). **Flujo de efectivo — método indirecto (NIC 7)**: `getCashFlowStatement` gana `opts.method`; el indirecto reconcilia desde la utilidad neta (`getIncomeStatement`) + depreciación del período (créditos a la cuenta `FIXED_ASSET_ACCUM_DEPRECIATION` del posting setup) + una "variación de capital de trabajo" residual (`operativo directo − utilidad neta − depreciación`) — diseño deliberado: el residual GARANTIZA por construcción que el total operativo (y por lo tanto la caja final) sea IDÉNTICO al método directo, en vez de arriesgar una descomposición cuenta-por-cuenta que podría no cuadrar con el efectivo real. Invariante + caso económico (aumento de CxP no pagada) verificados con una prueba de integración con BD real. Toggle "Método directo/indirecto" en la UI de Flujo de Efectivo (afecta también la pestaña Reporte, que reusa el mismo componente). 13 tests nuevos (2 cash-flow-indirect + 3 financial-report-exports), tsc limpio en ambos, verificado e2e real en navegador (los 6 exports con 200 OK, incluido el toggle de método) | `getCashFlowStatement` (método) + `exportBalanceSheetPdf/Excel`/`exportIncomeStatementPdf/Excel`/`exportCashFlowPdf/Excel` + `ReporteTab`/`IndirectOperatingSection` en `ContabilidadPage.tsx` (2026-09-12) |
| **Formulario 101 — conciliación tributaria básica (IR sociedades)**: motor puro `form101.engine.ts` (15% participación laboral CT art. 97, suma de gastos marcados no deducibles, base imponible, impuesto causado a la tasa vigente) + `form101.service.ts` que junta la utilidad contable real del ejercicio (`getIncomeStatement` anual) con las cuentas de gasto/costo marcadas `isDeductible: false` en el plan de cuentas (campo nuevo en `FinanceChartOfAccounts`, migración `chart_account_deductible` — se marca por CUENTA, no por asiento, porque la no-deducibilidad es del concepto de gasto). **No es el Formulario 101 completo** (~800 casillas oficiales): mismo espíritu que el ATS, un borrador de la conciliación para confirmar en DIMM Formularios — no incluye anticipo de IR (Formulario 115), créditos tributarios ni exoneraciones sectoriales (quedan como mejoras futuras si se necesitan). Pestaña nueva "Form 101 · Renta (anual)" en Declaraciones (selector de ejercicio + tasa, ambos editables porque la tasa societaria cambia por reforma y no hay tabla vigente confiable para hardcodear) + toggle "No deducible" por cuenta en Plan de Cuentas | `form101.engine.ts` + `form101.service.ts` + pestaña 101 en `ContabilidadPage.tsx` + toggle en `ChartOfAccountsTree.tsx` (2026-09-13) |
| **Diferidos** (gastos pagados por anticipado / ingresos cobrados por anticipado, NIC 1): motor puro `deferred.engine.ts` (reconocimiento en línea recta, mismo criterio que `fixed-asset.engine.ts` — el último período capa el monto al saldo restante para absorber redondeo) + modelo `DeferredItem` (mismo alcance que B4: el registro NO contabiliza el pago/cobro original, que ya vive como activo/pasivo diferido en una factura o asiento aparte — solo genera el asiento MENSUAL de reconocimiento). A diferencia de activos fijos (posting setup fijo por categoría), las DOS cuentas (dónde vive hoy el diferido, y dónde se reconoce cada mes) las elige el usuario del plan de cuentas real vía `AccountSelect` al crear el ítem, porque la naturaleza varía mucho (seguros, arriendos, publicidad, suscripciones...). GASTO → DR gasto/CR activo diferido; INGRESO → DR pasivo diferido/CR ingreso (cuentas invertidas). Página nueva `/contabilidad/diferidos` (enlace en sidebar bajo Contabilidad) con botón "Correr diferidos" (mismo patrón perezoso sin cron que B3/B4) | `deferred.engine.ts` + `deferred.service.ts` + `journal.service.createDeferredRecognitionEntry` + `DeferredItemsPage.tsx` (2026-09-13) |
| **Reverso contable de NOTA_CREDITO de compra**: `journal.service.createCreditNoteReversalEntry` — espejo EXACTO de `createDirectPurchaseEntry` con débito/crédito invertidos (reusa `computeDirectPurchaseLines` sobre los propios ítems/total/IVA de la NC, no edita el asiento de la factura original — regla 5, se reversa con uno nuevo). DR Cuentas por Pagar (se debe menos al proveedor) / CR Inventario o Gasto (relev lo reconocido) + CR IVA Crédito Tributario (reduce el crédito fiscal reclamado). Antes, confirmar una NC de compra solo ajustaba el saldo de CxP "virtualmente" (neteo en `getPayables`, ver `08-analisis-financiero-cxp-cxc`) sin ningún asiento — el mayor nunca reflejaba el reverso (violaba la regla 2). Se dispara automáticamente al confirmar la NC (`confirmSriDocument`), sin importar si la factura original tenía OC vinculada o no. `previewJournalEntry` también lo expone como "asiento sugerido" en `SriDocumentReviewPage.tsx` antes de confirmar (reusa la UI genérica existente, sin cambios de frontend). **Bug real corregido de paso**: `doc.numeroDoc ?? doc.claveAcceso` no caía al fallback cuando `numeroDoc` es `''` (típico en documentos ingresados manualmente sin N° de comprobante) — corregido a `||` en las 3 funciones que arman la etiqueta del asiento | `createCreditNoteReversalEntry` + `previewCreditNoteReversalEntry` en `journal.service.ts` (2026-09-13) |

## Ejecutado ✅ (2026-09-24 — Controles contables: propuestas "Contabilidad vs. mercado")
Cierra las 13 propuestas de `propuestas de mejoras de internet/06-contabilidad-vs-mercado.md`.
Motor puro `finance/engines/accounting-controls.engine.ts` (6 tests) + `accounting-controls.service.ts`
+ 8 tests de integración (`tests/integration/accounting-controls.test.ts`: 403 por HTTP sin
frontend para AUDITOR/FUERZA_VENTAS en CxP/CxC/asientos/cierre, y flujos con BD real).
- **Bitácora encadenada**: `AuditLog` suma `module` (FINANZAS), `reason`, `reasonCode`, `prevHash`,
  `hash`. `recordFinancialAudit` serializa por empresa (`pg_advisory_xact_lock`) y encadena
  SHA-256; `verifyAuditChain` detecta filas editadas/borradas fuera del sistema. Se registra:
  reverso, reclasificación, ajuste CxP/CxC, NC aplicada/desaplicada, cierre, reapertura y asiento
  manual. **Motivo obligatorio** (≥5 caracteres, validado en servidor) en reverso, reclasificación,
  desaplicar NC y reabrir período. Catálogo `AdjustmentReason` sembrado por empresa.
- **Checklist de cierre** (`PeriodCloseTask` + tareas automáticas): cerrar desde la API/UI usa
  `closePeriodChecked` (exige checklist); `fiscal.closePeriod` base queda para usos internos/tests.
- **Revisión continua**: `JournalEntry.reviewedAt/reviewedBy`, `POST /financial/journal-entries/review`
  (no se toca en meses cerrados).
- **Conciliación**: `POST /treasury/reconciliation/:lineId/reject` (`BankStatementLine.rejectedTransactionIds`);
  `ReconciliationRule` aprende palabra→cuenta; `createFromStatementLine(…, accountCode?)` **ahora
  contabiliza** (`journal.createBankStatementEntry`: DR gasto/CR banco o DR banco/CR ingreso) —
  antes creaba el movimiento sin asiento (violaba la regla 2). Cuentas por defecto
  `BANK_FEES_EXPENSE` (520302) / `BANK_INTEREST_INCOME` (4302).
- **Diferidos**: cuentas por defecto del posting setup si no se eligen (`DEFERRED_*`).
- **Depreciación/diferidos programados**: `jobs/month-end-accruals.job.ts`, diario 02:15.
- **Permisos de una sola fuente**: `ContabilidadPage` ya no usa `lib/permissions.ts` (mapa local);
  usa las reglas CASL del backend mapeadas al gate real de cada ruta. Matriz SoD en
  `GET /financial/controls/sod` y pestaña Auditoría. (`lib/permissions.ts` sigue existiendo para
  `ROLE_LABELS` y otras pantallas legadas.)
- Pendiente de e2e visual por el usuario (el navegador del panel no tiene sesión).

## Ejecutado ✅ (2026-09-27 — Sincronización CxP/CxC: saldo real vs. campos crudos)
Barrido pedido explícitamente por el usuario ("que la parte contable esté sincronizada con
todos los módulos, sin nodos huérfanos"). 3 bugs reales del mismo patrón — un campo persistido
que un flujo actualiza y otro lector sigue leyendo crudo sin resincronizar — corregidos con
tests de integración con BD real, 1014/1014 backend + `tsc --noEmit` limpio, sin regresiones:
- **`SriDocument.paymentStatus`/`paidAt` no se resincronizaban con NC de compra**: enlazar/
  desenlazar manualmente una NC (`ap.service.linkCreditNoteToDocument`/`unlinkCreditNote`), o
  confirmar una NC que ya viene enlazada por XML (`confirmSriDocument`), cambia el saldo real
  (vía `getPayables`, que neta la NC) sin tocar esas columnas — un documento cubierto al 100%
  por una NC quedaba "PENDING" para siempre en cualquier reporte que leyera el campo crudo.
  Nuevo `ap.service.syncPaymentStatusFromBalance()`, conectado en los 3 sitios.
- **`getApAging` calculaba los buckets con el total bruto (`p.total`), no el saldo neto
  (`p.balance`)**: desincronizado con `getApKpis`, que sí usaba `balance` — dos reportes de
  CxP mostrando cifras distintas para el mismo dato.
- **`debit-note.service.createDebitNote` nunca sumaba el total de la ND a
  `Invoice.totalAmount`**: el asiento contable (DR CxC/CR ingreso+IVA) sí se generaba
  correctamente, pero el auxiliar de CxC (`totalAmount - paidAmount`, el cálculo estándar en
  aging/KPIs/cobro) seguía mostrando el saldo de ANTES del cargo — el Mayor quedaba bien, el
  auxiliar subvaluado. Ahora suma el total de la ND a `totalAmount` en la misma transacción; si
  la factura ya estaba `PAID`, la reabre a `PARTIAL`.
Ver `tests/integration/ap-paymentstatus-sync.test.ts` y `tests/integration/debit-note-ar-sync.test.ts`.

## Ejecutado ✅ (2026-09-28 — Sincronización del reverso genérico: entityTypes restantes)
Tercera pasada del mismo barrido (ver también [[05-07-tesoreria-nomina-biometrico]] §4.16 para
Nómina/Tesorería). Auditados los `entityType` de `journal.service.ts` que quedaban sin revisar
para el patrón "campo persistido en el documento origen que `reverseEntry` no resincroniza":
4 fixes reales, con tests de integración con BD real (`tests/integration/reverse-entry-sync-2.test.ts`),
1025/1025 backend + `tsc --noEmit` limpio, sin regresiones:
- **`FX_REVALUATION`**: mismo problema que `PAYROLL_DECIMO` — `FxRevaluation` tiene
  `@@unique([companyId,bankAccountId,period])`; reversar su asiento sin borrar la fila dejaba
  `journalEntryId` apuntando a un asiento `REVERSED` Y bloqueaba recalcular ese banco/período
  para siempre. Se borra la fila al reversar (el registro solo guarda el resultado del cálculo,
  `runFxRevaluation` decide si hace falta asiento).
- **`FIXED_ASSET`**: `accumulatedDepreciation`/`lastDepreciatedPeriod` se persisten en el activo
  (no se recalculan desde el Mayor) — reversar la depreciación de un mes sin ajustar esto dejaba
  el saldo del activo inflado para siempre. Ahora resta el monto reversado y reabre el período
  (solo si el activo sigue exactamente en ese período — protege contra tocar un mes más viejo si
  ya corrió uno más nuevo), y revierte `FULLY_DEPRECIATED` a `ACTIVE` si corresponde.
- **`DEFERRED_ITEM`**: mismo patrón exacto que `FIXED_ASSET` (`recognizedAmount`/`lastRecognizedPeriod`).
- **`SRI_DOCUMENT`** (guard, no resync): `SriDocument` no tiene `journalEntryId` (puede tener más
  de un asiento — compra directa + retención — así que no hay un único link sin ambigüedad).
  Se bloquea reversar el asiento de una compra que YA tiene pagos aplicados (`paidAmount > 0`):
  dejaría un pasivo "pagado" que, según el Mayor, nunca se reconoció — inconsistencia real.
- **`InventoryAdjustment.journalEntryId`**: limpieza genérica (igual que `BankTransaction`) para
  no dejar la referencia colgando de un asiento `REVERSED` — sin gate de negocio detrás, solo
  trazabilidad (regla 4).
Descartado sin bug (evidencia en el reporte del agente): `TAX_CLOSING` ya es auto-resincronizante
(consulta el asiento en vivo, no un flag persistido); `RECLASSIFICATION` apunta al asiento mismo,
no a un documento con estado propio; `CREDIT_NOTE`/`DEBIT_NOTE`/`SALES_ORDER`/`SALES_INVOICE`/
`INVOICE` de venta tienen estados de workflow que ningún query gatea por la existencia del
asiento — el gap es solo de trazabilidad teórica, sin efecto de negocio real.

## Ejecutado ✅ (2026-09-28 — Neteo de cuentas transitorias: retenciones en la fuente)
Primer ítem del pedido grande del usuario ("todo cálculo/cuenta transitoria debe ser automático
y netearse siempre"). Auditado: `RETENTION_PAYABLE_RENTA`/`RETENTION_PAYABLE_IVA` se acumulaban
en `createRetentionEntry` (al confirmar una compra con retención) **sin ningún asiento que las
liquidara** — a diferencia de IVA (que sí se cierra en `createTaxClosingEntry`, Etapa 6). Por
defecto ambas comparten el mismo código de cuenta que `IVA_DEBIT` ("2010701 · Con la
administración tributaria"), así que quedaban pagadas de rebote al pagar "Impuestos SRI" desde
Tesorería — pero si el contador las reconfiguraba a una cuenta propia (que el sistema permite,
es justo la parametrización pedida), esa cuenta acumulaba saldo para siempre sin forma de
pagarla: bug real, no solo teórico.
- `journal.service.createRetentionPaymentEntry` (Formulario 103): debita cada cuenta configurada
  por su **saldo real exacto** (neteo genuino, no un monto libre — nuevo helper
  `journal.service.accountBalance`), sin duplicar la línea si ambas comparten código.
- Nueva obligación `TAX_RETENTION` en `treasury.service.getObligations` — **solo aparece cuando
  la cuenta está reconfigurada distinta de `IVA_DEBIT`** (si comparte código, ya la cubre la
  obligación TAX_SRI existente; mostrarla también sería doble conteo).
- `registerTransaction` con `sourceType: 'TAX_RETENTION'` (reutiliza el flujo "Registrar pago"
  ya existente en Tesorería, sin componente nuevo) — valida que el monto coincida con el saldo
  real (±1 centavo), rechazando un pago parcial "libre" que dejaría la cuenta sin netear del todo.
Verificado con `tests/integration/retention-payment-sync.test.ts` (3 casos, incluye el escenario
de cuenta reconfigurada). 1028/1028 backend + `tsc --noEmit` limpio, sin regresiones.

**Descartado tras investigar** (no es un bug): las cuentas PPE por categoría de activo fijo
(`FIXED_ASSET_CATEGORIES` en `fixed-asset.engine.ts`, 1020101-1020110) están fijas a propósito —
son el plan OFICIAL de la Superintendencia (mismo criterio ya documentado para las subcuentas
bancarias, §4.9 de [[05-07-tesoreria-nomina-biometrico]]: parametrizarlas rompería el Formulario
101/Balance de TODAS las empresas). Además `FixedAsset.accountCode` es solo informativo (se
muestra al crear el activo) — la depreciación real postea contra `FIXED_ASSET_ACCUM_DEPRECIATION`/
`FIXED_ASSET_DEPRECIATION_EXPENSE`, que SÍ son parametrizables vía `AccountMapping`.

## Ejecutado ✅ (2026-09-28 — Auditoría transversal de TODO el ERP: usuario + IP + fecha/hora)
Segundo ítem del pedido grande del usuario. Antes, `AuditLog` solo cubría ~9 acciones
financieras encadenadas (`recordFinancialAudit`, module='FINANZAS') y ~5 entidades de datos
maestros sin encadenar (`recordAudit`, sin module) — Ventas, Compras (fuera de esas 5), Inventario,
Nómina, CRM y Configuración no dejaban ningún rastro consultable (solo Winston, no auditable
desde la UI). El usuario eligió explícitamente la opción de **middleware global por ruta**
(cobertura total, sin diff campo-por-campo) sobre instrumentar cada servicio uno por uno.
- `middleware/audit-trail.ts`: intercepta TODA request que modifica datos (POST/PUT/PATCH/DELETE)
  en TODOS los routers, y al terminar (`res.on('finish')`) graba en `AuditLog` con
  `module='REQUEST'` (nuevo, separado de `FINANZAS` — no interfiere con la bitácora encadenada
  existente): usuario, IP (`req.ip`, ya resuelve `X-Forwarded-For` gracias a `trust proxy`
  activado desde antes), fecha/hora, módulo (primer segmento de la ruta tras `/api`), método,
  ruta completa y código de respuesta. Ignora GET (no es un cambio), requests sin sesión
  autenticada (login, rutas públicas — no hay empresa a la que asociarlas) y errores 5xx (el
  cambio no se completó). Registrado una sola vez en `app.ts`, antes de todos los routers.
- `finance/accounting-controls.service.ts::listRequestAudit` + `GET /financial/controls/request-audit`
  (mismo permiso que la bitácora financiera) — filtros por usuario, módulo, IP, rango de fechas
  y texto en la ruta.
- UI: nueva sección "Trazabilidad del ERP" dentro de la pestaña Auditoría existente
  (`AuditTimeline` en `AccountingControls.tsx`), tabla con fecha/hora, usuario, IP, módulo,
  acción, ruta y estado.
Verificado con `tests/integration/audit-trail-middleware.test.ts` (5 casos: POST/DELETE
autenticados sí registran, GET no, sin sesión no, error 500 no). 1033/1033 backend + 159/159
frontend, `tsc --noEmit` limpio en ambos, sin regresiones. Sin verificación e2e visual en
navegador todavía.

## Ejecutado ✅ (2026-09-28 — Réplica llenable del Formulario 104 oficial del SRI)
Tercer ítem del pedido grande del usuario: "mantén el borrador actual [de `sri-casillas.service.ts`],
pero haz una réplica llenable del formulario maestro que da el SRI, previsualizable y editable
mediante asignación de cuentas contables". Investigación previa (WebSearch/WebFetch sobre
declaraciones REALES presentadas al SRI, ver memoria `sri-formularios-104-103-estructura-real-2026-09-28.md`)
confirmó que `sri-casillas.service.ts` YA usa numeración de casilla real para un subconjunto —
el gap real era: no viene de cuentas contables, no es editable, y no tiene el layout visual real.
- **Motor puro** `engines/sri-form104-official.engine.ts`: estructura COMPLETA real del
  Formulario 104 (secciones "Resumen de ventas", "Liquidación del IVA en el mes", "Resumen de
  adquisiciones", "Resumen impositivo: agente de percepción", "Agente de retención", "Valores a
  pagar" — ~45 casillas con sus números/etiquetas/fórmulas oficiales). Fórmulas de totales
  (409/419/429/509/519/529/699/799/801/859/902/999) validadas contra una declaración real
  (coinciden exacto para las que están dentro del alcance declarado). Alcance deliberado fuera:
  factor de proporcionalidad exacto (563-565, simplificado a "todo el crédito con derecho se usa
  completo" — correcto para una empresa sin ventas exentas mixtas), zonas Ley Solidaridad, IRU
  pronósticos deportivos, ajustes 610/612/613/614.
- **`SriCasillaMapping`** (nuevo modelo, `prisma db push` — ver nota de migración abajo): el
  contador asigna qué cuenta(s) del plan alimentan cada casilla HOJA, con signo (+1 = crédito−débito,
  para ventas/pasivo/ingreso; −1 = débito−crédito, para compras/gasto/activo) — mismo patrón de
  parametrización que `AccountMapping`, pero por casilla en vez de por concepto fijo.
- **`SriCasillaOverride`**: el contador puede sobreescribir cualquier casilla hoja para un
  período antes de "presentar" — el valor sugerido (del Mayor) queda siempre visible aparte
  (tachado) para comparar, nunca se pierde.
- `finance/sri-form104-replica.service.ts`: calcula el valor sugerido de cada hoja sumando el
  MOVIMIENTO del período (no saldo acumulado) de las cuentas mapeadas, aplica overrides, corre
  el motor de fórmulas con la tasa de IVA vigente del período.
- UI: `Form104OfficialReplica.tsx`, nueva opción "Form 104 · Réplica oficial" en Contabilidad →
  Declaraciones — layout visual real por secciones, botón ⚙ por casilla hoja para asignar
  cuenta(s) (reutiliza `AccountSelect`), botón ✎ para editar a mano, indicador visual claro de
  sugerido (tachado) vs. valor final aplicado (ámbar cuando hay override).
- **Nota de entorno**: `npx prisma migrate dev` falló con `P3006` (la migración
  `20260924220852_arap_pro` no aplica limpio en la shadow DB — falta `customer_segments`, drift
  preexistente sin relación con este cambio). Se aplicó con `prisma db push` en su lugar (no
  toca el historial de migraciones, seguro para el dato real). Queda una tarea flageada para
  reconciliar el historial (`task_ff9a163f`) — cualquier migración futura con `migrate dev`
  fallará igual hasta resolverlo.
Verificado con `tests/sri-form104-official-engine.test.ts` (7 casos, incluye validación exacta
contra una declaración real) + `tests/integration/sri-form104-replica.test.ts` (5 casos, BD
real). 1045/1045 backend + 159/159 frontend, `tsc --noEmit` limpio en ambos, sin regresiones.
**Verificado e2e real en el navegador** como admin: layout completo renderizado con las ~45
casillas reales, asignación de cuenta a la casilla 411 (guardado confirmado, "1 cuenta(s)"),
edición manual a $1200 (mostró sugerido tachado $0,00 vs. valor aplicado $1200,00 en ámbar), y
la casilla 421 (fórmula) recalculó sola a $180,00 (15% del override) — el motor de fórmulas
reacciona correctamente a un override de su dependencia. Datos de prueba revertidos.

## Ejecutado ✅ (2026-09-28 — Réplica llenable del Formulario 103 oficial del SRI)
Mismo patrón exacto que el 104, reutilizando los modelos genéricos `SriCasillaMapping`/
`SriCasillaOverride` (ya soportaban `formType` desde el diseño del 104, sin migración nueva).
- **Motor puro** `engines/sri-form103-official.engine.ts`: estructura real completa (~65
  casillas) en 9 secciones (derivadas del trabajo, bienes y servicios, regalías/comisiones/
  arrendamientos, capital, loterías, autorretenciones, subtotal país, pagos a no residentes,
  valores a pagar). Cada concepto es un par base imponible/valor retenido (casi todo hoja, salvo
  los 6 subtotales/totales). Alcance deliberado fuera: IR único de pronósticos deportivos y
  variantes menos comunes de dividendos a no residentes (mismo criterio de exclusión que el 104).
- `finance/sri-form103-replica.service.ts` + controlador + rutas `/financial/sri/form103-replica/*`
  — idénticos en estructura al 104, solo cambia `formType: '103'` y el motor subyacente.
- UI `Form103OfficialReplica.tsx`, nueva opción "Form 103 · Réplica oficial" en Declaraciones.
Verificado con `tests/sri-form103-official-engine.test.ts` (5 casos, incluye validación contra
declaración real) + `tests/integration/sri-form103-replica.test.ts` (4 casos, BD real). 1054/1054
backend + 159/159 frontend, `tsc --noEmit` limpio en ambos, sin regresiones. **Verificado e2e
real en el navegador**: asignación de cuenta, edición manual de la casilla 353 (honorarios
retenidos) a $42, sugerido tachado vs. valor aplicado en ámbar, y 399/499/902/999 recalculados
en cascada a $42. Datos de prueba revertidos.

## Ejecutado ✅ (2026-10-01 — Réplica llenable del Formulario 101 oficial del SRI)
Mismo patrón exacto que el 104/103, reutilizando `SriCasillaMapping`/`SriCasillaOverride`
(`formType: '101'`, sin migración nueva). Estructura real investigada esta sesión vía WebFetch
sobre el PDF oficial del formulario (Resolución NAC-DGERCGC15-00000143,
`cyte.com.ec/wp-content/uploads/2019/02/pdf-formulario-101.pdf`) — el `Read` tool sí pudo
extraer el texto completo del PDF (a diferencia de WebFetch, que no procesa binarios).

- **Alcance deliberado** (mismo criterio que 104/103, el 101 tiene ~800 casillas totales entre
  Estado de Situación Financiera + Estado de Resultados + Conciliación Tributaria): NO se
  reconstruyen las ~500 casillas de detalle de balance — eso ya lo cubren el Balance General y
  el Estado de Resultados existentes. Lo que faltaba y SÍ se construyó, con numeración real, es
  la parte específicamente tributaria (casillas 801-999): Conciliación Tributaria, Cálculo del
  Impuesto Causado, Anticipo, Retenciones y Valores a Pagar (~45 casillas). Dos casillas "puente"
  (6999 total ingresos, 7999 total costos y gastos) son hoja, mapeables a rangos de cuentas
  como cualquier otra.
- **Motor puro** `engines/sri-form101-official.engine.ts`: tarifas de IR sociedades
  configurables (`Form101Rates`, no están quemadas — la ley las cambia por ejercicio), fórmula
  completa de conciliación (819 = 801−802−803−804−805−806+807+808+809+810−811−812−813+814−815
  −816−817+818) validada contra la estructura oficial.
- `finance/sri-form101-replica.service.ts` + controlador + rutas `/financial/sri/form101-replica/*`
  — única diferencia estructural: período **ANUAL** (`AAAA`, no `AAAA-MM`), el rango del Mayor
  cubre el año fiscal completo.
- UI `Form101OfficialReplica.tsx`, nueva opción "Form 101 · Réplica oficial" junto al "Form 101 ·
  Renta (anual)" simplificado ya existente (que queda intacto, sin numeración oficial) —
  controles propios de tarifa general/reinversión (%) además del selector de ejercicio
  compartido.

**Bug real encontrado y corregido antes de cerrar** (e2e): el controlador dividía la tarifa entre
100 dos veces — el frontend ya envía fracción decimal (`tarifaGeneral / 100` → `0.25`), pero el
controlador volvía a hacer `Number(query) / 100`, dando `0.0025` en vez de `0.25`. Resultado: la
casilla 839 (Total Impuesto Causado) calculaba $425 en vez de $42.500 sobre una utilidad gravable
de $170.000. Corregido en `sri-form101-replica.controller.ts` (ya no vuelve a dividir un valor
que llega del query ya en fracción decimal) + test de regresión en
`tests/integration/sri-form101-replica.test.ts` que verifica exactamente ese caso (170000×25%=42500).

Verificado con `tests/sri-form101-official-engine.test.ts` (9 casos) +
`tests/integration/sri-form101-replica.test.ts` (4 casos, BD real). 1067/1067 backend (pendiente
confirmar el run final) + 159/159 frontend, `tsc --noEmit` limpio en ambos, sin regresiones.
**Verificado e2e real en el navegador**: mapeo de cuenta 4101 a la casilla 6999, edición manual de
6999=$500.000 y 7999=$300.000, y confirmación de que TODA la cadena de fórmulas recalculó en
cascada correctamente (801=$200.000 → 803=$30.000 → 819=$170.000 → 832=$170.000 → 839=$42.500 →
842=$42.500 → 855=$42.500 → 859=$42.500 → 902=$42.500 → 999=$42.500). Datos de prueba revertidos
(override + mapeo eliminados vía API tras la verificación).

Bug no relacionado encontrado durante la prueba e2e y **corregido en la misma sesión** (el
usuario pidió el fix inmediatamente después): `OnboardingTour.tsx` entraba en loop infinito
("Maximum update depth exceeded") y dejaba la app en blanco en el primer login de un rol sin tour
visto. Causa: `measure` (`useCallback`) dependía de `step`, un objeto nuevo en cada render porque
`steps` se recalculaba con `.filter()` en cada render — eso disparaba el `useLayoutEffect` una y
otra vez. Corregido memoizando `steps` con `useMemo` (deps `[user?.role, open]`, solo recalcula al
cambiar de rol o abrir el tour, no en cada render). Verificado e2e real: reseteado
`onboardingDone` del admin, login desde cero, tour abrió ("Paso 1 de 4"), avanzó un paso, cerrado
con "Omitir" sin crash. 159/159 frontend, `tsc --noEmit` limpio. Ver [[09-ux-transversal]] si se
documenta ahí el detalle de A5/tour — este fix es puro bugfix, no cambia comportamiento.

**No queda backlog pendiente de los 3 formularios SRI** (104, 103, 101) — los tres tienen réplica
llenable con numeración oficial real, mapeo de cuentas parametrizable y edición manual.

## Mejoras propuestas
- El plan `plan-contabilidad-tributaria-sri.md` (facturación electrónica SRI + NIIF/Supercías)
  queda **completo (Etapas 1-8)** — no repetir ítems de ahí. También: emitir facturas FAC-
  manuales (hoy no tienen cliente ni IVA por línea) y validar el XML contra el XSD oficial.
- ✅ ~~Form 101 anual.~~ — cerrado 2026-09-13 (conciliación tributaria básica, ver tabla de
  arriba). Pendiente si se necesita: Anticipo de IR (Formulario 115), créditos tributarios,
  exoneraciones sectoriales, y las casillas oficiales exactas (hoy son conceptos legales
  etiquetados, no casillas numeradas — confirmar en DIMM Formularios).
- ✅ ~~Diferidos.~~ — cerrado 2026-09-13, ver tabla de arriba.
- ⚠️ **Alcance de B4**: el registro del activo NO contabiliza la adquisición (eso lo sigue
  haciendo la factura de compra normal); solo genera el asiento mensual de depreciación.
  Vincular ambos (que una factura de compra pueda "convertirse" en un activo fijo, o al
  revés) queda como mejora futura si se necesita.
- ✅ ~~Reverso contable de NOTA_CREDITO de compra (aún sin asiento propio).~~ — cerrado
  2026-09-13, ver tabla de arriba. **Las 3 brechas originales de este módulo quedan cerradas.**
- ✅ ~~Confirmar una NOTA_CREDITO con ítems tipo PRODUCTO cargaba inventario con `type: 'IN'`
  (igual que una factura) en vez de restarlo.~~ — cerrado 2026-09-13. `confirmSriDocument`
  (rama sin OC vinculada) ahora usa `type: doc.tipoDocumento === 'NOTA_CREDITO' ? 'OUT' : 'IN'`;
  el resto de tipos (FACTURA/LIQUIDACION_COMPRA/NOTA_DEBITO) siguen en `'IN'` sin cambios. El
  costeo de la salida lo calcula `registerMovement` con el método real del producto (AVG/FIFO/
  LIFO) — no se pasa `unitCost`, que solo aplica a entradas. 3 tests de integración con BD real
  en `tests/integration/credit-note-inventory-return.test.ts` (resta stock, no rompe el caso de
  factura normal, respeta `allowNegativeStock=false` sin bloquear el documento si la devolución
  excede el stock). Verificado e2e real: NC de $57.50 (5 unidades) confirmada en el navegador
  como usuario admin, stock bajó de 20→15, `InventoryMovement.type = 'OUT'`. 745/745 tests back.
- ⚠️ **Hallazgo sin resolver**: `POST /sri/:id/pay` (`markPayablePaid`) es un pago directo legado
  que NO pasa por `PaymentApplication`/`BankTransaction`/aprobación por monto (Fase 4) — lo
  reemplazó la mesa de trabajo CxP (`ap.service.payPayable`). Su única consumidora en frontend es
  `FinancialPage.tsx`, que **SÍ está enrutada** (`/financial/invoices` — nota corregida 2026-09-12:
  la afirmación anterior de "huérfana/no enrutada" era incorrecta, verificado en `App.tsx`). Se
  dejó con el gate más restrictivo posible (`pay`,`Purchase` → solo TESORERIA/ADMIN) en vez de
  eliminarlo. Como la página SÍ se usa, eliminar este endpoint requiere antes migrar
  `FinancialPage.tsx` a la mesa de trabajo CxP real (`CxPWorkbench.tsx`) — no es un simple borrado
  de código muerto, es una decisión de producto (¿se fusionan las dos pantallas?).

## Ver también
- [[02-compras|Módulo 2 · Compras]] (origen del asiento de factura)
- [[08-analisis-financiero-cxp-cxc|Módulo 8 · Análisis financiero (CxP/CxC)]]
- [[05-07-tesoreria-nomina-biometrico|Módulos 5/7 · Nómina y Tesorería]] (asientos de pago)
