-- AlterTable
-- Add blacklistReason field to clients table
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "blacklistReason" TEXT;

