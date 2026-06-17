CREATE TABLE "landing_category_cards" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "landing_category_cards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "landing_category_cards_organizationId_categoryId_key"
  ON "landing_category_cards"("organizationId", "categoryId");

CREATE INDEX "landing_category_cards_organizationId_idx"
  ON "landing_category_cards"("organizationId");

CREATE INDEX "landing_category_cards_categoryId_idx"
  ON "landing_category_cards"("categoryId");

ALTER TABLE "landing_category_cards"
  ADD CONSTRAINT "landing_category_cards_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "landing_category_cards"
  ADD CONSTRAINT "landing_category_cards_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
