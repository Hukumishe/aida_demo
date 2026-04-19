-- Repair-миграция: приводит схему organizations/appointments к актуальному состоянию
-- для Nextbot-потока оплаты. Идемпотентна — безопасно запускать поверх любой версии.
--
-- Причина: миграция 20260419140000_appointment_hold_and_payment_night изначально
-- создала колонки paymentNightStartHour/EndHour, затем файл был переписан и стал
-- создавать уже marketingHoursStartHour/EndHour. На БД, где первая версия миграции
-- успела примениться, Prisma считает миграцию выполненной и повторно её не запустит,
-- поэтому нужные колонки отсутствуют. Ниже — переименование/создание через IF NOT EXISTS.

-- 1) Новые статусы записи для Nextbot-потока (идемпотентно через IF NOT EXISTS)
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'TENTATIVE';
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'PENDING_CONFIRMATION';

-- 2) Таймер удержания предварительной брони
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "holdExpiresAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "appointments_hold_expires_idx"
  ON "appointments" ("holdExpiresAt")
  WHERE "holdExpiresAt" IS NOT NULL;

-- 3) Рабочие часы отдела маркетинга: если на БД есть устаревшие paymentNight* — переименовать,
--    иначе создать новые колонки с нуля.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations'
      AND column_name = 'paymentNightStartHour'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations'
      AND column_name = 'marketingHoursStartHour'
  ) THEN
    ALTER TABLE "organizations"
      RENAME COLUMN "paymentNightStartHour" TO "marketingHoursStartHour";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations'
      AND column_name = 'paymentNightEndHour'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations'
      AND column_name = 'marketingHoursEndHour'
  ) THEN
    ALTER TABLE "organizations"
      RENAME COLUMN "paymentNightEndHour" TO "marketingHoursEndHour";
  END IF;
END $$;

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "marketingHoursStartHour" INTEGER;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "marketingHoursEndHour"   INTEGER;

-- 4) Статичные реквизиты Kaspi (ночной промпт)
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "paymentKaspiPhone"      TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "paymentKaspiCardHolder" TEXT;

-- 5) Тайминги Nextbot-потока (на случай если миграция 20260419230000 тоже не доехала)
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "nightHoldMinutes"               INTEGER;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "dayInvoiceTaskDeadlineHours"    INTEGER;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "nightReceiptTaskDeadlineHours"  INTEGER;
