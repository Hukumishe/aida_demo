-- CreateEnum
CREATE TYPE "TargetPromoMechanicsType" AS ENUM ('INSTRUCTIONS_ONLY', 'DISCOUNT_PERCENT', 'BONUS_POINTS');

-- CreateTable
CREATE TABLE "target_promos" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "promoText" TEXT NOT NULL,
    "promoTextNormalized" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "mechanicsType" "TargetPromoMechanicsType" NOT NULL DEFAULT 'INSTRUCTIONS_ONLY',
    "discountPercent" INTEGER,
    "bonusPoints" INTEGER,
    "mechanicsNote" TEXT,
    "agentPrompt" TEXT NOT NULL,
    "maxActivations" INTEGER,
    "activationCount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "target_promos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "target_promo_activations" (
    "id" TEXT NOT NULL,
    "targetPromoId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "phone" TEXT,
    "dialogId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "target_promo_activations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "target_promos_organizationId_promoTextNormalized_key" ON "target_promos"("organizationId", "promoTextNormalized");

-- CreateIndex
CREATE INDEX "target_promos_organizationId_isActive_idx" ON "target_promos"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "target_promo_activations_targetPromoId_idx" ON "target_promo_activations"("targetPromoId");

-- CreateIndex
CREATE INDEX "target_promo_activations_organizationId_createdAt_idx" ON "target_promo_activations"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "target_promo_activations_clientId_idx" ON "target_promo_activations"("clientId");

-- AddForeignKey
ALTER TABLE "target_promos" ADD CONSTRAINT "target_promos_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_promo_activations" ADD CONSTRAINT "target_promo_activations_targetPromoId_fkey" FOREIGN KEY ("targetPromoId") REFERENCES "target_promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_promo_activations" ADD CONSTRAINT "target_promo_activations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
