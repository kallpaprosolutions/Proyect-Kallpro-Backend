-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pendingChallengeJti" TEXT;

-- CreateIndex
CREATE INDEX "invoice_withholdings_invoiceId_tipo_idx" ON "invoice_withholdings"("invoiceId", "tipo");

-- CreateIndex
CREATE INDEX "invoice_withholdings_tipo_codigo_idx" ON "invoice_withholdings"("tipo", "codigo");

