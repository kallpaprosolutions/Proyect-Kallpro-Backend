# Base de Datos — Modelos y Relaciones (PostgreSQL · Prisma)

> 📍 Documento VIVO de **arquitectura de datos**. Complementa [[arquitectura-tecnica]] §4
> (que da el resumen de una línea) con el mapa completo de los **113 modelos** reales de
> `Proyect-Kallpro-Backend/prisma/schema.prisma` (3332 líneas — no lo leas entero, usa este
> mapa para saber en qué sección está lo que buscas).
> Actualízalo solo cuando se agregue/quite un MODELO o cambie una relación estructural —
> no por cada migración menor. Última verificación contra el schema real: 2026-09-10.

## 1. Los dos patrones de relación (no confundirlos)

**A. Relación FK normal** (`@relation(fields: [xId], references: [id])`) — para relaciones
estructurales dentro del mismo dominio: `PurchaseOrder.supplierId → Supplier`,
`InvoiceItem.invoiceId → Invoice`, etc. Prisma valida la integridad referencial.

**B. Relación polimórfica por `entityType`/`entityId`** (campos `String`, SIN foreign key) —
para que un mecanismo transversal apunte a CUALQUIER documento de negocio sin que cada
modelo de destino necesite una columna nueva. Es la regla transversal 4 (trazabilidad).
Confirmado en el schema real, la usan:
- `DocumentMessage` (Chatter, A2/A2.2) — `entityType: PURCHASE_ORDER|SALES_ORDER|INVOICE|REQUISITION`
- `DocumentFollower` (seguidores, A2.2) — mismos `entityType`
- `Activity` (actividades programadas, A3) — mismos 4 `entityType`
- `Attachment` — `entityType: REQUISITION|PURCHASE_ORDER|INVOICE|SRI_DOCUMENT`
- `AuditLog` — `entityType` genérico (usado en datos maestros: Product/Customer/Supplier)
- `JournalEntry` — `entityType: PURCHASE_ORDER|INVOICE|INVENTORY|...` (de dónde nació el asiento)
- `Payment` — `entityType: CUSTOMER|SUPPLIER`
- `BankTransaction` — `sourceType: PAYROLL|AP_INVOICE|AR_INVOICE|TAX_SRI|TAX_IESS|MANUAL`
- Variante con FK real pero mismo espíritu: `InventoryMovement.batchId` / `ProductionConsumption.batchId` (trazabilidad de lote, sin FK estricta a `InventoryBatch` en todos los casos).

**Por qué importa**: si agregas un nuevo tipo de documento al Chatter/Actividades/Adjuntos,
NO necesitas migración — solo agregar el string nuevo a la lista de `entityType` esperada
(documentada en cada servicio, no en el schema). Si agregas un modelo nuevo con relación FK,
sí necesitas migración.

## 2. Raíz multi-tenant
`Company` es la raíz de **todo**. Prácticamente los 113 modelos de negocio llevan
`companyId String` + `@relation(fields: [companyId], references: [id], onDelete: Cascade)`.
Los únicos modelos sin `companyId` son catálogos globales compartidos entre empresas
(`IvaTariff`, `RetentionCatalog`) y los de suscripción del propio SaaS (§3.13).

## 3. Inventario de modelos por dominio (mapea a `Modulos/`)

### 3.1 Núcleo / autenticación / transversal
`Company` · `User` · `UserSession` · `AuditLog` · `Department` · `DocumentSequence`
(numeración atómica por empresa — regla 1) · `DocumentMessage` · `DocumentFollower` ·
`Activity` · `Attachment` — ver [[09-ux-transversal]].

### 3.2 [[01-planificacion-presupuesto|Módulo 1 · Planificación]]
`BudgetControl` (por `Department`, con escalado L3).

### 3.3 [[02-compras|Módulo 2 · Compras]]
`Supplier` · `PurchaseOrder` · `POItem` · `Requisition` · `RequisitionItem` ·
`SupplierQuotation` · `QuotationItem` · `ApprovalMatrix` (L1–L5 por monto) ·
`SupplierPerformanceRecord` · `SupplierScore` (score multicriterio, ver módulo 2) ·
`PortalQuotationResponse` · `PortalQuotationItem` (portal de proveedores, JWT propio).

