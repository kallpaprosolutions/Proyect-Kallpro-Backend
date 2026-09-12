-- AlterTable
ALTER TABLE "sri_documents" ADD COLUMN     "recurringTemplateId" TEXT;

-- CreateTable
CREATE TABLE "recurring_invoice_templates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "taxCode" TEXT NOT NULL DEFAULT '15',
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "lastGeneratedPeriod" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_invoice_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_invoice_templates_companyId_idx" ON "recurring_invoice_templates"("companyId");

-- CreateIndex
CREATE INDEX "recurring_invoice_templates_isActive_idx" ON "recurring_invoice_templates"("isActive");

-- AddForeignKey
ALTER TABLE "recurring_invoice_templates" ADD CONSTRAINT "recurring_invoice_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_invoice_templates" ADD CONSTRAINT "recurring_invoice_templates_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sri_documents" ADD CONSTRAINT "sri_documents_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "recurring_invoice_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
