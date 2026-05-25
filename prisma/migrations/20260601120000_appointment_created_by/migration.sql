-- CreateEnum
CREATE TYPE "AppointmentCreatedSource" AS ENUM ('CRM', 'NEXTBOT', 'LANDING');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "createdSource" "AppointmentCreatedSource" NOT NULL DEFAULT 'CRM';
ALTER TABLE "appointments" ADD COLUMN "createdByUserId" TEXT;

-- CreateIndex
CREATE INDEX "appointments_createdByUserId_idx" ON "appointments"("createdByUserId");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
