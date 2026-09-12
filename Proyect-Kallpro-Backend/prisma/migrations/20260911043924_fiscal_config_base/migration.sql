-- CreateTable
CREATE TABLE "company_fiscal_config" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "ambiente" TEXT NOT NULL DEFAULT 'PRUEBAS',
    "tipoEmision" TEXT NOT NULL DEFAULT 'NORMAL',
    "obligadoContabilidad" BOOLEAN NOT NULL DEFAULT true,
    "contribuyenteEspecial" TEXT,
    "regimen" TEXT NOT NULL DEFAULT 'GENERAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_fiscal_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_establishments" (
    "id" TEXT NOT NULL,
    "fiscalConfigId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "isMatriz" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_establishments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_emission_points" (
    "id" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_emission_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_digital_certificates" (
    "id" TEXT NOT NULL,
    "fiscalConfigId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "fileDataEnc" BYTEA NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_digital_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_fiscal_config_companyId_key" ON "company_fiscal_config"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_establishments_fiscalConfigId_code_key" ON "fiscal_establishments"("fiscalConfigId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_emission_points_establishmentId_code_key" ON "fiscal_emission_points"("establishmentId", "code");

-- CreateIndex
CREATE INDEX "fiscal_digital_certificates_fiscalConfigId_idx" ON "fiscal_digital_certificates"("fiscalConfigId");

-- AddForeignKey
ALTER TABLE "company_fiscal_config" ADD CONSTRAINT "company_fiscal_config_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_establishments" ADD CONSTRAINT "fiscal_establishments_fiscalConfigId_fkey" FOREIGN KEY ("fiscalConfigId") REFERENCES "company_fiscal_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_emission_points" ADD CONSTRAINT "fiscal_emission_points_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "fiscal_establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_digital_certificates" ADD CONSTRAINT "fiscal_digital_certificates_fiscalConfigId_fkey" FOREIGN KEY ("fiscalConfigId") REFERENCES "company_fiscal_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;
