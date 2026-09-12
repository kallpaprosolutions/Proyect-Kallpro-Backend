-- AlterTable
ALTER TABLE "inventory_batches" ADD COLUMN     "daysLife" INTEGER,
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "lotNumber" TEXT,
ADD COLUMN     "supplierBatch" TEXT;

-- CreateTable
CREATE TABLE "physical_counts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "countDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "countedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "physical_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "physical_count_items" (
    "id" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "systemQty" DECIMAL(12,4) NOT NULL,
    "physicalQty" DECIMAL(12,4) NOT NULL,
    "variance" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "varianceValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "physical_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "physical_counts_companyId_idx" ON "physical_counts"("companyId");

-- CreateIndex
CREATE INDEX "physical_counts_warehouseId_idx" ON "physical_counts"("warehouseId");

-- CreateIndex
CREATE INDEX "physical_count_items_countId_idx" ON "physical_count_items"("countId");

-- CreateIndex
CREATE INDEX "physical_count_items_productId_idx" ON "physical_count_items"("productId");

-- AddForeignKey
ALTER TABLE "physical_counts" ADD CONSTRAINT "physical_counts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_counts" ADD CONSTRAINT "physical_counts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_count_items" ADD CONSTRAINT "physical_count_items_countId_fkey" FOREIGN KEY ("countId") REFERENCES "physical_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_count_items" ADD CONSTRAINT "physical_count_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
