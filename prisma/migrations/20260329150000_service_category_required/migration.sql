-- Услуга всегда принадлежит категории: backfill + NOT NULL + ON DELETE RESTRICT

-- 1) По одной категории «Прочее» на студию, где есть услуги без категории
INSERT INTO "service_categories" ("id", "studioId", "name", "sortOrder", "createdAt", "updatedAt")
SELECT
  'sca_' || substr(md5(d."studioId" || 'cat'), 1, 10),
  d."studioId",
  'Прочее',
  999,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "studioId" FROM "services" WHERE "categoryId" IS NULL) d
WHERE NOT EXISTS (
  SELECT 1 FROM "service_categories" c
  WHERE c."studioId" = d."studioId" AND c."name" = 'Прочее'
);

-- 2) Привязать услуги без категории
UPDATE "services" AS s
SET "categoryId" = c."id"
FROM "service_categories" AS c
WHERE s."categoryId" IS NULL
  AND c."studioId" = s."studioId"
  AND c."name" = 'Прочее';

-- 3) FK и NOT NULL
ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "services_categoryId_fkey";

ALTER TABLE "services" ALTER COLUMN "categoryId" SET NOT NULL;

ALTER TABLE "services" ADD CONSTRAINT "services_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
