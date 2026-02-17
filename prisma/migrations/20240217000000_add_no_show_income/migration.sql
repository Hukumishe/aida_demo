-- CreateTable
CREATE TABLE IF NOT EXISTS "no_show_incomes" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "originalStartAt" TIMESTAMP(3) NOT NULL,
    "originalEndAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "no_show_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "no_show_incomes_studioId_createdAt_idx" ON "no_show_incomes"("studioId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "no_show_incomes_studioId_originalStartAt_idx" ON "no_show_incomes"("studioId", "originalStartAt");

-- AddForeignKey
ALTER TABLE "no_show_incomes" ADD CONSTRAINT "no_show_incomes_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_incomes" ADD CONSTRAINT "no_show_incomes_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_incomes" ADD CONSTRAINT "no_show_incomes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_incomes" ADD CONSTRAINT "no_show_incomes_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;


