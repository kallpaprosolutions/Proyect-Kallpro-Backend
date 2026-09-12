-- AlterTable
ALTER TABLE "document_messages" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'MESSAGE',
ADD COLUMN     "logField" TEXT,
ADD COLUMN     "logFrom" TEXT,
ADD COLUMN     "logTo" TEXT;

-- CreateTable
CREATE TABLE "document_followers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_followers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_followers_companyId_entityType_entityId_idx" ON "document_followers"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "document_followers_entityType_entityId_userId_key" ON "document_followers"("entityType", "entityId", "userId");

-- AddForeignKey
ALTER TABLE "document_followers" ADD CONSTRAINT "document_followers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_followers" ADD CONSTRAINT "document_followers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
