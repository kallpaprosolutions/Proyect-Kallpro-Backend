-- CreateTable
CREATE TABLE "payment_schedules" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sriDocumentId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "bankAccountId" TEXT,
    "priorityScore" INTEGER NOT NULL,
    "priorityLevel" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "processedPaymentId" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_schedules_companyId_status_idx" ON "payment_schedules"("companyId", "status");

-- CreateIndex
CREATE INDEX "payment_schedules_sriDocumentId_idx" ON "payment_schedules"("sriDocumentId");

-- CreateIndex
CREATE INDEX "payment_schedules_companyId_scheduledDate_idx" ON "payment_schedules"("companyId", "scheduledDate");

-- AddForeignKey
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_sriDocumentId_fkey" FOREIGN KEY ("sriDocumentId") REFERENCES "sri_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
