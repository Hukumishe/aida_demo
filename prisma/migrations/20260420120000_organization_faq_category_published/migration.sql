-- OrganizationFaq: add category (optional tag), isPublished (draft/public flag),
-- and composite indexes for typical queries (list by organization sorted, filter
-- by published). Idempotent so it can be re-run on partially-migrated DBs.

ALTER TABLE "organization_faqs"
  ADD COLUMN IF NOT EXISTS "category" TEXT;

ALTER TABLE "organization_faqs"
  ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT true;

-- Replace the single-column index with composite ones if they don't exist yet.
CREATE INDEX IF NOT EXISTS "organization_faqs_organizationId_sortOrder_idx"
  ON "organization_faqs" ("organizationId", "sortOrder");

CREATE INDEX IF NOT EXISTS "organization_faqs_organizationId_isPublished_idx"
  ON "organization_faqs" ("organizationId", "isPublished");

-- Drop legacy single-column index if it is still present (from 20260331190000_organization_layer).
DROP INDEX IF EXISTS "organization_faqs_organizationId_idx";
