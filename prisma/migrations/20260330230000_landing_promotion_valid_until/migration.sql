-- Срок действия акции на лендинге (опционально)
ALTER TABLE "landing_promotions" ADD COLUMN "validUntil" TIMESTAMP(3);
