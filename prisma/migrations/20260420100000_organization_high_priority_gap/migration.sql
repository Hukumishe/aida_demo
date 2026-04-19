-- Add configurable high-priority gap interval (minutes) for check_availability
-- slot classification. null disables the "high" tier entirely.

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "highPriorityGapMinutes" INTEGER;
