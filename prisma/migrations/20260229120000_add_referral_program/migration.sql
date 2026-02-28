-- AlterTable clients: referral program
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "referredByClientId" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "referralFirstVisitBonusCredited" BOOLEAN NOT NULL DEFAULT false;

-- Unique referral code per studio (PostgreSQL allows multiple NULLs in UNIQUE)
ALTER TABLE "clients" ADD CONSTRAINT "clients_studioId_referralCode_key" UNIQUE ("studioId", "referralCode");

-- FK: who referred this client
ALTER TABLE "clients" ADD CONSTRAINT "clients_referredByClientId_fkey" FOREIGN KEY ("referredByClientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "clients_referredByClientId_idx" ON "clients"("referredByClientId");
