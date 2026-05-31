-- История действий по записи (журнал изменений для UI «История»)

CREATE TYPE "AppointmentHistoryAction" AS ENUM (
  'CREATED',
  'UPDATED',
  'STATUS_CHANGED',
  'RESCHEDULED',
  'PREPAYMENT_CHANGED',
  'COMMENT_CHANGED',
  'CLIENT_ARRIVED',
  'VISIT_COMPLETED',
  'NO_SHOW',
  'LATE_PENALTY',
  'CANCELLED',
  'UPSELL_ADDED',
  'UPSELL_UPDATED',
  'UPSELL_REMOVED'
);

CREATE TABLE "appointment_history_entries" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT,
  "studioId" TEXT NOT NULL,
  "action" "AppointmentHistoryAction" NOT NULL,
  "summary" TEXT NOT NULL,
  "payload" JSONB,
  "actorUserId" TEXT,
  "actorLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "appointment_history_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "appointment_history_entries_appointmentId_createdAt_idx"
  ON "appointment_history_entries"("appointmentId", "createdAt");

CREATE INDEX "appointment_history_entries_studioId_createdAt_idx"
  ON "appointment_history_entries"("studioId", "createdAt");

ALTER TABLE "appointment_history_entries"
  ADD CONSTRAINT "appointment_history_entries_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "appointment_history_entries"
  ADD CONSTRAINT "appointment_history_entries_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
