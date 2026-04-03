-- Organization layer: tenants, org-scoped catalog/CRM/marketing/warehouse/tasks, studios under org.

-- 1) organizations + default row (наследуем маркетинг/лояльность с первой студии по дате)
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "globalBonusPaymentLimitPercent" INTEGER NOT NULL DEFAULT 30,
    "referFriendEnabled" BOOLEAN NOT NULL DEFAULT false,
    "referFriendInviteeRewardType" "ReferFriendInviteeRewardType",
    "referFriendInviteeValue" INTEGER,
    "referFriendReferrerRewardType" "ReferFriendReferrerRewardType",
    "referFriendReferrerValue" INTEGER,
    "loyaltyMode" "StudioLoyaltyMode" NOT NULL DEFAULT 'PRESET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

INSERT INTO "organizations" (
    "id",
    "name",
    "slug",
    "globalBonusPaymentLimitPercent",
    "referFriendEnabled",
    "referFriendInviteeRewardType",
    "referFriendInviteeValue",
    "referFriendReferrerRewardType",
    "referFriendReferrerValue",
    "loyaltyMode",
    "createdAt",
    "updatedAt"
)
SELECT
    'org_23456789ab',
    s."name",
    NULL,
    s."globalBonusPaymentLimitPercent",
    s."referFriendEnabled",
    s."referFriendInviteeRewardType",
    s."referFriendInviteeValue",
    s."referFriendReferrerRewardType",
    s."referFriendReferrerValue",
    s."loyaltyMode",
    s."createdAt",
    s."updatedAt"
FROM "studios" s
ORDER BY s."createdAt" ASC
LIMIT 1;

-- 2) studios: привязка к организации, убрать поля на уровень organizations
ALTER TABLE "studios" ADD COLUMN "organizationId" TEXT;

UPDATE "studios" SET "organizationId" = 'org_23456789ab';

ALTER TABLE "studios" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "studios" ADD CONSTRAINT "studios_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "studios_organizationId_idx" ON "studios"("organizationId");

ALTER TABLE "studios" DROP COLUMN IF EXISTS "globalBonusPaymentLimitPercent";
ALTER TABLE "studios" DROP COLUMN IF EXISTS "referFriendEnabled";
ALTER TABLE "studios" DROP COLUMN IF EXISTS "referFriendInviteeRewardType";
ALTER TABLE "studios" DROP COLUMN IF EXISTS "referFriendInviteeValue";
ALTER TABLE "studios" DROP COLUMN IF EXISTS "referFriendReferrerRewardType";
ALTER TABLE "studios" DROP COLUMN IF EXISTS "referFriendReferrerValue";
ALTER TABLE "studios" DROP COLUMN IF EXISTS "loyaltyMode";

-- 3) users: organizationId
ALTER TABLE "users" ADD COLUMN "organizationId" TEXT;

UPDATE "users" u
SET "organizationId" = s."organizationId"
FROM "studios" s
WHERE s."id" = u."studioId";

UPDATE "users"
SET "organizationId" = 'org_23456789ab'
WHERE "organizationId" IS NULL;

ALTER TABLE "users" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- 4) clients: organizationId + составные уникальные индексы
ALTER TABLE "clients" ADD COLUMN "organizationId" TEXT;

UPDATE "clients" SET "organizationId" = 'org_23456789ab';

ALTER TABLE "clients" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_phone_key";
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_referralCode_key";

ALTER TABLE "clients" ADD CONSTRAINT "clients_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "clients_organizationId_phone_key" ON "clients"("organizationId", "phone");
CREATE UNIQUE INDEX "clients_organizationId_referralCode_key" ON "clients"("organizationId", "referralCode");

CREATE INDEX "clients_organizationId_idx" ON "clients"("organizationId");

-- 5) prompts
ALTER TABLE "prompts" ADD COLUMN "organizationId" TEXT;

ALTER TABLE "prompts" ADD CONSTRAINT "prompts_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "prompts_organizationId_idx" ON "prompts"("organizationId");

-- 6) service_categories
ALTER TABLE "service_categories" ADD COLUMN "organizationId" TEXT;

