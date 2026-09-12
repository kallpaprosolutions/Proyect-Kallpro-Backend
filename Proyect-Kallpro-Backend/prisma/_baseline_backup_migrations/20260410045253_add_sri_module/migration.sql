-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "ruc" TEXT;

-- CreateTable
CREATE TABLE "sri_documents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "tipoDocumento" TEXT NOT NULL DEFAULT 'FACTURA',
    "claveAcceso" TEXT NOT NULL,
    "numeroAutorizacion" TEXT,
    "rucEmisor" TEXT NOT NULL,
    "razonSocialEmisor" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "dirEmisor" TEXT,
    "contribuyenteEspecial" TEXT,
    "obligadoContabilidad" BOOLEAN NOT NULL DEFAULT false,
    "tipoIdComprador" TEXT,
    "idComprador" TEXT,
    "razonSocialComprador" TEXT,
    "dirComprador" TEXT,
    "estab" TEXT,
    "ptoEmi" TEXT,
    "secuencial" TEXT,
    "numeroDoc" TEXT,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "fechaAutorizacion" TIMESTAMP(3),
    "ambiente" TEXT DEFAULT 'PRODUCCION',
    "subtotal0" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal8" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal12" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal15" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotalNoObj" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotalExento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDescuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "irbpnr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "propina" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "formaPago" TEXT,
    "valorFormaPago" DECIMAL(12,2),
    "retencionRenta" DECIMAL(12,2),
    "retencionIva" DECIMAL(12,2),
    "parseConfidence" INTEGER,
    "parseWarnings" TEXT,
    "fileType" TEXT,
    "rawJson" JSONB,
    "observaciones" TEXT,
    "supplierId" TEXT,
    "purchaseOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sri_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sri_document_items" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "linea" INTEGER NOT NULL,
    "codPrincipal" TEXT NOT NULL,
    "codAuxiliar" TEXT,
    "descripcion" TEXT NOT NULL,
    "detAdicional" TEXT,
    "cantidad" DECIMAL(12,4) NOT NULL,
    "precioUnitario" DECIMAL(12,4) NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "precioTotal" DECIMAL(12,2) NOT NULL,
    "codigoTarifa" TEXT NOT NULL,
    "tarifaIva" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "valorIva" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tipoItem" TEXT NOT NULL DEFAULT 'PRODUCTO',
    "productId" TEXT,

    CONSTRAINT "sri_document_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sri_retentions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "baseImponible" DECIMAL(12,2) NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "sri_retentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iva_tariffs" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigenciaDesde" TIMESTAMP(3) NOT NULL,
    "vigenciaHasta" TIMESTAMP(3),

    CONSTRAINT "iva_tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_catalog" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "aplicaA" TEXT NOT NULL,

    CONSTRAINT "retention_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sri_documents_companyId_idx" ON "sri_documents"("companyId");

-- CreateIndex
CREATE INDEX "sri_documents_rucEmisor_idx" ON "sri_documents"("rucEmisor");

-- CreateIndex
CREATE INDEX "sri_documents_status_idx" ON "sri_documents"("status");

-- CreateIndex
CREATE INDEX "sri_documents_fechaEmision_idx" ON "sri_documents"("fechaEmision");

-- CreateIndex
CREATE UNIQUE INDEX "sri_documents_companyId_claveAcceso_key" ON "sri_documents"("companyId", "claveAcceso");

-- CreateIndex
CREATE INDEX "sri_document_items_documentId_idx" ON "sri_document_items"("documentId");

-- CreateIndex
CREATE INDEX "sri_retentions_documentId_idx" ON "sri_retentions"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "iva_tariffs_codigo_key" ON "iva_tariffs"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "retention_catalog_codigo_key" ON "retention_catalog"("codigo");

-- CreateIndex
CREATE INDEX "suppliers_ruc_idx" ON "suppliers"("ruc");

-- AddForeignKey
ALTER TABLE "sri_documents" ADD CONSTRAINT "sri_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sri_documents" ADD CONSTRAINT "sri_documents_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sri_documents" ADD CONSTRAINT "sri_documents_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sri_document_items" ADD CONSTRAINT "sri_document_items_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "sri_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sri_document_items" ADD CONSTRAINT "sri_document_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sri_retentions" ADD CONSTRAINT "sri_retentions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "sri_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
