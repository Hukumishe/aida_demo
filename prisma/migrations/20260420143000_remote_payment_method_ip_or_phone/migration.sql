-- Remote payment method for nighttime flow:
-- 1) transfer by phone (Kaspi phone + holder)
-- 2) payment to IP by custom requisites text.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RemotePaymentMethod') THEN
    CREATE TYPE "RemotePaymentMethod" AS ENUM ('PHONE_TRANSFER', 'IP_ACCOUNT');
  END IF;
END $$;

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "remotePaymentMethod" "RemotePaymentMethod" NOT NULL DEFAULT 'PHONE_TRANSFER';

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "paymentIpRequisites" TEXT;