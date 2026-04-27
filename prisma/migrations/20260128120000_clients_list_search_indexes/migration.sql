-- Пагинация и поиск GET /clients: ускорение ILIKE по имени и join к визитам.
-- last_visit_at в таблице clients нет (последний визит из appointments); индекс по "виртуальной" колонке не создаём.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "idx_clients_org_phone" ON "clients" ("organizationId", "phone");

CREATE INDEX IF NOT EXISTS "idx_clients_firstname_trgm"
  ON "clients" USING gin (lower("firstName") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_clients_lastname_trgm"
  ON "clients" USING gin (lower("lastName") gin_trgm_ops);

-- Ускорение CTE last_done (max startAt по клиенту для DONE)
CREATE INDEX IF NOT EXISTS "idx_appointments_client_done_start"
  ON "appointments" ("clientId", "startAt")
  WHERE "status" = 'DONE'::"AppointmentStatus";
