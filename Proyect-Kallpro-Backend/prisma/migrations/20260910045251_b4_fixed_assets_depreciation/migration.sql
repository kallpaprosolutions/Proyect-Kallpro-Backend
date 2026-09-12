-- CreateTable
CREATE TABLE "fixed_assets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assetNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "acquisitionCost" DECIMAL(12,2) NOT NULL,
    "residualValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "usefulLifeYears" INTEGER NOT NULL,
    "accumulatedDepreciation" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lastDepreciatedPeriod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "disposedAt" TIMESTAMP(3),
    "disposalNote" TEXT,
    "supplierId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fixed_assets_companyId_idx" ON "fixed_assets"("companyId");

-- CreateIndex
CREATE INDEX "fixed_assets_status_idx" ON "fixed_assets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "fixed_assets_companyId_assetNumber_key" ON "fixed_assets"("companyId", "assetNumber");

-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
