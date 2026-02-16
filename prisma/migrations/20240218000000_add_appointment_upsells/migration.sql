-- CreateTable
CREATE TABLE IF NOT EXISTS "appointment_upsells" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_upsells_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "appointment_upsells_appointmentId_idx" ON "appointment_upsells"("appointmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "appointment_upsells_serviceId_idx" ON "appointment_upsells"("serviceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "appointment_upsells_appointmentId_createdAt_idx" ON "appointment_upsells"("appointmentId", "createdAt");

-- AddForeignKey
ALTER TABLE "appointment_upsells" ADD CONSTRAINT "appointment_upsells_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_upsells" ADD CONSTRAINT "appointment_upsells_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

