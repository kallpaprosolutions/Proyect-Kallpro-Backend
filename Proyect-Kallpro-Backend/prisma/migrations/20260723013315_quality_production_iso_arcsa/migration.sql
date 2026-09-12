-- AlterTable
ALTER TABLE "inventory_batches" ADD COLUMN     "productionOrderId" TEXT,
ADD COLUMN     "qualityStatus" TEXT NOT NULL DEFAULT 'RELEASED';

-- AlterTable
ALTER TABLE "production_orders" ADD COLUMN     "actualCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "journalEntryId" TEXT,
ADD COLUMN     "lotNumber" TEXT,
ADD COLUMN     "manufacturingDate" TIMESTAMP(3),
ADD COLUMN     "qualityStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "releaseNotes" TEXT,
ADD COLUMN     "releasedAt" TIMESTAMP(3),
ADD COLUMN     "releasedBy" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "requiresQualityControl" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sanitaryRegistry" TEXT,
ADD COLUMN     "sanitaryRegistryExpiry" TIMESTAMP(3),
ADD COLUMN     "shelfLifeDays" INTEGER;

-- CreateTable
CREATE TABLE "production_consumptions" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "batchId" TEXT,
    "lotNumber" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL,
    "totalCost" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_parameters" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NUMERIC',
    "unit" TEXT,
    "minValue" DECIMAL(12,4),
    "maxValue" DECIMAL(12,4),
    "expectedText" TEXT,
    "method" TEXT,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "norm" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_inspections" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "inspectionNumber" TEXT NOT NULL,
    "productionOrderId" TEXT,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FINAL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "lotNumber" TEXT,
    "inspectedBy" TEXT,
    "inspectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_inspection_results" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "valueNumeric" DECIMAL(12,4),
    "valueBoolean" BOOLEAN,
    "valueText" TEXT,
    "passed" BOOLEAN NOT NULL,
    "observation" TEXT,

    CONSTRAINT "quality_inspection_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "non_conformities" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ncNumber" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MINOR',
    "description" TEXT NOT NULL,
    "productionOrderId" TEXT,
    "inspectionId" TEXT,
    "productId" TEXT,
    "lotNumber" TEXT,
    "disposition" TEXT,
    "rootCause" TEXT,
    "correctiveAction" TEXT,
    "responsibleUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "effectivenessCheck" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "non_conformities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "production_consumptions_orderId_idx" ON "production_consumptions"("orderId");

-- CreateIndex
CREATE INDEX "production_consumptions_batchId_idx" ON "production_consumptions"("batchId");

-- CreateIndex
CREATE INDEX "quality_parameters_companyId_productId_isActive_idx" ON "quality_parameters"("companyId", "productId", "isActive");

-- CreateIndex
CREATE INDEX "quality_inspections_companyId_status_idx" ON "quality_inspections"("companyId", "status");

-- CreateIndex
CREATE INDEX "quality_inspections_productionOrderId_idx" ON "quality_inspections"("productionOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "quality_inspections_companyId_inspectionNumber_key" ON "quality_inspections"("companyId", "inspectionNumber");

-- CreateIndex
CREATE INDEX "quality_inspection_results_inspectionId_idx" ON "quality_inspection_results"("inspectionId");

-- CreateIndex
CREATE INDEX "non_conformities_companyId_status_idx" ON "non_conformities"("companyId", "status");

-- CreateIndex
CREATE INDEX "non_conformities_productionOrderId_idx" ON "non_conformities"("productionOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "non_conformities_companyId_ncNumber_key" ON "non_conformities"("companyId", "ncNumber");

-- CreateIndex
CREATE INDEX "inventory_batches_qualityStatus_idx" ON "inventory_batches"("qualityStatus");

-- CreateIndex
CREATE INDEX "production_orders_companyId_qualityStatus_idx" ON "production_orders"("companyId", "qualityStatus");

-- AddForeignKey
ALTER TABLE "production_consumptions" ADD CONSTRAINT "production_consumptions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_consumptions" ADD CONSTRAINT "production_consumptions_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_parameters" ADD CONSTRAINT "quality_parameters_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_parameters" ADD CONSTRAINT "quality_parameters_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspection_results" ADD CONSTRAINT "quality_inspection_results_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "quality_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspection_results" ADD CONSTRAINT "quality_inspection_results_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "quality_parameters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformities" ADD CONSTRAINT "non_conformities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformities" ADD CONSTRAINT "non_conformities_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformities" ADD CONSTRAINT "non_conformities_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "quality_inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
