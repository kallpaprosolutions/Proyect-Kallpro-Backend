-- AlterTable
ALTER TABLE "crm_deals" ADD COLUMN     "categoryOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "forecastCategory" TEXT NOT NULL DEFAULT 'PIPELINE',
ADD COLUMN     "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "leadId" TEXT;

-- AlterTable
ALTER TABLE "crm_forecasts" ADD COLUMN     "bestCaseAccuracy" DOUBLE PRECISION,
ADD COLUMN     "bestCaseUsd" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "byCategory" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "commitAccuracy" DOUBLE PRECISION,
ADD COLUMN     "commitUsd" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "coverageRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "isClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "omittedUsd" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "quotaUsd" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "crm_leads" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT,
    "companyName" TEXT,
    "ruc" TEXT,
    "website" TEXT,
    "city" TEXT,
    "message" TEXT,
    "rawPayload" JSONB DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "formId" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "referrer" TEXT,
    "landingPage" TEXT,
    "gclid" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "score" INTEGER NOT NULL DEFAULT 0,
    "fitScore" INTEGER NOT NULL DEFAULT 0,
    "engageScore" INTEGER NOT NULL DEFAULT 0,
    "grade" TEXT NOT NULL DEFAULT 'D',
    "temperature" TEXT NOT NULL DEFAULT 'cold',
    "scoreBreakdown" JSONB NOT NULL DEFAULT '[]',
    "scoredAt" TIMESTAMP(3),
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOfId" TEXT,
    "dedupeScore" INTEGER NOT NULL DEFAULT 0,
    "dedupeReason" TEXT,
    "ownerUserId" TEXT,
    "assignedByRuleId" TEXT,
    "disqualifyReason" TEXT,
    "convertedAt" TIMESTAMP(3),
    "convertedContactId" TEXT,
    "convertedCompanyId" TEXT,
    "convertedDealId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lead_events" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "channel" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_capture_forms" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "description" TEXT,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "consentText" TEXT,
    "requireConsent" BOOLEAN NOT NULL DEFAULT true,
    "successMessage" TEXT NOT NULL DEFAULT '¡Gracias! Nos pondremos en contacto contigo.',
    "redirectUrl" TEXT,
    "defaultOwnerUserId" TEXT,
    "autoScore" BOOLEAN NOT NULL DEFAULT true,
    "autoAssign" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "submissionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "crm_capture_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_scoring_rules" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "points" INTEGER NOT NULL DEFAULT 0,
    "maxPoints" INTEGER,
    "halfLifeDays" INTEGER,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_scoring_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_scoring_config" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fitWeight" INTEGER NOT NULL DEFAULT 50,
    "engagementWeight" INTEGER NOT NULL DEFAULT 50,
    "halfLifeDays" INTEGER NOT NULL DEFAULT 30,
    "mqlThreshold" INTEGER NOT NULL DEFAULT 50,
    "sqlThreshold" INTEGER NOT NULL DEFAULT 75,
    "gradeAThreshold" INTEGER NOT NULL DEFAULT 80,
    "gradeBThreshold" INTEGER NOT NULL DEFAULT 60,
    "gradeCThreshold" INTEGER NOT NULL DEFAULT 40,
    "hotThreshold" INTEGER NOT NULL DEFAULT 75,
    "warmThreshold" INTEGER NOT NULL DEFAULT 45,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "crm_scoring_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_pipeline_stages" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "probability" INTEGER NOT NULL DEFAULT 10,
    "forecastCategory" TEXT NOT NULL DEFAULT 'PIPELINE',
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "isLost" BOOLEAN NOT NULL DEFAULT false,
    "entryCriteria" TEXT,
    "targetDays" INTEGER NOT NULL DEFAULT 14,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_assignment_rules" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "assignMode" TEXT NOT NULL DEFAULT 'ROUND_ROBIN',
    "ownerUserId" TEXT,
    "poolUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rrCursor" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_assignment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_leads_companyId_idx" ON "crm_leads"("companyId");

-- CreateIndex
CREATE INDEX "crm_leads_status_idx" ON "crm_leads"("status");

-- CreateIndex
CREATE INDEX "crm_leads_score_idx" ON "crm_leads"("score");

-- CreateIndex
CREATE INDEX "crm_leads_email_idx" ON "crm_leads"("email");

-- CreateIndex
CREATE INDEX "crm_leads_phone_idx" ON "crm_leads"("phone");

-- CreateIndex
CREATE INDEX "crm_leads_ownerUserId_idx" ON "crm_leads"("ownerUserId");

-- CreateIndex
CREATE INDEX "crm_leads_source_idx" ON "crm_leads"("source");

-- CreateIndex
CREATE INDEX "crm_leads_createdAt_idx" ON "crm_leads"("createdAt");

-- CreateIndex
CREATE INDEX "crm_lead_events_leadId_idx" ON "crm_lead_events"("leadId");

-- CreateIndex
CREATE INDEX "crm_lead_events_eventType_idx" ON "crm_lead_events"("eventType");

-- CreateIndex
CREATE INDEX "crm_lead_events_occurredAt_idx" ON "crm_lead_events"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "crm_capture_forms_publicKey_key" ON "crm_capture_forms"("publicKey");

-- CreateIndex
CREATE INDEX "crm_capture_forms_companyId_idx" ON "crm_capture_forms"("companyId");

-- CreateIndex
CREATE INDEX "crm_capture_forms_publicKey_idx" ON "crm_capture_forms"("publicKey");

-- CreateIndex
CREATE INDEX "crm_scoring_rules_companyId_idx" ON "crm_scoring_rules"("companyId");

-- CreateIndex
CREATE INDEX "crm_scoring_rules_category_idx" ON "crm_scoring_rules"("category");

-- CreateIndex
CREATE UNIQUE INDEX "crm_scoring_config_companyId_key" ON "crm_scoring_config"("companyId");

-- CreateIndex
CREATE INDEX "crm_pipeline_stages_companyId_idx" ON "crm_pipeline_stages"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "crm_pipeline_stages_companyId_code_key" ON "crm_pipeline_stages"("companyId", "code");

-- CreateIndex
CREATE INDEX "crm_assignment_rules_companyId_idx" ON "crm_assignment_rules"("companyId");

-- CreateIndex
CREATE INDEX "crm_assignment_rules_priority_idx" ON "crm_assignment_rules"("priority");

-- CreateIndex
CREATE INDEX "crm_deals_forecastCategory_idx" ON "crm_deals"("forecastCategory");

-- CreateIndex
CREATE INDEX "crm_deals_leadId_idx" ON "crm_deals"("leadId");

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_formId_fkey" FOREIGN KEY ("formId") REFERENCES "crm_capture_forms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_events" ADD CONSTRAINT "crm_lead_events_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_capture_forms" ADD CONSTRAINT "crm_capture_forms_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_scoring_rules" ADD CONSTRAINT "crm_scoring_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_scoring_config" ADD CONSTRAINT "crm_scoring_config_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_pipeline_stages" ADD CONSTRAINT "crm_pipeline_stages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_assignment_rules" ADD CONSTRAINT "crm_assignment_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
