-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "fromWarehouseId" TEXT,
ADD COLUMN     "toWarehouseId" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "reorderPoint" DECIMAL(12,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "parentWarehouseId" TEXT;

-- CreateIndex
CREATE INDEX "inventory_movements_batchId_idx" ON "inventory_movements"("batchId");

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_parentWarehouseId_fkey" FOREIGN KEY ("parentWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
