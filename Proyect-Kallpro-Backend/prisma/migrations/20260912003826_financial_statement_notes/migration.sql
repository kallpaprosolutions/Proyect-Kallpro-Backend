-- CreateTable
CREATE TABLE "financial_statement_notes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "financial_statement_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_statement_notes_companyId_period_idx" ON "financial_statement_notes"("companyId", "period");

-- AddForeignKey
ALTER TABLE "financial_statement_notes" ADD CONSTRAINT "financial_statement_notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

