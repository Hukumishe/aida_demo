-- CreateEnum
CREATE TYPE "WaitlistEntryStatus" AS ENUM ('PENDING', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WaitlistEntrySource" AS ENUM ('LANDING', 'NEXTBOT', 'CRM');

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "requestedStartAt" TIMESTAMP(3) NOT NULL,
    "requestedEndAt" TIMESTAMP(3) NOT NULL,
    "status" "WaitlistEntryStatus" NOT NULL DEFAULT 'PENDING',
    "source" "WaitlistEntrySource" NOT NULL DEFAULT 'CRM',
    "notes" TEXT,
    "fulfilledAppointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_fulfilledAppointmentId_key" ON "waitlist_entries"("fulfilledAppointmentId");

-- CreateIndex
CREATE INDEX "waitlist_entries_studioId_status_idx" ON "waitlist_entries"("studioId", "status");

-- CreateIndex
CREATE INDEX "waitlist_entries_studioId_requestedStartAt_idx" ON "waitlist_entries"("studioId", "requestedStartAt");

-- CreateIndex
CREATE INDEX "waitlist_entries_organizationId_idx" ON "waitlist_entries"("organizationId");

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_fulfilledAppointmentId_fkey" FOREIGN KEY ("fulfilledAppointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
