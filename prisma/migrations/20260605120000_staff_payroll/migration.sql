-- Зарплата / комиссия сотрудников (настройки на уровне организации, начисления при DONE)

CREATE TYPE "StaffPayrollRateMode" AS ENUM ('UNIFIED', 'BY_CATEGORY', 'BY_SERVICE');
CREATE TYPE "StaffPayrollBaseMode" AS ENUM ('WITH_DISCOUNTS', 'WITHOUT_DISCOUNTS');
CREATE TYPE "StaffPayrollLineType" AS ENUM ('PRIMARY_SERVICE', 'UPSELL');

CREATE TABLE "staff_payroll_settings" (
  "staffUserId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "rateMode" "StaffPayrollRateMode" NOT NULL DEFAULT 'UNIFIED',
  "baseMode" "StaffPayrollBaseMode" NOT NULL DEFAULT 'WITHOUT_DISCOUNTS',
  "unifiedPercent" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "staff_payroll_settings_pkey" PRIMARY KEY ("staffUserId")
);

CREATE INDEX "staff_payroll_settings_organizationId_idx" ON "staff_payroll_settings"("organizationId");

CREATE TABLE "staff_payroll_category_rates" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "staffUserId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "percent" INTEGER NOT NULL,

  CONSTRAINT "staff_payroll_category_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_payroll_category_rates_staffUserId_categoryId_key"
  ON "staff_payroll_category_rates"("staffUserId", "categoryId");
CREATE INDEX "staff_payroll_category_rates_organizationId_staffUserId_idx"
  ON "staff_payroll_category_rates"("organizationId", "staffUserId");

CREATE TABLE "staff_payroll_service_rates" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "staffUserId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "percent" INTEGER NOT NULL,

  CONSTRAINT "staff_payroll_service_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_payroll_service_rates_staffUserId_serviceId_key"
  ON "staff_payroll_service_rates"("staffUserId", "serviceId");
CREATE INDEX "staff_payroll_service_rates_organizationId_staffUserId_idx"
  ON "staff_payroll_service_rates"("organizationId", "staffUserId");

CREATE TABLE "staff_payroll_accruals" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "staffUserId" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "studioId" TEXT NOT NULL,
  "lineRef" TEXT NOT NULL,
  "lineType" "StaffPayrollLineType" NOT NULL,
  "serviceId" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "categoryId" TEXT,
  "categoryName" TEXT,
  "grossLineAmount" INTEGER NOT NULL,
  "baseAmount" INTEGER NOT NULL,
  "percent" INTEGER NOT NULL,
  "commissionAmount" INTEGER NOT NULL,
  "baseMode" "StaffPayrollBaseMode" NOT NULL,
  "rateMode" "StaffPayrollRateMode" NOT NULL,
  "appointmentStartAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "staff_payroll_accruals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_payroll_accruals_appointmentId_lineRef_key"
  ON "staff_payroll_accruals"("appointmentId", "lineRef");
CREATE INDEX "staff_payroll_accruals_organizationId_staffUserId_createdAt_idx"
  ON "staff_payroll_accruals"("organizationId", "staffUserId", "createdAt");
CREATE INDEX "staff_payroll_accruals_organizationId_createdAt_idx"
  ON "staff_payroll_accruals"("organizationId", "createdAt");
CREATE INDEX "staff_payroll_accruals_studioId_createdAt_idx"
  ON "staff_payroll_accruals"("studioId", "createdAt");

ALTER TABLE "staff_payroll_settings"
  ADD CONSTRAINT "staff_payroll_settings_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_payroll_settings"
  ADD CONSTRAINT "staff_payroll_settings_staffUserId_fkey"
  FOREIGN KEY ("staffUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "staff_payroll_category_rates"
  ADD CONSTRAINT "staff_payroll_category_rates_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_payroll_category_rates"
  ADD CONSTRAINT "staff_payroll_category_rates_staffUserId_fkey"
  FOREIGN KEY ("staffUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_payroll_category_rates"
  ADD CONSTRAINT "staff_payroll_category_rates_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "staff_payroll_service_rates"
  ADD CONSTRAINT "staff_payroll_service_rates_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_payroll_service_rates"
  ADD CONSTRAINT "staff_payroll_service_rates_staffUserId_fkey"
  FOREIGN KEY ("staffUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_payroll_service_rates"
  ADD CONSTRAINT "staff_payroll_service_rates_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "staff_payroll_accruals"
  ADD CONSTRAINT "staff_payroll_accruals_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_payroll_accruals"
  ADD CONSTRAINT "staff_payroll_accruals_staffUserId_fkey"
  FOREIGN KEY ("staffUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_payroll_accruals"
  ADD CONSTRAINT "staff_payroll_accruals_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_payroll_accruals"
  ADD CONSTRAINT "staff_payroll_accruals_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_payroll_accruals"
  ADD CONSTRAINT "staff_payroll_accruals_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
