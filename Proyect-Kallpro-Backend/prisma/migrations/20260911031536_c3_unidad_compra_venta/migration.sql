-- AlterTable
ALTER TABLE "po_items" ADD COLUMN     "purchaseQuantity" DECIMAL(12,4),
ADD COLUMN     "purchaseUnitLabel" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "purchaseConversionFactor" DECIMAL(12,4) NOT NULL DEFAULT 1,
ADD COLUMN     "purchaseUnit" TEXT;