UPDATE "service_categories" sc
SET "organizationId" = s."organizationId"
FROM "studios" s
WHERE s."id" = sc."studioId";

ALTER TABLE "service_categories" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "service_categories" DROP CONSTRAINT IF EXISTS "service_categories_studioId_fkey";
ALTER TABLE "service_categories" DROP CONSTRAINT IF EXISTS "service_categories_studioId_name_key";

ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "service_categories_organizationId_name_key" ON "service_categories"("organizationId", "name");
CREATE INDEX "service_categories_organizationId_idx" ON "service_categories"("organizationId");

ALTER TABLE "service_categories" DROP COLUMN "studioId";

-- 7) services
ALTER TABLE "services" ADD COLUMN "organizationId" TEXT;

UPDATE "services" srv
SET "organizationId" = s."organizationId"
FROM "studios" s
WHERE s."id" = srv."studioId";

ALTER TABLE "services" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "services_studioId_fkey";

ALTER TABLE "services" ADD CONSTRAINT "services_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "services_organizationId_idx" ON "services"("organizationId");

ALTER TABLE "services" DROP COLUMN "studioId";

-- 8) landing
ALTER TABLE "landing_promotions" ADD COLUMN "organizationId" TEXT;

UPDATE "landing_promotions" lp
SET "organizationId" = s."organizationId"
FROM "studios" s
WHERE s."id" = lp."studioId";

ALTER TABLE "landing_promotions" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "landing_promotions" DROP CONSTRAINT IF EXISTS "landing_promotions_studioId_fkey";

ALTER TABLE "landing_promotions" ADD CONSTRAINT "landing_promotions_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "landing_promotions_organizationId_idx" ON "landing_promotions"("organizationId");

ALTER TABLE "landing_promotions" DROP COLUMN "studioId";

ALTER TABLE "landing_masters" ADD COLUMN "organizationId" TEXT;

UPDATE "landing_masters" lm
SET "organizationId" = s."organizationId"
FROM "studios" s
WHERE s."id" = lm."studioId";

ALTER TABLE "landing_masters" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "landing_masters" DROP CONSTRAINT IF EXISTS "landing_masters_studioId_fkey";
ALTER TABLE "landing_masters" DROP CONSTRAINT IF EXISTS "landing_masters_studioId_staffUserId_key";

ALTER TABLE "landing_masters" ADD CONSTRAINT "landing_masters_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "landing_masters_organizationId_staffUserId_key" ON "landing_masters"("organizationId", "staffUserId");
CREATE INDEX "landing_masters_organizationId_idx" ON "landing_masters"("organizationId");

ALTER TABLE "landing_masters" DROP COLUMN "studioId";

ALTER TABLE "landing_service_cards" ADD COLUMN "organizationId" TEXT;

UPDATE "landing_service_cards" lsc
SET "organizationId" = s."organizationId"
FROM "studios" s
WHERE s."id" = lsc."studioId";

ALTER TABLE "landing_service_cards" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "landing_service_cards" DROP CONSTRAINT IF EXISTS "landing_service_cards_studioId_fkey";
ALTER TABLE "landing_service_cards" DROP CONSTRAINT IF EXISTS "landing_service_cards_studioId_serviceId_key";

ALTER TABLE "landing_service_cards" ADD CONSTRAINT "landing_service_cards_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "landing_service_cards_organizationId_serviceId_key" ON "landing_service_cards"("organizationId", "serviceId");
CREATE INDEX "landing_service_cards_organizationId_idx" ON "landing_service_cards"("organizationId");

ALTER TABLE "landing_service_cards" DROP COLUMN "studioId";

-- 9) referral links
ALTER TABLE "studio_referral_links" ADD COLUMN "organizationId" TEXT;

UPDATE "studio_referral_links" r
SET "organizationId" = s."organizationId"
FROM "studios" s
WHERE s."id" = r."studioId";

ALTER TABLE "studio_referral_links" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "studio_referral_links" DROP CONSTRAINT IF EXISTS "studio_referral_links_studioId_fkey";

