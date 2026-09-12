# 2. Compras (requisición → pago)

> 📍 Módulo **2** del ciclo operativo · [[flujo-trabajo-erp|← Router de módulos]]

## Flujo de trabajo
Requisición (con prioridad y `neededBy`) → cotizaciones a proveedores (portal) → comparativo
ponderado → aprobación multinivel L1–L5 por matriz de monto → OC → anticipo → recepción
(con ubicación física) → factura de compra (SRI, OCR/IA o manual) → pago saldo. Todo el
tramo genera asientos automáticos.

## Ejecutado ✅
| Paso | Dónde |
|---|---|
| Requisición con prioridad y `neededBy` | `/purchases/requisitions` |
| RFQ a proveedores + portal del proveedor | Portal (`/portal`) |
| Comparativo ponderado de cotizaciones | `QuotationCompare` (matriz ponderada) |
| Score de proveedor multicriterio: `totalScore = 0.30×precio + 0.25×entrega + 0.25×calidad + 0.20×compliance` (verificado en código 2026-09-05) | `supplier-scoring.service.ts` (`SupplierScore`, cache por proveedor) |
| Aprobación multinivel (matriz por monto) | `ApprovalMatrix` L1–L5 |
| OC → anticipo → recepción → pago saldo | Asientos AST automáticos (1010403 anticipos) |
| Recepción con ubicaciones físicas (zona/percha/piso) | `StorageLocation` |
| Factura de compra (SRI) con OCR/IA + 3-way match | Documentos SRI (extracción IA) |
| Ingreso manual/semi-automático de factura, NC o ND (sin PDF/XML), opcionalmente pre-llenado con IA | `NewSriDocumentPage.tsx` (`/sri/new`) + `sri-manual-entry.engine.ts` + `createManualSriDocument` (2026-08-27) |
| Retenciones de compra (Form. 103) | `withholding.service` |
| Detección de facturas de compra duplicadas (proveedor+número exacto bloquea; monto±1%+fecha±5d advierte) | `findPossibleDuplicates` en `sri-document.service` — cierra B1 del [[plan-mejoras-odoo18|plan de mejoras]] |
| Centro de trabajo de factura SRI: checklist de validación (9 puntos) + panel "asiento sugerido" | `computeChecklist` + `GET /sri/:id/journal-preview` en `SriDocumentReviewPage` (2026-08-27) |

## Mejoras propuestas
- ✅ ~~`reqNumber` de requisiciones único global~~ — corregido antes de julio 2026 (`@@unique([companyId, reqNumber])`), ya es por empresa.
- ✅ ~~B3 · Facturas de compra recurrentes~~ — cerrado 2026-09-09, ver [[06-contabilidad|Módulo 6]] (el modelo/servicio vive en Contabilidad, no en Compras).

Sin brechas activas conocidas en este módulo al 2026-09-10.

## Ver también
- [[01-planificacion-presupuesto|Módulo 1 · Planificación]] (control presupuestario al aprobar)
- [[03-inventario|Módulo 3 · Inventario]] (recepción)
- [[06-contabilidad|Módulo 6 · Contabilidad]] (asiento de factura de compra directa)
