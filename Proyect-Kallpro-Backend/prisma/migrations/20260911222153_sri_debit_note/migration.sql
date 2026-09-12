-- AlterTable
ALTER TABLE "sri_transmissions" ADD COLUMN     "debitNoteId" TEXT;

-- CreateTable
CREATE TABLE "debit_notes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sriEstado" TEXT NOT NULL DEFAULT 'NO_ENVIADA',
    "sriAmbiente" TEXT,
    "establishmentId" TEXT,
    "emissionPointId" TEXT,
    "sriSecuencial" TEXT,
    "claveAcceso" TEXT,
    "numeroAutorizacion" TEXT,
    "fechaAutorizacion" TIMESTAMP(3),
    "xmlFirmado" TEXT,
    "xmlAutorizado" TEXT,
    "sriMensajes" JSONB,
    "sriUltimoIntento" TIMESTAMP(3),

    CONSTRAINT "debit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debit_note_concepts" (
    "id" TEXT NOT NULL,
    "debitNoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "debit_note_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "debit_notes_companyId_idx" ON "debit_notes"("companyId");

-- CreateIndex
CREATE INDEX "debit_notes_invoiceId_idx" ON "debit_notes"("invoiceId");

-- CreateIndex
CREATE INDEX "debit_notes_companyId_sriEstado_idx" ON "debit_notes"("companyId", "sriEstado");

-- CreateIndex
CREATE UNIQUE INDEX "debit_notes_companyId_number_key" ON "debit_notes"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "debit_notes_companyId_claveAcceso_key" ON "debit_notes"("companyId", "claveAcceso");

-- CreateIndex
CREATE INDEX "debit_note_concepts_debitNoteId_idx" ON "debit_note_concepts"("debitNoteId");

-- CreateIndex
CREATE INDEX "sri_transmissions_companyId_debitNoteId_idx" ON "sri_transmissions"("companyId", "debitNoteId");

-- AddForeignKey
ALTER TABLE "sri_transmissions" ADD CONSTRAINT "sri_transmissions_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "fiscal_establishments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_emissionPointId_fkey" FOREIGN KEY ("emissionPointId") REFERENCES "fiscal_emission_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note_concepts" ADD CONSTRAINT "debit_note_concepts_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

