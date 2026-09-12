# 20 — Revisión de Odoo: Facturas y Notas de Crédito (guía de referencia)

> **Fecha:** 2026-07-04
> **Objetivo:** revisar el flujo de ingreso de facturas y notas de crédito en un Odoo real
> (`nextgen-ec-lacuspide.odoo.com`, sesión del usuario, **solo lectura, ningún comprobante creado
> ni modificado**) para usarlo como guía y mejorar KallpaPro donde aplique.
>
> **✅ ESTADO: Ejecutadas 2 mejoras priorizadas por el usuario** — documento sustento en NC de
> **ventas** (§3) y el mismo concepto en NC/ND de **compras** (§3.1, más valioso: el dato viene
> directo del XML oficial del SRI, no se infiere). El resto de hallazgos queda como backlog.
>
> **Contexto importante (recordatorio del usuario):** KallpaPro tiene DOS flujos de facturación
> paralelos y hasta ahora asimétricos — `Invoice`/`CreditNote` para lo que la empresa **emite**
> (ventas) y `SriDocument` para lo que **recibe** de proveedores (compras, parseado de PDF/XML).
> El de compras ya era más rico en campos SRI (clave de acceso, ambiente, contribuyente especial)
> antes de esta sesión; el de ventas se puso al día parcialmente (§3).

---

## 1. Qué se revisó en Odoo (sin tocar nada)

- Listado de **Facturas de cliente** (1043 registros): columnas con desglose de bases imponibles
  SRI (gravada/no gravada/exenta), estado de autorización SRI separado del estado de pago.
- Detalle de una factura autorizada y pagada: botones de ciclo de vida (`Añadir Nota de Crédito`,
  `Agregar Nota Débito`, `Restablecer a Borrador`, `Anular Documento`, `Consultar SRI`), PDF (RIDE)
  con clave de acceso + código de barras, campos `Agente de Retención` / `Contribuyente Especial` /
  `Obligado a Llevar Contabilidad` / `Ambiente: PRODUCCIÓN` / `Emisión: NORMAL`, e historial de
  pagos aplicados con fecha (`Pagado el 17/06/2026: $X`).
- Apuntes contables de la factura: cada línea del asiento lleva una **etiqueta de reporte fiscal**
  (`+411`/`+421` → casillas del Formulario 104), vinculando el asiento directamente a la casilla
  SRI en vez de recalcularla después.
- Listado de **Notas de Crédito** (29 registros) y detalle de una NC real: pestaña **"Modified
  document"** con 4 campos estructurados y obligatorios en el XML de NC electrónica del SRI:
  tipo de documento modificado, número, autorización (clave de acceso) y fecha de emisión, más un
  campo `Motivo`. El PDF imprime esto como "Referencia: Reversión de Fact. X, motivo".
- Menú **Contabilidad → Fechas bloqueadas**: modelo de "fecha de bloqueo única" (una fecha para
  no-asesores, otra para todos los usuarios, otra para impuestos) — alternativa más simple al
  grid de cierre por mes que ya tiene KallpaPro (Sprint 6, doc 19). Anotado como alternativa, no
  reemplazado.

## 2. Hallazgos frente a KallpaPro (comparación)

| Área | Odoo | KallpaPro (antes) | Decisión |
|---|---|---|---|
| Documento sustento de NC | 4 campos estructurados (tipo, número, autorización, fecha) + motivo | Solo `reason` (texto libre) + relación `invoiceId` (la info existía pero no se presentaba estructurada) | ✅ **Implementado** (ver §3) |
| Datos fiscales de empresa en PDF | Agente de Retención / Contribuyente Especial / Obligado a Llevar Contabilidad | No se muestran | Backlog (el usuario no lo priorizó esta sesión) |
| Historial de pagos en detalle de factura | Lista de pagos con fecha y monto | Solo el monto total pagado (`paidAmount`) | Backlog |
| Nota de Débito | Existe como documento propio | No existe en KallpaPro | Backlog (fuera de alcance actual) |
| Casillas oficiales SRI en asientos | Etiqueta `+411`/`+421` por línea de asiento | Form104/103 se calculan recorriendo Invoice/SriDocument directamente | Backlog arquitectónico (ya anotado en doc 19 §8) |
| Cierre de período | Fecha de bloqueo única (3 niveles) | Grid de cierre mensual con trazabilidad por mes (doc 19) | Ambos válidos; KallpaPro da más trazabilidad, Odoo es más simple. No se cambia. |

## 3. Implementado: bloque "Documento Sustento (Modificado)" en NC

