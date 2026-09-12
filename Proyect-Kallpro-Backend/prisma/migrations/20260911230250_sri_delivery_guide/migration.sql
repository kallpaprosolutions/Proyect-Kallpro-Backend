-- AlterTable
ALTER TABLE "sri_transmissions" ADD COLUMN     "deliveryGuideId" TEXT;

-- CreateTable
CREATE TABLE "delivery_guides" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "motivoTraslado" TEXT NOT NULL,
    "transportistaTipoIdentificacion" TEXT NOT NULL,
    "transportistaIdentificacion" TEXT NOT NULL,
    "transportistaRazonSocial" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "dirPartida" TEXT NOT NULL,
    "fechaIniTransporte" TIMESTAMP(3) NOT NULL,
    "fechaFinTransporte" TIMESTAMP(3) NOT NULL,
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

    CONSTRAINT "delivery_guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_guide_items" (
    "id" TEXT NOT NULL,
    "deliveryGuideId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "delivery_guide_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_guides_companyId_idx" ON "delivery_guides"("companyId");

-- CreateIndex
CREATE INDEX "delivery_guides_shipmentId_idx" ON "delivery_guides"("shipmentId");

-- CreateIndex
CREATE INDEX "delivery_guides_companyId_sriEstado_idx" ON "delivery_guides"("companyId", "sriEstado");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_guides_companyId_number_key" ON "delivery_guides"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_guides_companyId_claveAcceso_key" ON "delivery_guides"("companyId", "claveAcceso");

-- CreateIndex
CREATE INDEX "delivery_guide_items_deliveryGuideId_idx" ON "delivery_guide_items"("deliveryGuideId");

-- CreateIndex
CREATE INDEX "sri_transmissions_companyId_deliveryGuideId_idx" ON "sri_transmissions"("companyId", "deliveryGuideId");

-- AddForeignKey
ALTER TABLE "sri_transmissions" ADD CONSTRAINT "sri_transmissions_deliveryGuideId_fkey" FOREIGN KEY ("deliveryGuideId") REFERENCES "delivery_guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_guides" ADD CONSTRAINT "delivery_guides_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_guides" ADD CONSTRAINT "delivery_guides_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_guides" ADD CONSTRAINT "delivery_guides_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "fiscal_establishments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_guides" ADD CONSTRAINT "delivery_guides_emissionPointId_fkey" FOREIGN KEY ("emissionPointId") REFERENCES "fiscal_emission_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_guide_items" ADD CONSTRAINT "delivery_guide_items_deliveryGuideId_fkey" FOREIGN KEY ("deliveryGuideId") REFERENCES "delivery_guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

