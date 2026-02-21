-- AlterEnum
-- Add BLACKLIST_REQUEST to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BLACKLIST_REQUEST';

-- AlterTable
-- Add isBlacklisted field to clients table
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "isBlacklisted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "clients_studioId_isBlacklisted_idx" ON "clients"("studioId", "isBlacklisted");

-- CreateTable
CREATE TABLE IF NOT EXISTS "blacklist_requests" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),

    CONSTRAINT "blacklist_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "blacklist_requests_studioId_idx" ON "blacklist_requests"("studioId");
CREATE INDEX IF NOT EXISTS "blacklist_requests_clientId_idx" ON "blacklist_requests"("clientId");
CREATE INDEX IF NOT EXISTS "blacklist_requests_status_idx" ON "blacklist_requests"("status");
CREATE INDEX IF NOT EXISTS "blacklist_requests_requestedByUserId_idx" ON "blacklist_requests"("requestedByUserId");
CREATE INDEX IF NOT EXISTS "blacklist_requests_studioId_status_idx" ON "blacklist_requests"("studioId", "status");

-- AddForeignKey
ALTER TABLE "blacklist_requests" ADD CONSTRAINT "blacklist_requests_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blacklist_requests" ADD CONSTRAINT "blacklist_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blacklist_requests" ADD CONSTRAINT "blacklist_requests_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blacklist_requests" ADD CONSTRAINT "blacklist_requests_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