ALTER TABLE "studio_referral_links" ADD CONSTRAINT "studio_referral_links_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "studio_referral_links_organizationId_idx" ON "studio_referral_links"("organizationId");
CREATE INDEX "studio_referral_links_organizationId_isActive_idx" ON "studio_referral_links"("organizationId", "isActive");

ALTER TABLE "studio_referral_links" DROP COLUMN "studioId";

-- 10) studio_tasks
ALTER TABLE "studio_tasks" ADD COLUMN "organizationId" TEXT;

UPDATE "studio_tasks" t
SET "organizationId" = s."organizationId"
FROM "studios" s
WHERE s."id" = t."studioId";

ALTER TABLE "studio_tasks" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "studio_tasks" DROP CONSTRAINT IF EXISTS "studio_tasks_studioId_fkey";

ALTER TABLE "studio_tasks" ADD CONSTRAINT "studio_tasks_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "studio_tasks_organizationId_idx" ON "studio_tasks"("organizationId");
CREATE INDEX "studio_tasks_organizationId_status_idx" ON "studio_tasks"("organizationId", "status");

ALTER TABLE "studio_tasks" DROP COLUMN "studioId";

-- 11) blacklist_requests
ALTER TABLE "blacklist_requests" ADD COLUMN "organizationId" TEXT;

UPDATE "blacklist_requests" b
SET "organizationId" = s."organizationId"
FROM "studios" s
WHERE s."id" = b."studioId";

ALTER TABLE "blacklist_requests" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "blacklist_requests" DROP CONSTRAINT IF EXISTS "blacklist_requests_studioId_fkey";

ALTER TABLE "blacklist_requests" ADD CONSTRAINT "blacklist_requests_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "blacklist_requests_organizationId_idx" ON "blacklist_requests"("organizationId");
CREATE INDEX "blacklist_requests_organizationId_status_idx" ON "blacklist_requests"("organizationId", "status");

ALTER TABLE "blacklist_requests" DROP COLUMN "studioId";

-- 12) bonus_history
ALTER TABLE "bonus_history" ADD COLUMN "organizationId" TEXT;

UPDATE "bonus_history" bh
SET "organizationId" = s."organizationId"
FROM "studios" s
WHERE s."id" = bh."studioId";

ALTER TABLE "bonus_history" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "bonus_history" DROP CONSTRAINT IF EXISTS "bonus_history_studioId_fkey";

ALTER TABLE "bonus_history" ADD CONSTRAINT "bonus_history_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "bonus_history_organizationId_idx" ON "bonus_history"("organizationId");

ALTER TABLE "bonus_history" DROP COLUMN "studioId";

-- 13) loyalty: при нескольких филиалах оставляем данные только с «первой» студии (по createdAt), иначе конфликт уникальности по организации
DELETE FROM "studio_loyalty_tiers"
WHERE "studioId" IS DISTINCT FROM (SELECT "id" FROM "studios" ORDER BY "createdAt" ASC LIMIT 1);

DELETE FROM "studio_loyalty_milestones"
WHERE "studioId" IS DISTINCT FROM (SELECT "id" FROM "studios" ORDER BY "createdAt" ASC LIMIT 1);

DELETE FROM "client_studio_loyalties"
WHERE "studioId" IS DISTINCT FROM (SELECT "id" FROM "studios" ORDER BY "createdAt" ASC LIMIT 1);

-- loyalty tables: studioId -> organizationId
ALTER TABLE "studio_loyalty_tiers" ADD COLUMN "organizationId" TEXT;

UPDATE "studio_loyalty_tiers" lt
SET "organizationId" = s."organizationId"
FROM "studios" s
WHERE s."id" = lt."studioId";

ALTER TABLE "studio_loyalty_tiers" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "studio_loyalty_tiers" DROP CONSTRAINT IF EXISTS "studio_loyalty_tiers_studioId_fkey";
ALTER TABLE "studio_loyalty_tiers" DROP CONSTRAINT IF EXISTS "studio_loyalty_tiers_studioId_sortOrder_key";

ALTER TABLE "studio_loyalty_tiers" ADD CONSTRAINT "studio_loyalty_tiers_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "studio_loyalty_tiers_organizationId_sortOrder_key" ON "studio_loyalty_tiers"("organizationId", "sortOrder");
CREATE INDEX "studio_loyalty_tiers_organizationId_idx" ON "studio_loyalty_tiers"("organizationId");

