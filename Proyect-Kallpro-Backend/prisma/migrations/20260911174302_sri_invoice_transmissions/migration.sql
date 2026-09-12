-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "claveAcceso" TEXT,
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

-- CreateTable
CREATE TABLE "sri_transmissions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "operacion" TEXT NOT NULL,
    "claveAcceso" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "mensajes" JSONB,
    "rawResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sri_transmissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sri_transmissions_companyId_invoiceId_idx" ON "sri_transmissions"("companyId", "invoiceId");

-- CreateIndex
CREATE INDEX "invoices_companyId_sriEstado_idx" ON "invoices"("companyId", "sriEstado");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_companyId_claveAcceso_key" ON "invoices"("companyId", "claveAcceso");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "fiscal_establishments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_emissionPointId_fkey" FOREIGN KEY ("emissionPointId") REFERENCES "fiscal_emission_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sri_transmissions" ADD CONSTRAINT "sri_transmissions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sri_transmissions" ADD CONSTRAINT "sri_transmissions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

