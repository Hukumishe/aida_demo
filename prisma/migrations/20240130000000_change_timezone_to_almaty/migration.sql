-- Update existing studios to Almaty timezone
UPDATE "studios" SET "timezone" = 'Asia/Almaty' WHERE "timezone" = 'Europe/Moscow';

-- AlterTable: Change default timezone to Almaty
ALTER TABLE "studios" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Almaty';

