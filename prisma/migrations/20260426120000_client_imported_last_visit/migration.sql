-- Дата «последний визит» при переносе из внешней базы (карточка клиента + импорт).
ALTER TABLE "clients" ADD COLUMN "importedLastVisitAt" DATE;