ALTER TABLE "studio_loyalty_tiers" DROP COLUMN "studioId";

ALTER TABLE "studio_loyalty_milestones" ADD COLUMN "organizationId" TEXT;

UPDATE "studio_loyalty_milestones" m
SET "organizationId" = s."organizationId"
FROM "studios" s
WHERE s."id" = m."studioId";

ALTER TABLE "studio_loyalty_milestones" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "studio_loyalty_milestones" DROP CONSTRAINT IF EXISTS "studio_loyalty_milestones_studioId_fkey";

ALTER TABLE "studio_loyalty_milestones" ADD CONSTRAINT "studio_loyalty_milestones_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "studio_loyalty_milestones_organizationId_idx" ON "studio_loyalty_milestones"("organizationId");

ALTER TABLE "studio_loyalty_milestones" DROP COLUMN "studioId";

ALTER TABLE "client_studio_loyalties" ADD COLUMN "organizationId" TEXT;

UPDATE "client_studio_loyalties" c
SET "organizationId" = s."organizationId"
FROM "studios" s
WHERE s."id" = c."studioId";

ALTER TABLE "client_studio_loyalties" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "client_studio_loyalties" DROP CONSTRAINT IF EXISTS "client_studio_loyalties_studioId_fkey";
ALTER TABLE "client_studio_loyalties" DROP CONSTRAINT IF EXISTS "client_studio_loyalties_clientId_studioId_key";

ALTER TABLE "client_studio_loyalties" ADD CONSTRAINT "client_studio_loyalties_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "client_studio_loyalties_clientId_organizationId_key" ON "client_studio_loyalties"("clientId", "organizationId");
CREATE INDEX "client_studio_loyalties_organizationId_idx" ON "client_studio_loyalties"("organizationId");

ALTER TABLE "client_studio_loyalties" DROP COLUMN "studioId";

-- 14) warehouses + products
ALTER TABLE "warehouses" ADD COLUMN "organizationId" TEXT;

UPDATE "warehouses" w
SET "organizationId" = s."organizationId"
FROM "studios" s
WHERE w."studioId" IS NOT NULL AND s."id" = w."studioId";

UPDATE "warehouses"
SET "organizationId" = 'org_23456789ab'
WHERE "organizationId" IS NULL;

ALTER TABLE "warehouses" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "warehouses_organizationId_idx" ON "warehouses"("organizationId");

CREATE UNIQUE INDEX "warehouses_one_central_per_org" ON "warehouses"("organizationId")
  WHERE "type" = 'CENTRAL';

ALTER TABLE "products" ADD COLUMN "organizationId" TEXT;

UPDATE "products" SET "organizationId" = 'org_23456789ab';

ALTER TABLE "products" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "products" ADD CONSTRAINT "products_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "products_organizationId_idx" ON "products"("organizationId");

-- 15) logs
ALTER TABLE "logs" ADD COLUMN "organizationId" TEXT;

UPDATE "logs" l
SET "organizationId" = s."organizationId"
FROM "studios" s
WHERE l."studioId" IS NOT NULL AND s."id" = l."studioId";

CREATE INDEX "logs_organizationId_idx" ON "logs"("organizationId");

-- 16) notifications: organizationId + studioId опционален
ALTER TABLE "notifications" ADD COLUMN "organizationId" TEXT;

UPDATE "notifications" n
SET "organizationId" = s."organizationId"
FROM "studios" s
WHERE s."id" = n."studioId";

ALTER TABLE "notifications" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_studioId_fkey";

ALTER TABLE "notifications" ALTER COLUMN "studioId" DROP NOT NULL;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "notifications_organizationId_createdAt_idx" ON "notifications"("organizationId", "createdAt");

-- 17) FAQ
CREATE TABLE "organization_faqs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organization_faqs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "organization_faqs_organizationId_idx" ON "organization_faqs"("organizationId");

ALTER TABLE "organization_faqs" ADD CONSTRAINT "organization_faqs_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
