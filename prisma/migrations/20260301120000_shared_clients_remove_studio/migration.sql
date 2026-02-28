-- Клиенты общие для всех салонов: убрать studioId, уникальность phone и referralCode глобально.

-- 1) Сделать studioId необязательным
ALTER TABLE "clients" ALTER COLUMN "studioId" DROP NOT NULL;

-- 2) Объединить дубликаты по phone: оставить одного клиента (min id), переназначить ссылки
-- Обновить appointments
UPDATE appointments a
SET "clientId" = sub.keep_id
FROM (
  SELECT c.id AS old_id, k.keep_id
  FROM clients c
  JOIN (SELECT phone, MIN(id) AS keep_id FROM clients GROUP BY phone HAVING COUNT(*) > 1) k ON c.phone = k.phone AND c.id <> k.keep_id
) sub
WHERE a."clientId" = sub.old_id;

-- Обновить no_show_incomes
UPDATE no_show_incomes n
SET "clientId" = sub.keep_id
FROM (
  SELECT c.id AS old_id, k.keep_id
  FROM clients c
  JOIN (SELECT phone, MIN(id) AS keep_id FROM clients GROUP BY phone HAVING COUNT(*) > 1) k ON c.phone = k.phone AND c.id <> k.keep_id
) sub
WHERE n."clientId" = sub.old_id;

-- Обновить bonus_history
UPDATE bonus_history b
SET "clientId" = sub.keep_id
FROM (
  SELECT c.id AS old_id, k.keep_id
  FROM clients c
  JOIN (SELECT phone, MIN(id) AS keep_id FROM clients GROUP BY phone HAVING COUNT(*) > 1) k ON c.phone = k.phone AND c.id <> k.keep_id
) sub
WHERE b."clientId" = sub.old_id;

-- Обновить blacklist_requests
UPDATE blacklist_requests br
SET "clientId" = sub.keep_id
FROM (
  SELECT c.id AS old_id, k.keep_id
  FROM clients c
  JOIN (SELECT phone, MIN(id) AS keep_id FROM clients GROUP BY phone HAVING COUNT(*) > 1) k ON c.phone = k.phone AND c.id <> k.keep_id
) sub
WHERE br."clientId" = sub.old_id;

-- Удалить дубликаты клиентов (оставить одного на phone)
DELETE FROM clients
WHERE id IN (
  SELECT c.id FROM clients c
  JOIN (SELECT phone, MIN(id) AS keep_id FROM clients GROUP BY phone HAVING COUNT(*) > 1) k ON c.phone = k.phone AND c.id <> k.keep_id
);

-- 3) Обнулить studioId у оставшихся
UPDATE clients SET "studioId" = NULL;

-- 4) Удалить старые ограничения и столбец
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_studioId_fkey";
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_studioId_phone_key";
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_studioId_referralCode_key";
DROP INDEX IF EXISTS "clients_studioId_idx";
DROP INDEX IF EXISTS "clients_studioId_isBlacklisted_idx";
ALTER TABLE "clients" DROP COLUMN "studioId";

-- 5) Убрать дубликаты referralCode (оставить один на код), затем добавить уникальность
UPDATE "clients" SET "referralCode" = NULL
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY "referralCode" ORDER BY id) AS rn
    FROM "clients" WHERE "referralCode" IS NOT NULL
  ) sub WHERE rn > 1
);

ALTER TABLE "clients" ADD CONSTRAINT "clients_phone_key" UNIQUE ("phone");
ALTER TABLE "clients" ADD CONSTRAINT "clients_referralCode_key" UNIQUE ("referralCode");
CREATE INDEX "clients_isBlacklisted_idx" ON "clients"("isBlacklisted");
