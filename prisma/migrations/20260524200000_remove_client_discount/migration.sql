-- Birthday: скидка % больше не поддерживается — переводим в бонусные баллы
UPDATE "studio_birthday_message_settings"
SET "bonusType" = 'BONUS_POINTS'
WHERE "bonusType" = 'DISCOUNT_PERCENT';

ALTER TABLE "studio_birthday_message_settings" DROP COLUMN IF EXISTS "discountValidDays";

ALTER TYPE "BirthdayBonusType" RENAME TO "BirthdayBonusType_old";
CREATE TYPE "BirthdayBonusType" AS ENUM ('BONUS_POINTS');
ALTER TABLE "studio_birthday_message_settings"
  ALTER COLUMN "bonusType" TYPE "BirthdayBonusType"
  USING ("bonusType"::text::"BirthdayBonusType");
DROP TYPE "BirthdayBonusType_old";

ALTER TABLE "clients" DROP COLUMN IF EXISTS "discount";
ALTER TABLE "clients" DROP COLUMN IF EXISTS "discountExpiresAt";
