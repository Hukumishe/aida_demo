-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ServiceAudience" AS ENUM ('MEN', 'WOMEN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "service_categories" (
  "id" TEXT NOT NULL,
  "studioId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_categories_studioId_name_key" ON "service_categories"("studioId", "name");
CREATE INDEX IF NOT EXISTS "service_categories_studioId_idx" ON "service_categories"("studioId");

ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable services
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "audience" "ServiceAudience" NOT NULL DEFAULT 'WOMEN';

CREATE INDEX IF NOT EXISTS "services_categoryId_idx" ON "services"("categoryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_categoryId_fkey'
  ) THEN
    ALTER TABLE "services"
      ADD CONSTRAINT "services_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
