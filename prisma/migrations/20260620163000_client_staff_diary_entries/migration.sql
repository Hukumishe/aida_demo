CREATE TABLE "client_staff_diary_entries" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "staffUserId" TEXT NOT NULL,
  "appointmentId" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_staff_diary_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_staff_diary_entries_clientId_staffUserId_createdAt_idx"
  ON "client_staff_diary_entries"("clientId", "staffUserId", "createdAt");

CREATE INDEX "client_staff_diary_entries_organizationId_clientId_idx"
  ON "client_staff_diary_entries"("organizationId", "clientId");

CREATE INDEX "client_staff_diary_entries_appointmentId_idx"
  ON "client_staff_diary_entries"("appointmentId");

ALTER TABLE "client_staff_diary_entries"
  ADD CONSTRAINT "client_staff_diary_entries_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_staff_diary_entries"
  ADD CONSTRAINT "client_staff_diary_entries_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_staff_diary_entries"
  ADD CONSTRAINT "client_staff_diary_entries_staffUserId_fkey"
  FOREIGN KEY ("staffUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_staff_diary_entries"
  ADD CONSTRAINT "client_staff_diary_entries_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
