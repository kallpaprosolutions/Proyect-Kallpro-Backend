-- CreateTable
CREATE TABLE "collection_activities" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "type" TEXT NOT NULL,
    "result" TEXT,
    "promisedAmount" DECIMAL(12,2),
    "promisedDate" TIMESTAMP(3),
    "nextActionAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collection_activities_companyId_customerId_idx" ON "collection_activities"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "collection_activities_companyId_nextActionAt_idx" ON "collection_activities"("companyId", "nextActionAt");

-- AddForeignKey
ALTER TABLE "collection_activities" ADD CONSTRAINT "collection_activities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_activities" ADD CONSTRAINT "collection_activities_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_activities" ADD CONSTRAINT "collection_activities_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
