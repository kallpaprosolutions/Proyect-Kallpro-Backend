-- AlterTable
ALTER TABLE "collection_activities" ADD COLUMN     "automated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dunningStep" INTEGER;

-- AlterTable
ALTER TABLE "crm_deals" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "salesQuotationId" TEXT;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "freightCost" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "crm_deal_items" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_deal_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_deal_items_dealId_idx" ON "crm_deal_items"("dealId");

-- CreateIndex
CREATE INDEX "collection_activities_companyId_invoiceId_automated_idx" ON "collection_activities"("companyId", "invoiceId", "automated");

-- CreateIndex
CREATE UNIQUE INDEX "crm_deals_salesQuotationId_key" ON "crm_deals"("salesQuotationId");

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_salesQuotationId_fkey" FOREIGN KEY ("salesQuotationId") REFERENCES "sales_quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deal_items" ADD CONSTRAINT "crm_deal_items_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "crm_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deal_items" ADD CONSTRAINT "crm_deal_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

