-- AlterTable
ALTER TABLE "product_stock" ADD COLUMN     "maxStock" DECIMAL(12,4),
ADD COLUMN     "minStock" DECIMAL(12,4);

-- CreateTable
CREATE TABLE "replenishment_snoozes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "snoozedUntil" TIMESTAMP(3) NOT NULL,
    "snoozedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "replenishment_snoozes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "replenishment_snoozes_companyId_productId_warehouseId_key" ON "replenishment_snoozes"("companyId", "productId", "warehouseId");

-- AddForeignKey
ALTER TABLE "replenishment_snoozes" ADD CONSTRAINT "replenishment_snoozes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
