-- Numeración multi-tenant, segunda ronda (doc 23 / kallpapro-latent-bugs):
-- el fix de 2026-06-23 solo cubrió Invoice y SalesOrder. Estos 5 modelos seguían con
-- unicidad GLOBAL sobre números que se generan POR EMPRESA (DocumentSequence), por lo que
-- dos empresas colisionaban al llegar al mismo correlativo (p. ej. dos REQ-0001).
-- Se reemplaza el índice único global por uno compuesto (companyId, número).

BEGIN;

-- PurchaseOrder.poNumber (OC-…)
DROP INDEX "purchase_orders_poNumber_key";
CREATE UNIQUE INDEX "purchase_orders_companyId_poNumber_key" ON "purchase_orders"("companyId", "poNumber");

-- Requisition.reqNumber (REQ-…)
DROP INDEX "requisitions_reqNumber_key";
CREATE UNIQUE INDEX "requisitions_companyId_reqNumber_key" ON "requisitions"("companyId", "reqNumber");

-- SalesQuotation.quoteNumber (COT-…)
DROP INDEX "sales_quotations_quoteNumber_key";
CREATE UNIQUE INDEX "sales_quotations_companyId_quoteNumber_key" ON "sales_quotations"("companyId", "quoteNumber");

-- Shipment.trackingNumber (KP-…; también viene de DocumentSequence por empresa)
DROP INDEX "shipments_trackingNumber_key";
CREATE UNIQUE INDEX "shipments_companyId_trackingNumber_key" ON "shipments"("companyId", "trackingNumber");

-- Payment.paymentNumber (PAG-…)
DROP INDEX "payments_paymentNumber_key";
CREATE UNIQUE INDEX "payments_companyId_paymentNumber_key" ON "payments"("companyId", "paymentNumber");

COMMIT;
