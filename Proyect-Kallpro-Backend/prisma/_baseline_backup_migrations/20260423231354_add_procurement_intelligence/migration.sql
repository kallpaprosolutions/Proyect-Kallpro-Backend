-- CreateTable
CREATE TABLE "supplier_performance_records" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "deliveredDate" TIMESTAMP(3),
    "promisedDate" TIMESTAMP(3),
    "onTimeDays" INTEGER,
    "isOnTime" BOOLEAN NOT NULL DEFAULT true,
    "invoiceTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "poTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "priceVariancePct" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "defectQty" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "totalQty" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_performance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_scores" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "priceScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "deliveryScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "qualityScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "complianceScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "totalScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "recordsCount" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "totalDebit" DECIMAL(12,2) NOT NULL,
    "totalCredit" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_lines" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "debit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_performance_records_companyId_idx" ON "supplier_performance_records"("companyId");

-- CreateIndex
CREATE INDEX "supplier_performance_records_supplierId_idx" ON "supplier_performance_records"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_performance_records_poId_idx" ON "supplier_performance_records"("poId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_scores_supplierId_key" ON "supplier_scores"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_scores_companyId_idx" ON "supplier_scores"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_scores_companyId_supplierId_key" ON "supplier_scores"("companyId", "supplierId");

-- CreateIndex
CREATE INDEX "attachments_companyId_idx" ON "attachments"("companyId");

-- CreateIndex
CREATE INDEX "attachments_entityType_entityId_idx" ON "attachments"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "journal_entries_companyId_idx" ON "journal_entries"("companyId");

-- CreateIndex
CREATE INDEX "journal_entries_entityType_entityId_idx" ON "journal_entries"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "journal_entries_entryDate_idx" ON "journal_entries"("entryDate");

-- CreateIndex
CREATE INDEX "journal_entry_lines_entryId_idx" ON "journal_entry_lines"("entryId");

-- AddForeignKey
ALTER TABLE "supplier_performance_records" ADD CONSTRAINT "supplier_performance_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_performance_records" ADD CONSTRAINT "supplier_performance_records_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_performance_records" ADD CONSTRAINT "supplier_performance_records_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_scores" ADD CONSTRAINT "supplier_scores_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_scores" ADD CONSTRAINT "supplier_scores_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