### 3.4 [[03-inventario|Módulo 3 · Inventario]]
`Category` · `Warehouse` · `StorageLocation` · `Product` (incluye `allowNegativeStock`,
`purchaseUnit`/`purchaseConversionFactor` — C3) · `ProductStock` (incluye `minStock`/`maxStock`
override por bodega — C1) · `ReplenishmentSnooze` (C1) · `InventoryMovement` ·
`InventoryAdjustment` · `InventoryBatch` (lotes/vencimiento) · `PhysicalCount` ·
`PhysicalCountItem`.

### 3.5 [[03b-produccion-calidad|Módulo 3.b · Producción y Calidad]]
`BillOfMaterials` · `BOMItem` · `ProductionOrder` · `ProductionOrderItem` ·
`ProductionConsumption` · `QualityParameter` · `QualityInspection` ·
`QualityInspectionResult` · `NonConformity` (CAPA).

### 3.6 [[04-ventas|Módulo 4 · Ventas]]
`Customer` · `SalesQuotation` · `SalesQuotationItem` · `SalesOrder` · `SalesOrderItem` ·
`PriceList` · `PriceListItem` · `Shipment` (`freightCost` — costo real de flete, 2026-09-11) ·
`ShipmentItem` (guarda `unitCost` — COGS exacto por capa, doc23) · `ShipmentEvent` (tracking).

### 3.7 Facturación / SRI (compras y ventas — dos flujos paralelos, ver doc20)
`Invoice` · `InvoiceItem` · `CreditNote` · `CreditNoteItem` (flujo de VENTAS) ·
`SriDocument` · `SriDocumentItem` (flujo de COMPRAS, incluye `recurringTemplateId` — B3) ·
`SriRetention` · `IvaTariff` · `RetentionCatalog` (catálogos globales, sin `companyId`) ·
`InvoiceWithholding` · `RecurringInvoiceTemplate` (B3).

**Facturación electrónica SRI** (plan `plan-contabilidad-tributaria-sri.md`, Etapas 1, 3 y 4):
`CompanyFiscalConfig` (1:1 con `Company`: RUC, régimen, ambiente PRUEBAS/PRODUCCION) ·
`Establishment` · `EmissionPoint` (numeración SRI estab-ptoEmi, el secuencial de 9 dígitos reusa
`DocumentSequence` con docType `SRI_FACTURA_<estab>_<ptoEmi>` / `SRI_NOTACREDITO_<estab>_<ptoEmi>`)
· `DigitalCertificate` (.p12 cifrado AES-256-GCM, nunca expuesto por API) · `SriTransmission`
(bitácora inmutable de cada recepción/autorización con el raw XML — regla 4; `invoiceId` y
`creditNoteId` son ambos nullable, exactamente uno seteado según el tipo de comprobante,
validado en el servicio). `Invoice` y `CreditNote` llevan ambos el mismo estado tributario
(`sriEstado`, `claveAcceso`, `numeroAutorizacion`, `xmlFirmado`, `xmlAutorizado`…), FK a
`Establishment`/`EmissionPoint`, e índice único `[companyId, claveAcceso]` cada uno.

### 3.8 [[06-contabilidad|Módulo 6 · Contabilidad]]
`JournalEntry` · `JournalEntryLine` · `FiscalPeriod` (cierres, bloquea reversos) ·
`FixedAsset` (B4, activos fijos/depreciación) · `FinanceChartOfAccounts` ·
`AccountMapping` (posting setup — regla 3) · `FinancialStatement`.

### 3.9 [[08-analisis-financiero-cxp-cxc|Módulo 8 · Análisis financiero CxP/CxC]]
`Payment` · `PaymentApplication` (neteo con NC) · `PaymentSchedule` (Fase 3 priorización) ·
`CollectionActivity` (gestión de cobranza CxC — `automated`/`dunningStep` para distinguir el
recordatorio automático de la gestión humana, 2026-09-11) · `FinanceDCFModel` ·
`FinanceScenario` · `FinanceSavingsLog` · `FinanceAIInsight`.

### 3.10 [[05-07-tesoreria-nomina-biometrico|Módulos 5/7 · Tesorería]]
`BankAccount` · `BankTransaction` · `BankStatementLine` (conciliación, B2).

