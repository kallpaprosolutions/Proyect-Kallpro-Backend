-- Numeración única POR EMPRESA (antes era única global → colisionaba entre empresas).
-- Seguro respecto a datos: el unique global previo ya garantizaba unicidad por empresa.

-- DropIndex
DROP INDEX "invoices_number_key";

-- DropIndex
DROP INDEX "sales_orders_orderNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "invoices_companyId_number_key" ON "invoices"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_companyId_orderNumber_key" ON "sales_orders"("companyId", "orderNumber");
