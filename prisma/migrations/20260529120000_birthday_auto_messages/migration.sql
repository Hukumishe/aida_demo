-- CreateEnum
CREATE TYPE "BirthdayBonusType" AS ENUM ('BONUS_POINTS', 'DISCOUNT_PERCENT');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN "discountExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "studio_birthday_message_settings" (
    "studioId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "minClientLevel" "ClientLevel" NOT NULL DEFAULT 'BRONZE',
    "daysBeforeBirthday" INTEGER NOT NULL DEFAULT 3,
    "bonusType" "BirthdayBonusType" NOT NULL,
    "bonusValue" INTEGER NOT NULL,
    "discountValidDays" INTEGER,
    "messageText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_birthday_message_settings_pkey" PRIMARY KEY ("studioId")
);

-- CreateTable
CREATE TABLE "nextbot_birthday_message_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "congratulationYear" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "NextbotAutoMessageLogStatus" NOT NULL DEFAULT 'PENDING',
    "renderedText" TEXT,
    "skipReason" TEXT,
    "error" TEXT,
    "bonusApplied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nextbot_birthday_message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nextbot_birthday_message_logs_organizationId_clientId_congratulationYear_key" ON "nextbot_birthday_message_logs"("organizationId", "clientId", "congratulationYear");

-- CreateIndex
CREATE INDEX "nextbot_birthday_message_logs_status_scheduledAt_idx" ON "nextbot_birthday_message_logs"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "nextbot_birthday_message_logs_studioId_idx" ON "nextbot_birthday_message_logs"("studioId");

-- AddForeignKey
ALTER TABLE "studio_birthday_message_settings" ADD CONSTRAINT "studio_birthday_message_settings_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nextbot_birthday_message_logs" ADD CONSTRAINT "nextbot_birthday_message_logs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
