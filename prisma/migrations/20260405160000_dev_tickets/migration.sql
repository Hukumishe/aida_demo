-- CreateEnum
CREATE TYPE "DevTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "dev_tickets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problemDescription" TEXT NOT NULL,
    "howItHappened" TEXT,
    "screenshotUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "DevTicketStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dev_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dev_ticket_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dev_ticket_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dev_tickets_organizationId_idx" ON "dev_tickets"("organizationId");
CREATE INDEX "dev_tickets_status_idx" ON "dev_tickets"("status");
CREATE INDEX "dev_tickets_createdAt_idx" ON "dev_tickets"("createdAt");
CREATE INDEX "dev_ticket_messages_ticketId_idx" ON "dev_ticket_messages"("ticketId");
CREATE INDEX "dev_ticket_messages_createdAt_idx" ON "dev_ticket_messages"("createdAt");

ALTER TABLE "dev_tickets" ADD CONSTRAINT "dev_tickets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dev_tickets" ADD CONSTRAINT "dev_tickets_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dev_tickets" ADD CONSTRAINT "dev_tickets_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dev_ticket_messages" ADD CONSTRAINT "dev_ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "dev_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dev_ticket_messages" ADD CONSTRAINT "dev_ticket_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
