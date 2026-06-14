-- AlterEnum
ALTER TYPE "AppointmentHistoryAction" ADD VALUE 'STAFF_LATE_FINE';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "masterLateFineAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "masterLateFineAmount" INTEGER;
