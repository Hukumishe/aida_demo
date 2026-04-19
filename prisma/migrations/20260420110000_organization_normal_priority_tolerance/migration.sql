-- Tolerance (in minutes) for the "adjacency" check used by check_availability
-- when classifying free slots as normal priority. 0/null = exact-touch only.

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "normalPriorityToleranceMinutes" INTEGER;