**Backend:**
- `credit-note.service.ts` — `getCreditNoteById` y `getCreditNotesForInvoice` ahora incluyen
  `invoice.issueDate` (antes solo `number`/`salesOrderId`). No se tocó el schema: toda la info
  requerida ya vivía en la relación `invoice`, solo faltaba seleccionarla y presentarla.
- `reports.service.ts` — `exportCreditNotePdf` agrega un bloque destacado (caja gris con borde)
  **"DOCUMENTO SUSTENTO (MODIFICADO)"**: `Tipo: Factura de Venta · Nº: <invoice.number> · Fecha de
  emisión: <invoice.issueDate>` seguido de `Motivo: <reason>`. El texto de referencia corto junto
  al encabezado cambió de "Sobre factura: X · fecha de creación de la NC" (confuso, mezclaba la
  fecha de la NC) a "Emisión NC: fecha" (la fecha de la factura ahora vive solo en el bloque nuevo).

**Frontend:**
- `InvoiceDetailPage.tsx` — la sección "Notas de crédito" ahora tiene un subtítulo: "Documento
  sustento: Factura de Venta {number} · emitida el {fecha}", reforzando visualmente el vínculo tal
  como Odoo lo hace en el título de la NC ("Reversión de: Fact. X, motivo").

**Verificación:**
- `tsc --noEmit` verde en backend y frontend.
- `npm test`: 69/69 verdes (sin tests nuevos para este cambio puntual de presentación).
- PDF verificado generando una factura + NC de prueba en una empresa QA dedicada (creada y
  eliminada en la misma sesión, sin tocar datos reales) y renderizando el PDF resultante: el
  bloque "DOCUMENTO SUSTENTO (MODIFICADO)" aparece correctamente con tipo, número, fecha de
  emisión y motivo.

## 3.1. Implementado: documento sustento en Notas de Crédito/Débito de COMPRAS

Simétrico a §3, pero del lado de `SriDocument` (documentos recibidos de proveedores). Más valioso
porque el dato viene directo del XML oficial del SRI — no se infiere, se parsea.

**Schema** (`prisma/schema.prisma`, migración `20260704180000_sri_doc_sustento`):
- `SriDocument.docModificadoTipo` (String?), `docModificadoNumero` (String?), `docModificadoFecha`
  (DateTime?). Solo se pueblan cuando `tipoDocumento` es `NOTA_CREDITO`/`NOTA_DEBITO`.

**Parser** (`sri-parser.service.ts`, función `parseXml`):
- Extrae `codDocModificado` (mapeado a texto legible vía `TIPO_DOC_COD_MAP`, ej. "01" → "FACTURA"),
  `numDocModificado` y `fechaEmisionDocSustento` de `infoNotaCredito`/`infoNotaDebito`. El parser
  de PDF (RIDE, `parseRideText`) NO se tocó — extraer estos campos de texto libre por regex sería
  frágil; el XML es la fuente confiable y ya es el formato preferido para compras.

**Servicio** (`sri-document.service.ts`, `uploadSriDocument`): persiste los 3 campos nuevos al
crear el `SriDocument`.

**Frontend** (`SriDocumentReviewPage.tsx`): bloque "Documento Sustento (Modificado)" visible solo
para `NOTA_CREDITO`/`NOTA_DEBITO`, con tipo/número/fecha; si el XML no trajo el dato (documento
mal formado o parseado desde PDF), muestra una advertencia amarilla en vez de asumir nada.

**Verificación:**
- Test unitario nuevo `tests/sri-doc-sustento.test.ts` (2 tests): parsea un XML sintético de NC de
  compra con `infoNotaCredito` completo y confirma la extracción exacta (tipo/número/fecha); y
  confirma que una factura normal (sin esos campos) NO produce valores inventados (`undefined`).
- `tsc --noEmit` verde en backend y frontend.
- `npm test`: **71/71 verdes** (2 nuevos de este cambio + 69 previos).
- Migración aplicada contra la BD real (`npx prisma migrate deploy`) y cliente Prisma regenerado.

## 4. Backlog (no implementado esta sesión, solo documentado)

- Agregar a `ErpConfig.company` los campos `agenteRetencion` / `contribuyenteEspecial` /
  `obligadoLlevarContabilidad` y mostrarlos en el PDF de factura si están configurados.
- Historial de pagos aplicados (fecha + monto) en `InvoiceDetailPage`, usando
  `Payment`/`PaymentApplication` si ya están conectados a facturas de venta (verificar primero).
- Nota de Débito (nuevo tipo de documento) — evaluar si hay caso de uso real antes de construirla.
- Vincular casillas oficiales del SRI a nivel de línea de asiento (en vez de recalcular en
  Form103/104) — cambio de arquitectura más grande, ya anotado en doc 19 §8.
