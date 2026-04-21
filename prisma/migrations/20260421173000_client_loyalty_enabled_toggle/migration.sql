-- Per-client loyalty toggle:
-- false = no loyalty program effects for this client
-- (no bonus spending, no cashback accrual, no referral loyalty bonuses).

ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT true;
