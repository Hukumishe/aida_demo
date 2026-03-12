-- Enum for landing promotion type
CREATE TYPE "LandingPromotionType" AS ENUM ('DISCOUNT', 'ONE_PLUS_ONE');

-- Landing promotions
CREATE TABLE "landing_promotions" (
  "id" TEXT NOT NULL,
  "studioId" TEXT NOT NULL,
  "type" "LandingPromotionType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "discountPercent" INTEGER,
  "serviceIdA" TEXT,
  "serviceIdB" TEXT,
  "bundlePrice" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "landing_promotions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "landing_promotions_studioId_idx"
  ON "landing_promotions"("studioId");

ALTER TABLE "landing_promotions"
  ADD CONSTRAINT "landing_promotions_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Landing promotion services (for DISCOUNT type)
CREATE TABLE "landing_promotion_services" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  CONSTRAINT "landing_promotion_services_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "landing_promotion_services_promotionId_idx"
  ON "landing_promotion_services"("promotionId");

CREATE INDEX "landing_promotion_services_serviceId_idx"
  ON "landing_promotion_services"("serviceId");

ALTER TABLE "landing_promotion_services"
  ADD CONSTRAINT "landing_promotion_services_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "landing_promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "landing_promotion_services"
  ADD CONSTRAINT "landing_promotion_services_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Landing promotion codes
CREATE TABLE "landing_promotion_codes" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "usageLimit" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "landing_promotion_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "landing_promotion_codes_code_key"
  ON "landing_promotion_codes"("code");

CREATE INDEX "landing_promotion_codes_promotionId_idx"
  ON "landing_promotion_codes"("promotionId");

ALTER TABLE "landing_promotion_codes"
  ADD CONSTRAINT "landing_promotion_codes_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "landing_promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Landing masters
CREATE TABLE "landing_masters" (
  "id" TEXT NOT NULL,
  "studioId" TEXT NOT NULL,
  "staffUserId" TEXT NOT NULL,
  "isVisible" BOOLEAN NOT NULL DEFAULT TRUE,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "landing_masters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "landing_masters_studioId_staffUserId_key"
  ON "landing_masters"("studioId", "staffUserId");

CREATE INDEX "landing_masters_studioId_idx"
  ON "landing_masters"("studioId");

CREATE INDEX "landing_masters_staffUserId_idx"
  ON "landing_masters"("staffUserId");

ALTER TABLE "landing_masters"
  ADD CONSTRAINT "landing_masters_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "landing_masters"
  ADD CONSTRAINT "landing_masters_staffUserId_fkey"
  FOREIGN KEY ("staffUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Landing service cards
CREATE TABLE "landing_service_cards" (
  "id" TEXT NOT NULL,
  "studioId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "imageUrl" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "landing_service_cards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "landing_service_cards_studioId_serviceId_key"
  ON "landing_service_cards"("studioId", "serviceId");

CREATE INDEX "landing_service_cards_studioId_idx"
  ON "landing_service_cards"("studioId");

CREATE INDEX "landing_service_cards_serviceId_idx"
  ON "landing_service_cards"("serviceId");

ALTER TABLE "landing_service_cards"
  ADD CONSTRAINT "landing_service_cards_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "landing_service_cards"
  ADD CONSTRAINT "landing_service_cards_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

