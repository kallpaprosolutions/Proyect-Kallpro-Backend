-- DropForeignKey
ALTER TABLE "payment_applications" DROP CONSTRAINT "payment_applications_invoiceId_fkey";

-- AlterTable
ALTER TABLE "payment_applications" ADD COLUMN     "sriDocumentId" TEXT,
ALTER COLUMN "invoiceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "sri_documents" ADD COLUMN     "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "payment_applications_sriDocumentId_idx" ON "payment_applications"("sriDocumentId");

-- AddForeignKey
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_sriDocumentId_fkey" FOREIGN KEY ("sriDocumentId") REFERENCES "sri_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
