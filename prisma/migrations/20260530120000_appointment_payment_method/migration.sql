-- CreateEnum
CREATE TYPE "VisitPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'KASPI_PAY');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "completedPaymentMethod" "VisitPaymentMethod";
