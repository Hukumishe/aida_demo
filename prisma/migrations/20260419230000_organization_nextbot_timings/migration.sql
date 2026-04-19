-- Тайминги Nextbot-потока оплаты — настраиваются владельцем из вкладки «Маркетинг».
-- Все три поля nullable; если null — код использует безопасные дефолты (30 / 2 / 12).

-- Ночной режим: сколько минут держим предварительную бронь до авто-отмены кроном
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "nightHoldMinutes" INTEGER;

-- Дневной путь request_manager_invoice: дедлайн задачи на выставление счёта Kaspi (часы)
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "dayInvoiceTaskDeadlineHours" INTEGER;

-- Ночной путь verify_receipt_nighttime: дедлайн утренней задачи на сверку чека (часы)
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "nightReceiptTaskDeadlineHours" INTEGER;