### 3.11 [[05-07-tesoreria-nomina-biometrico|Módulos 5/7 · Nómina, Biométrico y RRHH]]
`Employee` (incluye `managerId` auto-relación — organigrama, `userId` — vínculo a `User`) ·
`ShiftTemplate` · `ShiftAssignment` (calendario TTHH) · `LeaveRequest` (doble aprobación) ·
`PayrollPeriod` · `Payslip` · `PayslipLine` · `PayrollNovelty` · `AttendanceRecord`
(biométrico).

### 3.12 [[10-crm|Módulo 10 · CRM]]
`CrmContact` · `CrmCompany` · `CrmDeal` (`customerId`/`salesQuotationId` — puente a Ventas,
2026-09-11) · `CrmDealItem` (productos conversados, alimenta la cotización generada al ganar) ·
`CrmDealStageHistory` · `CrmConversation` · `CrmMessage` · `CrmAgent` · `CrmAgentRun` (agentes
IA editables) · `CrmWorkflow` · `CrmLeadScore` · `CrmForecast` · `CrmTemplate` · `CrmLead` ·
`CrmLeadEvent` · `CrmCaptureForm` (formularios web, honeypot) · `CrmScoringRule` ·
`CrmScoringConfig` · `CrmPipelineStage` (editable, sustituye constante) · `CrmAssignmentRule`.

### 3.13 Suscripción del propio SaaS (NO es data del negocio del cliente)
`SubscriptionPlan` · `Subscription` · `BillingHistory` — facturación de KallpaPro a sus
propios clientes empresa, no confundir con `Invoice`/`SriDocument` (facturación DEL cliente
hacia SUS clientes/proveedores).

## 4. Relaciones estructurales clave (hubs)

```
Company 1─N User, Product, Supplier, Customer, PurchaseOrder, SalesOrder, Invoice,
             SriDocument, JournalEntry, Employee, BankAccount, CrmLead, ... (casi todo)

Product 1─N ProductStock (por Warehouse), InventoryMovement, InventoryBatch,
             POItem, SalesOrderItem, BOMItem (como componente o como producido)

PurchaseOrder 1─N POItem ──→ Product
              1─1 Requisition (origen, opcional)
              1─N Attachment/DocumentMessage/Activity (vía entityType='PURCHASE_ORDER')

SalesOrder 1─N SalesOrderItem ──→ Product
           1─N Shipment ──→ ShipmentItem (unitCost = costo real de la capa consumida)
           1─1 Invoice (al facturar)

Invoice / SriDocument ──→ JournalEntry (vía entityType/entityId, NO FK directa)
JournalEntry 1─N JournalEntryLine ──→ AccountMapping (cuenta real)

Employee (auto-relación managerId) ──→ PayrollPeriod ──→ Payslip ──→ PayslipLine
Employee ──→ AttendanceRecord ──→ PayrollNovelty (horas extra, vía attendance.service)

BankAccount 1─N BankTransaction (sourceType apunta a Payroll/Invoice/Tax, sin FK) ──→
             JournalEntry (vía journalEntryId, FK real esta sí)

CrmLead ──→ (conversión) ──→ CrmContact + CrmCompany + CrmDeal (transaccional, una sola vez)
```

## 5. Migraciones — dónde y cómo
`Proyect-Kallpro-Backend/prisma/migrations/` (histórico completo, nunca editar una ya
aplicada). **Detener el backend antes de migrar** (ver
[[../Credenciales/00-ACCESOS-Y-ENTORNO|Credenciales]] — EPERM en Windows/OneDrive).
Semillas en `prisma/seeds/` (usuario admin, catálogos). Migraciones recientes relevantes
(no exhaustivo, ver el historial real en la carpeta): `c1_replenishment_per_warehouse`,
`c3_negative_stock_configurable`, `c3_unidad_compra_venta`, `b3_recurring_invoice_templates`,
`b4_fixed_assets_depreciation`.

## Ver también
- [[arquitectura-tecnica|Arquitectura técnica]] (capas de código que usan estos modelos)
- [[flujo-trabajo-erp|Router de módulos]] (el QUÉ funcional de cada grupo de modelos)
- [[protocolo-documentacion|Protocolo de documentación]]
