-- AppointmentStatus: ожидание предоплаты
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'AWAITING_PREPAYMENT';

-- Автосообщение по смене статуса
ALTER TYPE "NextbotAutoMessageTriggerType" ADD VALUE IF NOT EXISTS 'STATUS_CHANGED';

ALTER TABLE "nextbot_auto_message_templates" ADD COLUMN IF NOT EXISTS "triggerOnStatus" "AppointmentStatus";
