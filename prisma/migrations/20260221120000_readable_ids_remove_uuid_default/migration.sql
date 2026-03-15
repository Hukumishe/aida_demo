-- Remove UUID default from id columns so application can set readable prefixed IDs (e.g. stu_abc12, usr_xyz98).
-- Existing rows keep their current id values. New rows get id from application via generateId().
-- Only alter tables that exist (some may be created in later migrations).

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'studios', 'prompts', 'users', 'clients', 'work_schedule_days', 'busy_slots', 'services',
    'landing_promotions', 'landing_promotion_services', 'landing_promotion_codes', 'landing_masters', 'landing_service_cards',
    'staff_services', 'staff_service_overrides', 'appointments', 'appointment_upsells', 'logs',
    'no_show_incomes', 'notifications', 'blacklist_requests', 'bonus_history',
    'warehouses', 'products', 'transfers', 'stock_movements'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN id DROP DEFAULT', t);
    END IF;
  END LOOP;
END $$;
