-- Allow multiple primary services inside one appointment.
-- This is separate from appointment_upsells (which remains for add-on sales).

CREATE TABLE IF NOT EXISTS "appointment_service_items" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "durationMin" INTEGER NOT NULL,
  "price" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appointment_service_items_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointment_service_items_appointmentId_fkey'
  ) THEN
    ALTER TABLE "appointment_service_items"
      ADD CONSTRAINT "appointment_service_items_appointmentId_fkey"
      FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointment_service_items_serviceId_fkey'
  ) THEN
    ALTER TABLE "appointment_service_items"
      ADD CONSTRAINT "appointment_service_items_serviceId_fkey"
      FOREIGN KEY ("serviceId") REFERENCES "services"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "appointment_service_items_appointmentId_serviceId_key"
  ON "appointment_service_items" ("appointmentId", "serviceId");

CREATE INDEX IF NOT EXISTS "appointment_service_items_appointmentId_sortOrder_idx"
  ON "appointment_service_items" ("appointmentId", "sortOrder");

CREATE INDEX IF NOT EXISTS "appointment_service_items_serviceId_idx"
  ON "appointment_service_items" ("serviceId");
