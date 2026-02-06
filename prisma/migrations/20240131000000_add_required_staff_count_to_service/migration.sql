-- AlterTable: Add requiredStaffCount column to services table
ALTER TABLE "services" ADD COLUMN "requiredStaffCount" INTEGER NOT NULL DEFAULT 1;

