-- CreateEnum
CREATE TYPE "ClientLevel" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'DIAMOND');

-- AlterTable Studio: global bonus payment limit
ALTER TABLE "studios" ADD COLUMN IF NOT EXISTS "globalBonusPaymentLimitPercent" INTEGER NOT NULL DEFAULT 30;

-- AlterTable Client: level, levelSetManually, totalPaidForLevel
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "level" "ClientLevel" NOT NULL DEFAULT 'BRONZE';
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "levelSetManually" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "totalPaidForLevel" INTEGER NOT NULL DEFAULT 0;

-- AlterTable Service: bonus accrual enabled
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "bonusAccrualEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable Appointment: completed bonuses and money paid
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "completedBonusesUsed" INTEGER;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "completedMoneyPaid" INTEGER;

-- CreateTable bonus_history
CREATE TABLE IF NOT EXISTS "bonus_history" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "appointmentId" TEXT,
    "performedByUserId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bonus_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bonus_history_clientId_idx" ON "bonus_history"("clientId");
CREATE INDEX IF NOT EXISTS "bonus_history_studioId_idx" ON "bonus_history"("studioId");
CREATE INDEX IF NOT EXISTS "bonus_history_createdAt_idx" ON "bonus_history"("createdAt");

ALTER TABLE "bonus_history" ADD CONSTRAINT "bonus_history_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bonus_history" ADD CONSTRAINT "bonus_history_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bonus_history" ADD CONSTRAINT "bonus_history_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
