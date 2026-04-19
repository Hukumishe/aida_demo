-- Новые статусы записи для Nextbot-потока оплаты
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'TENTATIVE';
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'PENDING_CONFIRMATION';

-- Таймер удержания предварительной брони (TENTATIVE) — 30 минут ночного пути оплаты
ALTER TABLE "appointments"
  ADD COLUMN IF NOT EXISTS "holdExpiresAt" TIMESTAMP(3);

-- Рабочие часы ОТДЕЛА МАРКЕТИНГА и статичные реквизиты Kaspi для ночного пути Nextbot.
-- Интервал [marketingHoursStartHour, marketingHoursEndHour) в локальной таймзоне студии = ДЕНЬ
-- (задача маркетинг-менеджеру на выставление счёта Kaspi),
-- вне интервала = НОЧЬ (авто-реквизиты Kaspi + 30-мин таймер удержания брони).
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "marketingHoursStartHour" INTEGER,
  ADD COLUMN IF NOT EXISTS "marketingHoursEndHour"   INTEGER,
  ADD COLUMN IF NOT EXISTS "paymentKaspiPhone"       TEXT,
  ADD COLUMN IF NOT EXISTS "paymentKaspiCardHolder"  TEXT;

-- Индекс для быстрой выборки просроченных предварительных броней кроном
CREATE INDEX IF NOT EXISTS "appointments_hold_expires_idx"
  ON "appointments" ("holdExpiresAt")
  WHERE "holdExpiresAt" IS NOT NULL;
