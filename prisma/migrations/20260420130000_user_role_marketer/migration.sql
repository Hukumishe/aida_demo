-- Add MARKETER role (маркетолог) — employee who manages organization-level
-- marketing artefacts: landing promotions, masters on landing, service cards,
-- FAQ. Does NOT have studio-level operational access.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MARKETER';
