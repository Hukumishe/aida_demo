-- Remove UUID default from id columns so application can set readable prefixed IDs (e.g. stu_abc12, usr_xyz98).
-- Existing rows keep their current id values. New rows get id from application via generateId().

ALTER TABLE "studios" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "prompts" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "clients" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "work_schedule_days" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "busy_slots" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "services" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "landing_promotions" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "landing_promotion_services" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "landing_promotion_codes" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "landing_masters" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "landing_service_cards" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "staff_services" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "staff_service_overrides" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "appointments" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "appointment_upsells" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "logs" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "no_show_incomes" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "notifications" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "blacklist_requests" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "bonus_history" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "warehouses" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "products" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "transfers" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "stock_movements" ALTER COLUMN "id" DROP DEFAULT;
