-- CreateTable
CREATE TABLE "document_messages" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_messages_companyId_entityType_entityId_createdAt_idx" ON "document_messages"("companyId", "entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "document_messages" ADD CONSTRAINT "document_messages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_messages" ADD CONSTRAINT "document_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
