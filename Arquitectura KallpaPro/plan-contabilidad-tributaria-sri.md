# Plan — Contabilidad/Tributaria robusta: SRI en vivo + NIIF + Supercías

> Documento VIVO. Creado 2026-09-10 a pedido directo del usuario ("démosle mucho amor a la
> contabilidad, ERP potente, robustez contable/financiera/tributaria"). Decisiones ya
> confirmadas con el usuario (no volver a preguntar):
> - Integración **completa** con el SRI: firmar XML con firma electrónica (.p12) y enviarlo
>   al web service SOAP del SRI (recepción + autorización), no solo generar XML/RIDE sueltos.
> - El usuario **ya tiene** un certificado .p12 de prueba/producción para validar end-to-end.
> - Primera etapa: **base normativa** (establecimiento/punto de emisión/ambiente/certificado) —
>   sin esto no se puede firmar ni enviar nada real.
>
> Alcance de este documento: solo la parte **contable/tributaria** nueva. El resto del backlog
> Odoo (`plan-mejoras-odoo18.md`, Fases A-C completas, queda D) no se toca aquí.

## 0. Diagnóstico — qué existe y qué falta

**Ya existe (no reinventar):**
- `SriDocument` (compras): captura facturas de PROVEEDOR ya autorizadas por el SRI (manual o
  IA), con `claveAcceso`/`numeroAutorizacion`/`estab`/`ptoEmi` — es **solo lectura/registro**,
  nunca firma ni envía nada al SRI (el proveedor ya lo hizo). No confundir con lo nuevo.
- `Invoice` (ventas): factura interna del ERP, numeración propia `FAC-V-####`, **sin** ningún
  campo de comprobante electrónico SRI (no autoriza, es una factura "de papel" en la práctica).
- Form 104/103 por casillas, ATS (aproximado), activos fijos, cierres de período: `06-contabilidad.md`.
- Plan de cuentas Supercías (301 cuentas) + `AccountMapping` (posting setup).

**Falta por completo (esto es lo nuevo):**
1. Facturación electrónica de **venta** autorizada por el SRI en tiempo real (factura, nota de
   crédito, nota de débito, guía de remisión, retención — los 5 comprobantes electrónicos).
2. Firma electrónica XAdES-BES con certificado .p12 propio de cada empresa.
3. Configuración normativa por empresa: RUC, razón social, establecimientos (matriz +
   sucursales), puntos de emisión por establecimiento, secuenciales, ambiente
   (1=Pruebas/2=Producción), tipo de emisión (normal/contingencia).
4. Cliente SOAP contra `celcer.sri.gob.ec` (pruebas) / `cel.sri.gob.ec` (producción):
   `RecepcionComprobantesOffline` (valida y recibe) + `AutorizacionComprobantesOffline`
   (consulta autorización por clave de acceso).
5. RIDE (representación impresa) en PDF con el formato oficial.
6. Cierre de impuestos automático (asiento de liquidación de IVA: crédito vs débito tributario).
7. Estados financieros NIIF completos para Supercías (no solo Balance/Resultados: notas,
   estado de cambios en el patrimonio, estado de flujo de efectivo ya existe).
8. ATS en formato XML validado contra el schema real del SRI (hoy es una aproximación).

## 1. Decisiones de arquitectura

### 1.1 Dónde vive la lógica SRI (motor puro + adaptador, regla 6)
- `sri-electronic/` (nuevo, backend): 3 capas separadas por responsabilidad, cada una testeable
  sin red ni certificado real:
  - `xml-builder.engine.ts` — **puro**: arma el XML del comprobante (factura/NC/ND/guía/retención)
    desde datos del ERP ya existentes (`Invoice`, `CreditNote`, etc.) siguiendo el schema oficial
    del SRI (versión de Ficha Técnica vigente — la 2.31 offline / equivalente online). Sin
    dependencias de Prisma ni de red: recibe un objeto plano, devuelve un string XML. Tests
    unitarios comparando estructura contra ejemplos oficiales.
  - `signer.ts` — firma XAdES-BES del XML con el .p12 (librería `node-forge` o `xml-crypto` +
    `xadesjs`; evaluar en fase de implementación cuál soporta XAdES-BES sin Java). Recibe
    buffer del XML + certificado + password, devuelve XML firmado. Aislado para poder mockearlo
    en tests (no se prueba contra el SRI real en CI).
  - `sri-soap-client.ts` — adaptador SOAP contra `celcer.sri.gob.ec`/`cel.sri.gob.ec` según
    `Company.sriAmbiente`. Envía, y si `RECIBIDA`, hace polling de autorización (hasta ~24h
    según el SRI, pero normalmente segundos) — sin cron: mismo patrón perezoso que B3/B4
    (botón "Consultar autorización" + intento automático al emitir).
  - `electronic-invoice.service.ts` — orquesta: arma XML → firma → envía → guarda
    claveAcceso/estado/XML firmado/autorización en el `Invoice` → genera RIDE.
- **Nunca** se guarda la contraseña del .p12 en texto plano ni se expone por API — se cifra en
  reposo (`crypto` AES-256-GCM con una clave de app en `.env`, nunca la contraseña del usuario)
  y el campo nunca se devuelve en ningún `GET` (mismo criterio que un password hash).

### 1.2 Multi-tenant y trazabilidad (reglas 1 y 4)
- Todo objeto de configuración SRI (`CompanyFiscalConfig`, `Establishment`, `EmissionPoint`)
  lleva `companyId` — una empresa puede tener varios establecimientos/puntos de emisión pero
  nunca ve los de otra.
- El secuencial (`###########`, 9 dígitos) es **por punto de emisión**, no global ni por
  empresa — regla real del SRI. Se genera con el mismo patrón atómico que
  `getNextDocumentNumber` (nunca `count()+1`), pero con su propia tabla de contador
  (`EmissionPoint.lastSequential`) para no mezclarlo con la numeración interna `FAC-V-####`
  que el ERP ya usa para búsqueda humana — **ambas conviven**: `FAC-V-0125` (interno) lleva
  además `establecimiento-ptoEmision-secuencial` (`001-001-000000125`) para el SRI.
- `Invoice` (y luego `CreditNote`/nota de débito/guía) gana campos: `claveAcceso`,
  `numeroAutorizacion`, `fechaAutorizacion`, `sriEstado`
  (`NO_ENVIADA|ENVIADA|RECIBIDA|AUTORIZADA|DEVUELTA|RECHAZADA`), `ambiente`, `xmlFirmado`
  (guardado para reimprimir el RIDE / reenviar), `establishmentId`, `emissionPointId`.
- Trazabilidad: `claveAcceso` es la clave universal para conciliar con ATS y con la contabilidad
  (ya se usa así en `SriDocument` de compras — se reutiliza el mismo criterio para ventas).

### 1.3 Estados que bloquean (regla 5)
- Una factura `AUTORIZADA` por el SRI **nunca se edita ni se reversa con un simple update**:
  solo Nota de Crédito (ya existe el flujo) o Nota de Débito (nueva). Esto ya es la regla
  actual del ERP para facturas contabilizadas — se extiende: `AUTORIZADA` es más fuerte que
  `POSTED` (bloquea incluso lo que `POSTED` permitía a un ADMIN).
- ~~Si el SRI rechaza, la factura vuelve a DRAFT y el asiento se postea solo al autorizar.~~
  **Decisión revisada al implementar la Etapa 3 (2026-09-11):** el asiento contable NO se
  difiere — se sigue posteando al crear la FAC-V- como hasta ahora. Razones: (a) la salida de
  inventario/COGS ya ocurrió físicamente al despachar, diferirla dejaría el kardex y la
  contabilidad desalineados; (b) una `DEVUELTA`/`RECHAZADA` del SRI es casi siempre técnica
  (firma, estructura, RUC, secuencial ya usado) y se resuelve **re-emitiendo con un secuencial
  nuevo**, no anulando la venta; (c) es el mismo criterio de Odoo l10n_ec (postea el asiento y
  la autorización es un estado tributario encima). Si el negocio quiere reconocer ingreso solo
  con autorización, es una configuración futura a decidir con el usuario, no el default.
  `sriEstado` vive en `Invoice` junto a `status` (cobro), son ejes independientes.

### 1.4 Cuentas por posting setup (regla 3)
- Nueva clave `DEFAULT_MAPPINGS`: ninguna nueva en realidad — reutiliza las cuentas de venta/IVA
  débito ya mapeadas. La liquidación de IVA (cierre de impuestos) sí necesita 2 cuentas nuevas:
  `IVA_LIQUIDACION_POR_PAGAR` (pasivo) — mapeable en Ajustes, no quemada en código.

## 2. Etapas (orden de implementación)

### Etapa 1 — Base normativa (ESTA SESIÓN)
- Modelos nuevos: `CompanyFiscalConfig` (1:1 con Company: ambiente pruebas/producción,
  obligadoContabilidad, contribuyenteEspecial, regimen), `Establishment` (código 3 dígitos,
  dirección, matriz sí/no), `EmissionPoint` (código 3 dígitos por establecimiento,
  `lastSequential` por tipo de comprobante — factura/NC/ND/guía/retención llevan secuenciales
  INDEPENDIENTES según norma SRI).
- Certificado digital: `DigitalCertificate` (companyId, archivo .p12 cifrado en disco/BD como
  bytea, passwordEncrypted con AES-256-GCM, fecha de vigencia, alias, activo/inactivo). Subida
  vía formulario en Ajustes → Facturación Electrónica (nunca se pide ni se muestra la
  contraseña de vuelta).
- UI: pestaña nueva "Facturación Electrónica" en Ajustes → Empresa: ambiente
  (Pruebas/Producción con badge de color, cambiarlo pide confirmación explícita porque afecta
  documentos reales), establecimientos/puntos de emisión (CRUD simple), certificado (subir,
  ver vigencia, activar/desactivar — nunca ver la contraseña).
- Sin lógica SRI todavía (ni XML ni SOAP) — es la cimentación. Tests: generación atómica del
  secuencial por punto de emisión + tipo de comprobante (igual patrón que
  `getNextDocumentNumber`, con tests de concurrencia).

### Etapa 2 — Motor de XML + firma (sin enviar aún)
- `xml-builder.engine.ts` para FACTURA (el resto de comprobantes en etapas posteriores).
- `signer.ts` con XAdES-BES contra el certificado subido en Etapa 1.
- Validación: comparar el XML firmado contra el schema XSD oficial (offline, sin red) —
  primer punto de control de calidad antes de gastar un envío real al SRI.
- Sin UI visible aún más que un botón de prueba en modo Pruebas ("Generar XML de prueba").

### Etapa 3 — Envío y autorización real (ambiente de Pruebas)
- `sri-soap-client.ts` contra `celcer.sri.gob.ec`. Flujo completo: emitir factura → arma XML →
  firma → envía → `RECIBIDA` → consulta autorización → `AUTORIZADA`/`DEVUELTA`/`RECHAZADA`.
- Solo entonces se postea el asiento contable (cambio de regla de negocio, ver §1.3).
- RIDE en PDF (reusa el generador de PDF de Sprint 5, con el layout oficial: clave de acceso
  en código de barras/QR, leyenda "ORIGINAL"/impresión).
- Validado e2e por el usuario contra el ambiente de Pruebas del SRI con su certificado real.

### Etapa 4 — Notas de crédito/débito y guía de remisión electrónicas
- ✅ **Nota de crédito electrónica — HECHA (2026-09-11)**: reusa el mismo motor
  (clave de acceso + firma + soap-client), builder propio `nota-credito-xml.engine.ts`.
  Requiere que la factura sustento esté `AUTORIZADA`. RIDE en PDF (factura y NC) con clave de
  acceso + código de barras Code128 (`bwip-js`) agregado de paso — no estaba en el alcance
  original de esta etapa pero es el complemento natural de tener comprobantes autorizados.
- ✅ **Nota de débito electrónica — HECHA (2026-09-11)**: modelo nuevo `DebitNote`/`DebitNoteConcept`
  (no existía nada de ND). Reusa el mismo motor de firma/envío (clave de acceso + XAdES-BES +
  SOAP) con builder propio `nota-debito-xml.engine.ts`. Requiere que la factura sustento esté
  `AUTORIZADA`, igual que la NC.
- ✅ **Guía de remisión electrónica — HECHA (2026-09-11)**: modelo nuevo `DeliveryGuide`/
  `DeliveryGuideItem`, ligado a un `Shipment` de venta ya existente. Sin valores monetarios
  (solo cantidades) — no exige factura sustento AUTORIZADA (el traslado es válido con o sin
  ella; si existe una factura AUTORIZADA para el envío, se referencia como `docSustento`
  opcional). Builder propio `guia-remision-xml.engine.ts` (`<guiaRemision version="1.0.0">`,
  sin `<detalles>` monetarios, con datos de transportista/trayecto). **Etapa 4 completa.**

### Etapa 5 — Producción + contingencia
- ✅ **HECHA (2026-09-11)**. Checklist antes de pasar a Producción (`setAmbiente`):
  certificado activo + establecimiento activo (ya existían) + **al menos un comprobante
  AUTORIZADO por el SRI en Pruebas** (nuevo — evita que el primer comprobante real sea también
  el primero probado de punta a punta). Endpoint `getProductionChecklist` alimenta la UI con
  el detalle ítem por ítem.
- Tipo de emisión NORMAL/CONTINGENCIA expuesto por primera vez (`setTipoEmision`, ya existía
  el campo en el schema desde la Etapa 1 pero sin UI ni endpoint) — toggle con confirmación en
  Facturación Electrónica.
- Cola de reintentos (`sri-retry.service.ts`): mismo patrón perezoso que B3/B4 (sin cron, botón
  manual "🔁 Reintentar pendientes") — encuentra TODO comprobante (factura/NC/ND/guía) en
  `ENVIADA`/`RECIBIDA` de la empresa y vuelve a consultar su autorización sin re-enviar nada
  (el XML firmado ya está persistido desde que se envió — regla de trazabilidad).

### Etapa 6 — Cierre de impuestos automático (asiento de liquidación de IVA)
- ✅ **HECHA (2026-09-11)**. Botón "🔒 Cerrar impuestos" en Contabilidad → Declaraciones → Form
  104: reusa el cálculo YA existente de `sri-casillas.service.getForm104Casillas` (no duplica
  la aritmética del IVA) y, si el resultado es A_PAGAR, postea el asiento de liquidación
  (`createTaxClosingEntry`: DR IVA débito / CR IVA crédito + retenciones de IVA recibidas (si
  las hay) + `IVA_LIQUIDACION_POR_PAGAR` — nuevo mapping, pasivo) y bloquea el mes vía el mismo
  `FiscalPeriod` del cierre contable general (Sprint 6), no un candado paralelo. Si el
  resultado es CREDITO (nada que pagar), no postea asiento — el crédito tributario ya vive en
  el saldo de la cuenta `IVA_CREDIT` y se compensa solo en períodos futuros — pero igual
  bloquea el período. Bloquea el cierre si hay documentos SRI o facturas en borrador
  pendientes en el período (evita declarar con datos incompletos).

### Etapa 7 — ATS real (reemplaza la aproximación actual)
- ✅ **HECHA (2026-09-12)**. No hizo falta guardar el desglose (ni migración): las líneas con
  tarifa de IVA real ya existen en `SalesOrderItem`/`ShipmentItem` desde antes de la Etapa 3, y
  `electronic-invoice.service.loadInvoiceForSri` ya las reconstruye para armar el XML (mapeo
  envío→pedido, cantidades exactas si nació de un despacho parcial). Se exportó esa función y se
  reusó en `ats.service.ts`: si la factura tiene `salesOrderId`, el desglose es EXACTO vía
  `computeVentaBreakdownFromLines` (motor puro nuevo en `ats.engine.ts`, mismo cálculo neto =
  cantidad×precio−descuento que `factura-xml.engine.computeItem`); si no (factura manual `FAC-`
  sin pedido), sigue cayendo a la aproximación `total/(1+tasa)` — ahora un caso residual, no la
  regla general. Corrige en particular las facturas con tarifas mixtas (0% y gravado en el mismo
  comprobante), que la aproximación uniforme mezclaba mal.

### Etapa 8 — NIIF/Supercías: estados financieros completos
- ✅ **HECHA (2026-09-12)**. Estado de Cambios en el Patrimonio (NIC 1): motor puro
  `equity-statement.engine.ts` clasifica cuentas Supercías (301/304/306-307) y arma saldo
  inicial/aumentos/disminuciones/saldo final por categoría reusando `getTrialBalance2`; pliega
  la utilidad de ejercicios anteriores no cerrada al mayor (mismo cálculo en vivo que
  `getBalanceSheet.utilidadEjercicio`) para que el total cuadre exactamente con el Balance
  General de la misma fecha — verificado con un invariante de integración (BD real: aporte de
  capital + dividendo + utilidad de dos meses distintos, `equity.totalFinal ===
  balance.totalPatrimonio`). Notas a los estados financieros: modelo `FinancialStatementNote`
  (texto libre por período, CRUD simple — KallpaPro no genera el contenido, es juicio del
  contador). Paquete de exportación: se descartó apuntar a un formato XBRL/plantilla Supercías
  específico sin verificar su schema exacto (cambia por resolución, sin API pública) — en su
  lugar, un PDF único (Balance + Resultados + Cambios en Patrimonio + Flujo de Efectivo + Notas)
  para que el contador arme la presentación real a mano, mismo límite ya aceptado en §3.

## 3. Qué NO se automatiza (límites deliberados)
- KallpaPro **no sustituye** la presentación de declaraciones en el portal del SRI (104/103/ATS
  se generan listos para subir, igual que hoy) — el SRI no ofrece un API público de
  presentación de declaraciones para terceros, solo de comprobantes electrónicos.
- El certificado .p12 y su contraseña son responsabilidad exclusiva del usuario/empresa —
  KallpaPro los cifra en reposo pero nunca los expone, transmite a terceros, ni los usa fuera
  del flujo de firma explícito que el usuario dispara.
- Presentación en el portal de Supercías: se genera el archivo/paquete, la carga al portal la
  hace el usuario (no hay API pública oficial confirmada para automatizar la carga en 2026).

## 4. Registro de avance
| Fecha | Ítem | Estado |
|---|---|---|
| 2026-09-12 | **Etapa 8 — NIIF/Supercías: Estado de Cambios en el Patrimonio, Notas y paquete de exportación (cierra el plan completo).** `equity-statement.engine.ts` (motor puro): `classifyEquityAccount` mapea código Supercías → CAPITAL(301)/RESERVAS(304)/RESULTADOS_ACUMULADOS(306,307)/OTROS_PATRIMONIO; `buildEquityCategories` agrupa movimientos (el patrimonio es de naturaleza acreedora: el HABER aumenta, el DEBE disminuye); `buildEquityStatement` arma el documento final. `accounting.service.getEquityStatement(companyId,{from,to})` alimenta esto con `getTrialBalance2` (saldo inicial/movimientos reales del período) + `getIncomeStatement` dos veces (utilidad del período mostrado, y utilidad acumulada de TODOS los ejercicios anteriores a `from` — esta última no está posteada a 306/307 en el mayor porque KallpaPro no cierra el P&L a patrimonio automáticamente, así que se pliega al saldo inicial de RESULTADOS_ACUMULADOS "en vivo", exactamente como ya hace `getBalanceSheet.utilidadEjercicio`). Invariante clave verificado con BD real: `getEquityStatement(...).totalFinal === getBalanceSheet(...,to).totalPatrimonio` sobre un escenario con aporte de capital en enero, utilidad en enero (no cerrada), aporte adicional + dividendo + utilidad en febrero — cuadra exacto. Notas a los Estados Financieros (NIC 1 §112-116): modelo nuevo `FinancialStatementNote` (companyId+period+order+title+content, migración `financial_statement_notes` APLICADA — la BD volvió a aparecer vacía al generarla, mismo patrón recurrente ya documentado: se resolvió con `prisma migrate resolve --applied` para las 31 migraciones previas antes de aplicar la nueva) + `financial-notes.service.ts` (CRUD simple, sin generar contenido — eso es juicio del contador). Paquete de exportación: se decidió NO fabricar un XBRL/plantilla Supercías específico sin verificar su schema real (cambia por resolución, sin API pública confirmada para la carga — mismo límite ya aceptado en §3); en su lugar `exportSuperciasPackagePdf` en `reports.service.ts` arma un PDF único con las 4 secciones (Balance, Resultados, Cambios en Patrimonio, Flujo de Efectivo) + Notas, reusando `addPDFHeader`/pdfkit del resto de reportes — es el paquete que el contador imprime/adjunta para presentar a mano, no una integración con el portal. Rutas nuevas bajo `/financial/equity-statement`, `/financial/financial-notes` (gate `update`,`Accounting` para escribir — mismos roles que catálogos IVA/retenciones: ADMIN/CONTADOR/TRIBUTARIO) y `/financial/financial-statements/package.pdf`. Pestaña nueva "Patrimonio y NIIF" en `ContabilidadPage.tsx` con `PeriodPicker` + `<EquityStatement/>` + `<FinancialNotes/>` + botón de descarga. 8 tests unitarios nuevos (motor) + 9 de integración con BD real (equity-statement + financial-notes + financial-statements-package), tsc limpio en ambos proyectos. Verificado e2e real en el navegador: aporte de capital + dividendo + utilidad cargados como asientos manuales reales, la tabla de Cambios en el Patrimonio mostró exactamente los montos esperados (Capital $5000→$6000, Resultados Acumulados $0→-$200, Total Patrimonio $5300→$6250), nota "Políticas contables" creada y persistida, y el PDF del paquete descargado con 200 OK. Datos de demostración transaccionales eliminados después. **Con esta etapa, el plan completo (Etapas 1-8) queda cerrado** | ✅ |
| 2026-09-12 | **Etapa 7 — ATS real (desglose exacto de ventas por línea).** `loadInvoiceForSri` (Etapa 3, `electronic-invoice.service.ts`) se exportó y se reusa en `ats.service.ts`: si la factura de venta tiene `salesOrderId`, sus líneas reales (con tarifa de IVA propia, cantidades exactas si nació de un despacho parcial vía `ShipmentItem`) alimentan `computeVentaBreakdownFromLines` (motor puro nuevo en `ats.engine.ts`, mismo cálculo neto=cantidad×precio−descuento que ya usa `factura-xml.engine.computeItem` para el XML) — desglose EXACTO de `baseImpGrav0`/`baseImponible`/`montoIva`, sin aproximar. Las facturas manuales sin pedido (`FAC-` directas) siguen cayendo a `approximateNetFromTotal` (ahora documentado como fallback, no la regla general). Sin cambio de schema: el desglose se recalcula desde datos ya persistidos, no se guardó un campo nuevo. 4 tests unitarios nuevos (`computeVentaBreakdownFromLines`: tarifa 0%, descuento por línea, tarifas mixtas, caso vacío) + 1 test de integración nuevo con BD real (factura con 1 línea gravada + 1 línea tarifa 0% en el mismo pedido → ATS reparte cada base en su casilla correcta, algo que la aproximación uniforme anterior mezclaba). Test de integración existente ajustado (antes esperaba `toBeCloseTo` sobre la aproximación, ahora `toBe` exacto sobre el desglose real) | ✅ |
| 2026-09-11 | **Etapa 6 — Cierre de impuestos automático.** `tax-closing.service.ts` reusa `getForm104Casillas` (misma aritmética que ya ve el usuario en Declaraciones, cero duplicación) — solo decide si postear el asiento y bloquear el período. `createTaxClosingEntry` en `journal.service.ts`: DR `IVA_DEBIT` (casilla 429, impuesto generado) / CR `IVA_CREDIT` (520, crédito de compras) + CR `RETENTION_ASSET` (609, si hay retenciones de IVA recibidas) + CR `IVA_LIQUIDACION_POR_PAGAR` (902, nuevo mapping — pasivo, reusa la cuenta 2010701 "con la administración tributaria" por defecto, remapeable). Invariante verificado: en el caso A_PAGAR (el único que postea asiento) el DR y el CR cuadran exactamente por construcción de `buildForm104Casillas` (sin necesidad de un ajuste de redondeo). Si el resultado es CREDITO (nada que pagar), no se postea nada — el crédito tributario ya vive en el saldo natural de `IVA_CREDIT` — pero el período igual se bloquea. Bloquea el cierre si hay `SriDocument` PENDING_REVIEW o facturas DRAFT en el período (mismos `pendientes` que ya calcula Declaraciones). Reusa `closePeriod` de Sprint 6 (mismo `FiscalPeriod`, no un candado tributario paralelo) — se postea el asiento ANTES de cerrar el período porque `assertPeriodOpen` bloquearía el asiento si se cerrara primero. Rutas nuevas bajo `/financial/sri/tax-closing/:period` (preview) y `/tax-closing/:period/close` (gate `configure`,`Accounting`, mismo que cerrar período contable). UI: botón "🔒 Cerrar impuestos" bajo el resultado del Form 104 en la pestaña Declaraciones, con estado "ya cerrado"/"resuelve pendientes primero" según corresponda. 3 tests de integración con BD real (A_PAGAR postea y cuadra, CREDITO no postea, documentos pendientes bloquean). Verificado e2e real en el navegador: venta de $230 (IVA $30) sin compras → Form 104 mostró "$30.00 a pagar" → botón "Cerrar impuestos" → asiento AST-0001 "Cierre de impuestos · IVA 2026-09" contabilizado por $30.00, período bloqueado, banner cambia a "✓ Impuestos ya cerrados (AST-0001)" | ✅ |
| 2026-09-11 | **Etapa 5 — Producción + contingencia.** `fiscal-config.service.setAmbiente` gana un tercer requisito antes de permitir pasar a Producción (los dos anteriores —certificado y establecimiento activos— ya existían desde la Etapa 1): al menos un comprobante (factura/NC/ND/guía) `AUTORIZADA` con `sriAmbiente='PRUEBAS'` en la empresa — decisión deliberada para que nadie pase a Producción sin haber probado el circuito completo de punta a punta contra el SRI real al menos una vez. Nuevo `getProductionChecklist` (sin efectos secundarios) alimenta una lista visual en el frontend (✓/○ por ítem) en vez de solo fallar con un mensaje al intentar el cambio. `setTipoEmision` expone por primera vez el campo `tipoEmision` (NORMAL\|CONTINGENCIA) que ya existía en el schema desde la Etapa 1 sin UI ni endpoint — toggle con confirmación explícita en Facturación Electrónica (afecta el dígito de tipo de emisión de la clave de acceso de todo comprobante nuevo). Cola de reintentos nueva `sri-retry.service.ts`: mismo patrón perezoso sin cron que B3/B4 — `listPendingSriDocuments`/`retryPendingSriDocuments` recorren factura+NC+ND+guía buscando `sriEstado` en `ENVIADA`/`RECIBIDA` y vuelven a consultar la autorización (nunca re-envían, el XML firmado ya está persistido desde el envío original — regla 4). Un fallo individual no aborta el lote (cada documento se reintenta independientemente, con su propio try/catch). Banner amber en Facturación Electrónica ("⏳ N comprobante(s) pendiente(s)") con botón "🔁 Reintentar pendientes", visible solo si hay algo pendiente. 2 archivos de test de integración (fiscal-config.test.ts ampliado con el checklist + tipoEmision, sri-retry.test.ts nuevo con 2 casos incluyendo resiliencia ante error individual). Se corrigieron 2 tests preexistentes (`sri-preview.test.ts`, `fiscal-config.test.ts`) que asumían poder pasar a Producción sin ningún comprobante autorizado — ahora crean uno de prueba antes. Verificado e2e real en el navegador: checklist mostró correctamente ✓/○ por ítem, toggle de contingencia cambió a "⚠️ CONTINGENCIA" y de vuelta a "NORMAL" con confirmación en ambos sentidos | ✅ |
| 2026-09-11 | **Etapa 4 — Guía de remisión electrónica (cierra la Etapa 4 completa).** Modelo nuevo `DeliveryGuide`/`DeliveryGuideItem` (no existía nada — `Shipment` no es un comprobante SRI), ligado a un `Shipment` de venta ya existente vía `shipmentId`. A diferencia de factura/NC/ND: **sin valores monetarios** (solo `<detalles><detalle><cantidad>`, sin precio/impuesto) y **sin exigir sustento AUTORIZADA** (el traslado de mercadería es válido con o sin factura asociada — muestras, traslados entre bodegas, consignación; si SÍ existe una factura AUTORIZADA para el mismo envío, `electronic-deliveryguide.service.loadDeliveryGuideForSri` la detecta sola vía `Invoice.shipmentId` y arma el bloque `docSustento` opcional con `codDocSustento`/`numDocSustento`/`numAutDocSustento`). Motores puros `guia-remision-xml.engine.ts` (`<guiaRemision version="1.0.0">`, bloque `infoGuiaRemision` con transportista/placa/fechas de transporte, `destinatarios` con un único destinatario — 1 envío = 1 destino, caso común) y `shipment-to-guia.engine.ts` (mapeo, reusa `resolveComprador` de `invoice-to-factura.engine.ts` con total=0 para nunca bloquear por el tope de consumidor final, que no aplica a un documento sin montos). Servicio `electronic-deliveryguide.service.ts`: mismo patrón que ND/NC (persistir antes de enviar, recepción→autorización con reintentos, re-emitir con secuencial nuevo, AUTORIZADA inmutable), duplicado deliberadamente. `delivery-guide.service.ts` (creación no-electrónica: motivo, transportista, fechas — los ítems se copian de `ShipmentItem` del envío). Sin asiento contable (correcto: es un documento de evidencia de transporte, no un hecho económico). Rutas bajo `logistics.routes.ts` (no `financial.routes.ts`, porque cuelga de `/shipments/:id/delivery-guides` — el acto de crearlo usa el gate `update`,`Logistics`; emitirlo al SRI usa `post`,`Journal` igual que los demás comprobantes). RIDE en PDF con tabla de cantidades (sin precio) + bloque de transporte. `<SriEmissionPanel/>` ganó `kind: 'deliveryGuide'` (4º y último kind de esta etapa). Frontend: botón "📋 Guía de Remisión" + modal + tabla en `ShipmentDetailPage.tsx` (import directo de `components/financial/SriEmissionPanel` — el proyecto no tiene carpeta compartida entre módulos, es el patrón ya usado por `ShipmentCard` en `sales`/`purchases`). 14 tests nuevos (6 XML + 4 mapeo + 4 integración con BD real y SRI mockeado, cubriendo el caso CON y SIN factura sustento). Verificado e2e real en el navegador: GR-0001 creada desde el modal sobre un envío real, panel SRI mostró "No enviada al SRI" con selector de punto de emisión, PDF descargado con 200 OK. **Con esta etapa, la Etapa 4 completa del plan queda cerrada** (factura ya estaba, NC/ND/guía cerradas en esta y la sesión anterior) | ✅ |
| 2026-09-11 | **Etapa 4 — Nota de débito electrónica (resto).** Modelo nuevo `DebitNote` (número `ND-####`, `reason`, `taxRate` única para toda la ND, `subtotal`/`taxAmount`/`total`, los mismos 12 campos SRI que `Invoice`/`CreditNote`) + `DebitNoteConcept` (solo `description`+`amount` — sin cantidad/producto/bodega, porque la ND es un cargo adicional, no una devolución de mercadería: interés por mora, gasto no facturado). `SriTransmission.debitNoteId` nuevo (tercer FK opcional junto a `invoiceId`/`creditNoteId`, exactamente uno seteado, validado en servicio). Migración `sri_debit_note` generada con `migrate diff`+`migrate deploy` (el `.dll.node` no dio EPERM esta vez porque el backend ya estaba detenido de antemano) — al aplicar se encontró que la tabla `_prisma_migrations` estaba vacía a pesar de que el schema ya tenía las 29 migraciones previas (el contenedor `kallpapro-db` se había reiniciado sin volumen persistente en algún punto entre sesiones); se resolvió con `prisma migrate resolve --applied` para las 29 migraciones existentes antes de aplicar la nueva — **la base de datos completa estaba vacía al empezar esta sesión** (0 companies/usuarios), efecto de ese mismo reinicio, no de este trabajo. Motores puros nuevos: `nota-debito-xml.engine.ts` (arma `<notaDebito version="1.0.0">` — sin bloque `<detalles>`, con `<motivos>` en su lugar, IVA calculado una sola vez sobre el total de motivos con una tarifa única, no permite tarifa por motivo porque la Ficha Técnica del SRI no lo soporta) y `debitnote-to-nd.engine.ts` (mapeo, reusa `resolveComprador`/`taxRateToIvaCodigo` de `invoice-to-factura.engine.ts`, igual que la NC). Servicio `electronic-debitnote.service.ts`: mismo patrón exacto que `electronic-creditnote.service.ts` (duplicado deliberado, no una abstracción sobre tres entidades con relaciones distintas), mismo requisito de sustento `AUTORIZADA`. Nuevo `debit-note.service.ts` (creación no-electrónica del documento: motivo, tarifa de IVA, conceptos) + asiento propio `createDebitNoteEntry` en `journal.service.ts` (DR CxC / CR `DEBIT_NOTE_INCOME` — mapping nuevo reusando la cuenta "OTRAS RENTAS" 4305, igual criterio que `INV_ADJUST_GAIN` / CR IVA débito si aplica). `CHATTER_ENTITY_TYPES` ganó `DEBIT_NOTE`. RIDE en PDF con tabla de motivos (`renderMotivosTable`, sin cantidad/precio unitario, a diferencia de `renderItemsTable`). `<SriEmissionPanel/>` ganó `kind: 'debitNote'` (ahora 3 kinds); botón "➕ Nota de Débito" + tabla + fila expandible en `InvoiceDetailPage.tsx`, smart button "Notas de débito" simétrico al de NC, y fila `NOTA_DEBITO` en `getCustomerStatement` (estado de cuenta CxC) — trazabilidad completa del cargo en el saldo del cliente. 546/546 back (+4: 6 nota-debito-xml + 4 debitnote-to-nd + 4 integración con BD real y SRI mockeado, más 1 test existente de chatter actualizado por el 7º tipo) + 117/117 front, tsc limpio en ambos. **Verificado e2e real en navegador**: dado que la BD estaba vacía, se recreó la cuenta demo documentada (`admin@gmail.com`/`12345678` vía `/api/auth/register`, mismo login de siempre) y una factura de venta de prueba; se creó una ND real desde el modal del detalle de factura ($20 + 15% IVA = $23.00), verificado el asiento AST-0001 cuadrado (DR CxC $23 = CR Otras Rentas $20 + CR IVA débito $3), el PDF (RIDE) descargado con 200 OK, y el panel SRI mostrando "No enviada al SRI" correctamente (no se emitió al SRI real para no gastar un secuencial de producción sin necesidad — ese circuito ya está cubierto por la suite de integración mockeada). Datos de demostración transaccionales eliminados después; la cuenta admin se dejó activa porque es la credencial documentada del proyecto | ✅ |
| 2026-09-11 | **Etapa 4 — Nota de crédito electrónica + RIDE en PDF.** Schema: `CreditNote` gana los mismos 12 campos SRI que `Invoice` (mismo significado, ver Etapa 3); `SriTransmission.invoiceId` se hizo nullable + `creditNoteId` nuevo (exactamente uno seteado, validado en servicio no en BD — deliberado para no acoplar el schema a la lista de tipos de comprobante que seguirá creciendo con ND/guía). Migración `sri_credit_note` APLICADA (mismo truco `migrate diff` + `migrate deploy`; además esta vez sí se topó con el EPERM real del `.dll.node` — se resolvió deteniendo el preview del backend antes de `prisma generate`, como documenta CLAUDE.md). Motores puros nuevos: `nota-credito-xml.engine.ts` (arma `<notaCredito version="1.1.0">`, con el bloque `docModificado` que es el "documento sustento" que el PDF de NC ya imprimía desde Sprint 4 — ahora es dato tributario real) y `creditnote-to-nc.engine.ts` (mapeo, reusa `resolveComprador`/`taxRateToIvaCodigo` de `invoice-to-factura.engine.ts`). Servicio `electronic-creditnote.service.ts`: mismo patrón exacto que `electronic-invoice.service.ts` (duplicado deliberadamente, no una abstracción genérica sobre dos entidades con relaciones distintas — ver comentario en el archivo), con el requisito propio de la NC: la factura sustento debe estar `AUTORIZADA` antes de poder emitir (si no, error claro). `CHATTER_ENTITY_TYPES` ganó `CREDIT_NOTE` (antes hubiera necesitado un `as any`). **RIDE en PDF**: se instaló `bwip-js` (MIT, Code128 puro JS) para el código de barras de la clave de acceso — mismo criterio que adoptar `ec-sri-invoice-signer` en la Etapa 2, no reinventar la generación de barcodes; `addSriRideBlock()` en `reports.service.ts` se agrega SOLO si el comprobante tiene `claveAcceso` (uno no emitido electrónicamente sigue viendo su PDF interno de siempre, sin inventar una autorización que no existe), reusado por factura y NC. `<SriEmissionPanel/>` generalizado con prop `kind: 'invoice'|'creditNote'` (antes solo servía facturas) y montado como fila expandible en la tabla de NC de `InvoiceDetailPage`. 542/542 back (+22: 6 nota-credito-xml + 3 creditnote-to-nc + 6 integración con BD real y SRI mockeado, más 7 tests existentes actualizados por el nuevo tipo de Chatter) + 117/117 front, tsc limpio en ambos. Verificado e2e real en navegador: se creó una factura+NC de demostración con estado AUTORIZADA simulado directamente en BD (sin gastar una llamada real al SRI, ya reservada para la Etapa 3), el RIDE de ambos comprobantes se descargó como PDF válido con clave de acceso + código de barras visibles, y la fila expandible de la NC mostró correctamente "No enviada al SRI" + selector de punto de emisión + botón "Emitir al SRI" (no se hizo clic para no volver a golpear el SRI real sin necesidad — el circuito completo de envío/autorización ya se validó a fondo con la suite automatizada, que sí ejercita `sendRecepcion`/`sendAutorizacion` mockeados con las mismas condiciones). Datos de demostración eliminados después | ✅ |
| 2026-09-10 | Documento creado, investigación inicial (WSDL SRI pruebas/producción, Ficha Técnica v2.3x, clasificación PYME Supercías) | ✅ |
| 2026-09-11 | **Etapa 3 — Envío y autorización real contra el SRI.** Namespaces y elementos verificados contra el WSDL público real (`curl` a celcer.sri.gob.ec: `validarComprobante/xml` base64 y `autorizacionComprobante/claveAccesoComprobante`, hijos sin prefijo). Modelo: 12 campos SRI nuevos en `Invoice` (`sriEstado` NO_ENVIADA→ENVIADA→RECIBIDA→AUTORIZADA / DEVUELTA / RECHAZADA, clave, secuencial, autorización, XML firmado y autorizado, mensajes, FK a establecimiento/punto) + modelo `SriTransmission` (bitácora inmutable de cada ida y vuelta con el raw XML — regla 4); migración `sri_invoice_transmissions` APLICADA (generada con `migrate diff` + `migrate deploy` porque `migrate dev` exige TTY en este entorno). Motores puros: `sri-soap.engine.ts` (sobres + parser tolerante a prefijos ns2/soap, `parseTagValue:false` para no perder dígitos de la clave, SOAP Fault → error legible, código 43 "clave ya registrada" expuesto) e `invoice-to-factura.engine.ts` (cliente RUC/cédula/pasaporte inferido o declarado, CONSUMIDOR FINAL solo hasta $50, IVA por línea desde `SalesOrderItem.taxRate` traducido al catálogo — tarifa desconocida bloquea). Transporte `sri-soap-client.ts` (axios, 30 s, deja pasar el 500 con Fault). Servicio `electronic-invoice.service.ts`: persiste clave+XML firmado ANTES de enviar (si la red cae después de que el SRI lo recibió, no se pierde nada), recepción → autorización con 3 reintentos/2 s, DEVUELTA/RECHAZADA re-emitibles con secuencial nuevo, AUTORIZADA inmutable (regla 5), cada cambio de `sriEstado` al Chatter vía `logFieldChange`. Solo facturas nacidas de un pedido (tienen cliente e IVA por línea); las FAC- manuales no se emiten. Rutas `/financial/invoices/:id/sri[/emit|/check-authorization|/xml]` bajo `authorize('post','Journal')`. UI: `<SriEmissionPanel/>` en el detalle de factura (estado, clave, autorización, mensajes del SRI, selector de punto de emisión, emitir/re-emitir/consultar/XML, bitácora), con doble confirmación distinta para Producción. 496/496 back (+28: 12 sri-soap + 10 invoice-to-factura + 6 integración con BD real y SRI mockeado) + 117/117 front, tsc limpio. **Verificado e2e contra el SRI REAL (celcer) desde el navegador**: factura de prueba emitida con el certificado autofirmado → el SRI respondió `DEVUELTA · [35] ARCHIVO NO CUMPLE ESTRUCTURA XML · "No existe un contribuyente registrado con el RUC 1790012345001"` — exactamente lo esperado con RUC y certificado ficticios; el sobre, la firma, el parseo, la persistencia (XML firmado, `SriTransmission` con raw, Chatter NO_ENVIADA→ENVIADA→DEVUELTA) y la UI funcionaron de punta a punta. Datos de prueba borrados y certificado demo desactivado. Decisión revisada (§1.3): el asiento NO se difiere hasta la autorización. Pendiente para autorizar de verdad: RUC real + certificado real del usuario en Ajustes | ✅ |
| 2026-09-11 | **Etapa 2 — Motor de XML + firma (sin enviar)**: en vez de reimplementar XAdES-BES a mano (criptografía de un comprobante tributario real: un error propio y no probado contra el SRI sale carísimo), se adoptó la librería MIT `ec-sri-invoice-signer` (pura TS/JS, sin Java) solo para la FIRMA; el armado del XML del comprobante lo escribe KallpaPro (`factura-xml.engine.ts`, motor puro que replica el schema oficial `<factura version="1.1.0">`: infoTributaria/infoFactura/detalles, agrupa IVA por tarifa, escapa XML). Nuevo `clave-acceso.engine.ts` (49 dígitos, dígito verificador módulo 11 — mismo algoritmo que cédula/RUC — con tests que verifican el cálculo a mano, no solo redondos). `xml-signer.engine.ts` envuelve la librería y traduce sus errores (incluida la excepción cruda de node-forge "PKCS#12 MAC could not be verified" cuando la contraseña es incorrecta, que la librería no tipa) a mensajes en español. Nuevo servicio `sri-preview.service.ts` + botón "🔏 Probar firma" por punto de emisión en la UI: arma y firma un comprobante de EJEMPLO fijo (no un `Invoice` real — esa integración es Etapa 3) usando el certificado y los datos fiscales reales ya cargados en Etapa 1, deliberadamente bloqueado fuera del ambiente PRUEBAS para nunca consumir un secuencial real de Producción. 468/468 back (+30: 12 clave-acceso + 11 factura-xml + 4 xml-signer + 3 integración sri-preview) + 117/117 front, tsc limpio en ambos. Verificado e2e en navegador real: certificado autofirmado de prueba cargado vía API (el `<input type="file">` sigue sin poder probarse por la herramienta de automatización, pero el endpoint real se ejerció con curl+JWT real, no un mock), botón "Probar firma" devolvió un comprobante firmado real con clave de acceso de 49 dígitos y estructura XAdES-BES (`<ds:Signature>`) correcta — certificado de prueba desactivado después, sin dejar configuración falsa activa. Limitación conocida: no se validó el XML contra el XSD oficial del SRI (no se descargó el schema en esta sesión) — la superficie cubierta son los propios tests de estructura/cálculo | ✅ |
| 2026-09-10 | **Etapa 1 — Base normativa**: `CompanyFiscalConfig`/`Establishment`/`EmissionPoint`/`DigitalCertificate` (migración `fiscal_config_base` APLICADA). Motores puros `cert-crypto.engine.ts` (AES-256-GCM) y `p12-inspector.engine.ts` (node-forge: valida contraseña + extrae vigencia, falla rápido al subir en vez de al firmar). Endpoints `/financial/fiscal-config/*` bajo `authorize('configure','Accounting')` (mismo gate que seed-accounts/account-mappings). UI `FiscalConfigPanel.tsx` en Contabilidad → Facturación Electrónica: datos fiscales, cambio de ambiente con doble confirmación (bloqueado sin certificado+establecimiento activos), establecimientos/puntos de emisión, carga de certificado. 438/438 back (+15) + 117/117 front, tsc limpio en ambos. Bug real corregido: regex de RUC exigía 16 dígitos en vez de 13 (`\d{13}001` → `\d{10}001`), encontrado probando en el navegador real (no en tests unitarios). Verificado e2e en navegador real: guardó datos fiscales, creó establecimiento "001 Matriz" y punto de emisión "001" sobre la empresa admin de desarrollo (datos de RUC/razón social son de PRUEBA, reemplazar por los reales). Carga de certificado `.p12` validada por integración con BD real (contraseña incorrecta rechazada sin guardar nada; .p12 válido cifrado y recuperable solo por `getActiveCertificateForSigning`) — el `<input type="file">` no se pudo ejercitar en el navegador real por limitación de la herramienta de automatización de este entorno (no soporta adjuntar archivos), no del código | ✅ |
