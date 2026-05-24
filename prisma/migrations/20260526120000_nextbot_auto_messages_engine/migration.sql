-- CreateEnum
CREATE TYPE "NextbotAutoMessageTriggerType" AS ENUM ('BOOKING_CONFIRMED', 'REMINDER_BEFORE_VISIT', 'HOLD_EXPIRY_WARNING', 'FOLLOWUP_AFTER_VISIT', 'FEEDBACK_REQUEST');
CREATE TYPE "NextbotAutoMessageAnchor" AS ENUM ('NONE', 'APPOINTMENT_START', 'HOLD_EXPIRES_AT', 'VISIT_DONE_AT');
CREATE TYPE "NextbotAutoMessageDirection" AS ENUM ('BEFORE', 'AFTER');
CREATE TYPE "NextbotAutoMessageLogStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED', 'CANCELLED');

-- Organization outbound + feedback task
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "nextbotOutboundWebhookUrl" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "nextbotOutboundWebhookApiKey" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "feedbackLowRatingTaskTitle" TEXT;

-- Studio 2GIS
ALTER TABLE "studios" ADD COLUMN IF NOT EXISTS "feedbackTwoGisUrl" TEXT;

-- Appointment bookedAt
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "bookedAt" TIMESTAMP(3);

-- Migrate templates from legacy timing column if present
ALTER TABLE "nextbot_auto_message_templates" ADD COLUMN IF NOT EXISTS "triggerType" "NextbotAutoMessageTriggerType";
ALTER TABLE "nextbot_auto_message_templates" ADD COLUMN IF NOT EXISTS "anchor" "NextbotAutoMessageAnchor";
ALTER TABLE "nextbot_auto_message_templates" ADD COLUMN IF NOT EXISTS "direction" "NextbotAutoMessageDirection";
ALTER TABLE "nextbot_auto_message_templates" ADD COLUMN IF NOT EXISTS "minLeadDays" INTEGER;

UPDATE "nextbot_auto_message_templates"
SET
  "triggerType" = CASE
    WHEN "timing"::text = 'BEFORE_PROCEDURE' THEN 'REMINDER_BEFORE_VISIT'::"NextbotAutoMessageTriggerType"
    WHEN "timing"::text = 'AFTER_PROCEDURE' THEN 'FOLLOWUP_AFTER_VISIT'::"NextbotAutoMessageTriggerType"
    ELSE 'REMINDER_BEFORE_VISIT'::"NextbotAutoMessageTriggerType"
  END,
  "anchor" = CASE
    WHEN "timing"::text = 'BEFORE_PROCEDURE' THEN 'APPOINTMENT_START'::"NextbotAutoMessageAnchor"
    WHEN "timing"::text = 'AFTER_PROCEDURE' THEN 'VISIT_DONE_AT'::"NextbotAutoMessageAnchor"
    ELSE 'APPOINTMENT_START'::"NextbotAutoMessageAnchor"
  END,
  "direction" = CASE
    WHEN "timing"::text = 'BEFORE_PROCEDURE' THEN 'BEFORE'::"NextbotAutoMessageDirection"
    WHEN "timing"::text = 'AFTER_PROCEDURE' THEN 'AFTER'::"NextbotAutoMessageDirection"
    ELSE 'BEFORE'::"NextbotAutoMessageDirection"
  END
WHERE "triggerType" IS NULL;

ALTER TABLE "nextbot_auto_message_templates"
  ALTER COLUMN "triggerType" SET NOT NULL,
  ALTER COLUMN "anchor" SET NOT NULL,
  ALTER COLUMN "direction" SET NOT NULL;

ALTER TABLE "nextbot_auto_message_templates" ALTER COLUMN "serviceCategoryId" DROP NOT NULL;

ALTER TABLE "nextbot_auto_message_templates" DROP COLUMN IF EXISTS "timing";
DROP TYPE IF EXISTS "NextbotAutoMessageTiming";

DROP INDEX IF EXISTS "nextbot_auto_message_templates_studioId_serviceCategoryId_tim_idx";
CREATE INDEX "nextbot_auto_message_templates_studioId_triggerType_idx" ON "nextbot_auto_message_templates"("studioId", "triggerType");

-- Logs
CREATE TABLE "nextbot_auto_message_logs" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "NextbotAutoMessageLogStatus" NOT NULL DEFAULT 'PENDING',
    "renderedText" TEXT,
    "skipReason" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nextbot_auto_message_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nextbot_auto_message_logs_appointmentId_templateId_key" ON "nextbot_auto_message_logs"("appointmentId", "templateId");
CREATE INDEX "nextbot_auto_message_logs_status_scheduledAt_idx" ON "nextbot_auto_message_logs"("status", "scheduledAt");
CREATE INDEX "nextbot_auto_message_logs_clientId_idx" ON "nextbot_auto_message_logs"("clientId");

ALTER TABLE "nextbot_auto_message_logs" ADD CONSTRAINT "nextbot_auto_message_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "nextbot_auto_message_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nextbot_auto_message_logs" ADD CONSTRAINT "nextbot_auto_message_logs_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nextbot_auto_message_logs" ADD CONSTRAINT "nextbot_auto_message_logs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Feedback
CREATE TABLE "appointment_feedbacks" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "appointment_feedbacks_appointmentId_key" ON "appointment_feedbacks"("appointmentId");
CREATE INDEX "appointment_feedbacks_clientId_idx" ON "appointment_feedbacks"("clientId");

ALTER TABLE "appointment_feedbacks" ADD CONSTRAINT "appointment_feedbacks_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointment_feedbacks" ADD CONSTRAINT "appointment_feedbacks_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
