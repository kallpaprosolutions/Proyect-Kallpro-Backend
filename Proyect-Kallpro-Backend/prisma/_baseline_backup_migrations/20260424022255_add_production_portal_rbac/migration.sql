-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "lastPortalLogin" TIMESTAMP(3),
ADD COLUMN     "portalEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "portalPassword" TEXT,
ADD COLUMN     "portalToken" TEXT;

-- CreateTable
CREATE TABLE "portal_quotation_responses" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "validUntil" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_quotation_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_quotation_items" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "deliveryDays" INTEGER,
    "notes" TEXT,

    CONSTRAINT "portal_quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills_of_materials" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_of_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_items" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT,
    "wastePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "bomId" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "quantityDone" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "requiredQty" DECIMAL(12,4) NOT NULL,
    "consumedQty" DECIMAL(12,4) NOT NULL DEFAULT 0,

    CONSTRAINT "production_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portal_quotation_responses_supplierId_idx" ON "portal_quotation_responses"("supplierId");

-- CreateIndex
CREATE INDEX "portal_quotation_responses_requisitionId_idx" ON "portal_quotation_responses"("requisitionId");

-- CreateIndex
CREATE INDEX "portal_quotation_items_responseId_idx" ON "portal_quotation_items"("responseId");

-- CreateIndex
CREATE INDEX "bills_of_materials_companyId_idx" ON "bills_of_materials"("companyId");

-- CreateIndex
CREATE INDEX "bills_of_materials_productId_idx" ON "bills_of_materials"("productId");

-- CreateIndex
CREATE INDEX "bom_items_bomId_idx" ON "bom_items"("bomId");

-- CreateIndex
CREATE INDEX "production_orders_companyId_idx" ON "production_orders"("companyId");

-- CreateIndex
CREATE INDEX "production_orders_productId_idx" ON "production_orders"("productId");

-- CreateIndex
CREATE INDEX "production_orders_status_idx" ON "production_orders"("status");

-- CreateIndex
CREATE INDEX "production_order_items_orderId_idx" ON "production_order_items"("orderId");

-- CreateIndex
CREATE INDEX "suppliers_portalToken_idx" ON "suppliers"("portalToken");

-- AddForeignKey
ALTER TABLE "portal_quotation_responses" ADD CONSTRAINT "portal_quotation_responses_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_quotation_responses" ADD CONSTRAINT "portal_quotation_responses_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_quotation_items" ADD CONSTRAINT "portal_quotation_items_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "portal_quotation_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_quotation_items" ADD CONSTRAINT "portal_quotation_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_materials" ADD CONSTRAINT "bills_of_materials_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_materials" ADD CONSTRAINT "bills_of_materials_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "bills_of_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "bills_of_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_items" ADD CONSTRAINT "production_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_items" ADD CONSTRAINT "production_order_items_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
