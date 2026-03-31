-- Маркетинговые реферальные ссылки филиала + поле источника у клиента
CREATE TABLE "studio_referral_links" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "cashbackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cashbackPercent" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastActivityAt" TIMESTAMP(3),
    "registrationsCount" INTEGER NOT NULL DEFAULT 0,
    "totalCashbackAccumulated" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_referral_links_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "studio_referral_links_studioId_idx" ON "studio_referral_links"("studioId");
CREATE INDEX "studio_referral_links_studioId_isActive_idx" ON "studio_referral_links"("studioId", "isActive");

ALTER TABLE "studio_referral_links" ADD CONSTRAINT "studio_referral_links_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clients" ADD COLUMN "registrationSource" TEXT;
ALTER TABLE "clients" ADD COLUMN "studioReferralLinkId" TEXT;

CREATE INDEX "clients_studioReferralLinkId_idx" ON "clients"("studioReferralLinkId");

ALTER TABLE "clients" ADD CONSTRAINT "clients_studioReferralLinkId_fkey" FOREIGN KEY ("studioReferralLinkId") REFERENCES "studio_referral_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
