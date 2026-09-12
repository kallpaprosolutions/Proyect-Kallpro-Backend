/*
  Warnings:

  - You are about to alter the column `quantity` on the `inventory_movements` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(12,4)`.
  - You are about to drop the column `cost` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `products` table. All the data in the column will be lost.
  - You are about to drop the `inventory` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `warehouseId` to the `inventory_movements` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "inventory" DROP CONSTRAINT "inventory_productId_fkey";

-- DropIndex
DROP INDEX "products_sku_key";

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "avgCostAfter" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "stockAfter" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN     "totalCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN     "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN     "warehouseId" TEXT NOT NULL,
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "products" DROP COLUMN "cost",
DROP COLUMN "price",
ADD COLUMN     "avgCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "lastMovementAt" TIMESTAMP(3),
ADD COLUMN     "maxStock" DECIMAL(12,4),
ADD COLUMN     "minStock" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN     "salePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'PRODUCT',
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'UNIDAD';

-- DropTable
DROP TABLE "inventory";

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "address" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_stock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_stock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_companyId_idx" ON "categories"("companyId");

-- CreateIndex
CREATE INDEX "warehouses_companyId_idx" ON "warehouses"("companyId");

-- CreateIndex
CREATE INDEX "product_stock_productId_idx" ON "product_stock"("productId");

-- CreateIndex
CREATE INDEX "product_stock_warehouseId_idx" ON "product_stock"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "product_stock_productId_warehouseId_key" ON "product_stock"("productId", "warehouseId");

-- CreateIndex
CREATE INDEX "inventory_movements_warehouseId_idx" ON "inventory_movements"("warehouseId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stock" ADD CONSTRAINT "product_stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stock" ADD CONSTRAINT "product_stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
