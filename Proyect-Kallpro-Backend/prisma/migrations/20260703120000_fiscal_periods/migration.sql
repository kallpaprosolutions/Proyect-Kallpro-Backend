-- Sprint 6 — Contabilidad Pro: períodos fiscales (cierre contable mensual)
CREATE TABLE "fiscal_periods" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fiscal_periods_companyId_year_month_key" ON "fiscal_periods"("companyId", "year", "month");
CREATE INDEX "fiscal_periods_companyId_status_idx" ON "fiscal_periods"("companyId", "status");

ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
