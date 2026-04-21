-- Add service subcategories inside existing service categories.
-- Allows frontend users to split categories into logical groups
-- like "Shugaring women 1/2/TOP".

CREATE TABLE IF NOT EXISTS "service_subcategories" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_subcategories_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_subcategories_categoryId_fkey'
  ) THEN
    ALTER TABLE "service_subcategories"
      ADD CONSTRAINT "service_subcategories_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "service_subcategories_categoryId_name_key"
  ON "service_subcategories" ("categoryId", "name");

CREATE INDEX IF NOT EXISTS "service_subcategories_categoryId_sortOrder_idx"
  ON "service_subcategories" ("categoryId", "sortOrder");

ALTER TABLE "services"
  ADD COLUMN IF NOT EXISTS "subcategoryId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'services_subcategoryId_fkey'
  ) THEN
    ALTER TABLE "services"
      ADD CONSTRAINT "services_subcategoryId_fkey"
      FOREIGN KEY ("subcategoryId") REFERENCES "service_subcategories"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "services_subcategoryId_idx"
  ON "services" ("subcategoryId");