-- Режим лояльности студии + кастомные уровни, вехи и учёт по клиент×студия
CREATE TYPE "StudioLoyaltyMode" AS ENUM ('PRESET', 'CUSTOM');

ALTER TABLE "studios" ADD COLUMN "loyaltyMode" "StudioLoyaltyMode" NOT NULL DEFAULT 'PRESET';

CREATE TABLE "studio_loyalty_tiers" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "cashbackPercent" INTEGER NOT NULL,
    "manualOnly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "studio_loyalty_tiers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "studio_loyalty_tiers_studioId_sortOrder_key" ON "studio_loyalty_tiers"("studioId", "sortOrder");
CREATE INDEX "studio_loyalty_tiers_studioId_idx" ON "studio_loyalty_tiers"("studioId");

ALTER TABLE "studio_loyalty_tiers" ADD CONSTRAINT "studio_loyalty_tiers_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "studio_loyalty_milestones" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "minTotalPaid" INTEGER NOT NULL,
    "targetSortOrder" INTEGER NOT NULL,

    CONSTRAINT "studio_loyalty_milestones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "studio_loyalty_milestones_studioId_idx" ON "studio_loyalty_milestones"("studioId");

ALTER TABLE "studio_loyalty_milestones" ADD CONSTRAINT "studio_loyalty_milestones_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "client_studio_loyalties" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "currentTierId" TEXT,
    "totalPaid" INTEGER NOT NULL DEFAULT 0,
    "levelSetManually" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "client_studio_loyalties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_studio_loyalties_clientId_studioId_key" ON "client_studio_loyalties"("clientId", "studioId");
CREATE INDEX "client_studio_loyalties_studioId_idx" ON "client_studio_loyalties"("studioId");

ALTER TABLE "client_studio_loyalties" ADD CONSTRAINT "client_studio_loyalties_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_studio_loyalties" ADD CONSTRAINT "client_studio_loyalties_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_studio_loyalties" ADD CONSTRAINT "client_studio_loyalties_currentTierId_fkey" FOREIGN KEY ("currentTierId") REFERENCES "studio_loyalty_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
