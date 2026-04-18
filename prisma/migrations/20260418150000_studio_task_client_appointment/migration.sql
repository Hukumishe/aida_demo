-- AlterTable
ALTER TABLE "studio_tasks" ADD COLUMN "clientId" TEXT,
ADD COLUMN "appointmentId" TEXT;

-- CreateIndex
CREATE INDEX "studio_tasks_clientId_idx" ON "studio_tasks"("clientId");

-- CreateIndex
CREATE INDEX "studio_tasks_appointmentId_idx" ON "studio_tasks"("appointmentId");

-- AddForeignKey
ALTER TABLE "studio_tasks" ADD CONSTRAINT "studio_tasks_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_tasks" ADD CONSTRAINT "studio_tasks_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
