-- IANA timezone для организации (DEVELOPER задаёт в API; не путать с timezone филиала).
ALTER TABLE "organizations" ADD COLUMN "ianaTimezone" TEXT NOT NULL DEFAULT 'Asia/Almaty';
