-- AlterTable
ALTER TABLE "credit_notes" ADD COLUMN     "claveAcceso" TEXT,
ADD COLUMN     "emissionPointId" TEXT,
ADD COLUMN     "establishmentId" TEXT,
ADD COLUMN     "fechaAutorizacion" TIMESTAMP(3),
ADD COLUMN     "numeroAutorizacion" TEXT,
ADD COLUMN     "sriAmbiente" TEXT,
ADD COLUMN     "sriEstado" TEXT NOT NULL DEFAULT 'NO_ENVIADA',
ADD COLUMN     "sriMensajes" JSONB,
ADD COLUMN     "sriSecuencial" TEXT,
ADD COLUMN     "sriUltimoIntento" TIMESTAMP(3),
ADD COLUMN     "xmlAutorizado" TEXT,
ADD COLUMN     "xmlFirmado" TEXT;

-- AlterTable
ALTER TABLE "sri_transmissions" ADD COLUMN     "creditNoteId" TEXT,
ALTER COLUMN "invoiceId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "credit_notes_companyId_sriEstado_idx" ON "credit_notes"("companyId", "sriEstado");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_companyId_claveAcceso_key" ON "credit_notes"("companyId", "claveAcceso");

-- CreateIndex
CREATE INDEX "sri_transmissions_companyId_creditNoteId_idx" ON "sri_transmissions"("companyId", "creditNoteId");

-- AddForeignKey
ALTER TABLE "sri_transmissions" ADD CONSTRAINT "sri_transmissions_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "fiscal_establishments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_emissionPointId_fkey" FOREIGN KEY ("emissionPointId") REFERENCES "fiscal_emission_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

