-- Комиссия: глобальные настройки на организацию (вместо per-staff)

CREATE TABLE "organization_payroll_settings" (
  "organizationId" TEXT NOT NULL,
  "rateMode" "StaffPayrollRateMode" NOT NULL DEFAULT 'UNIFIED',
  "baseMode" "StaffPayrollBaseMode" NOT NULL DEFAULT 'WITHOUT_DISCOUNTS',
  "unifiedPercent" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organization_payroll_settings_pkey" PRIMARY KEY ("organizationId")
);

CREATE TABLE "organization_payroll_category_rates" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "percent" INTEGER NOT NULL,

  CONSTRAINT "organization_payroll_category_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_payroll_category_rates_organizationId_categoryId_key"
  ON "organization_payroll_category_rates"("organizationId", "categoryId");
CREATE INDEX "organization_payroll_category_rates_organizationId_idx"
  ON "organization_payroll_category_rates"("organizationId");

CREATE TABLE "organization_payroll_service_rates" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "percent" INTEGER NOT NULL,

  CONSTRAINT "organization_payroll_service_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_payroll_service_rates_organizationId_serviceId_key"
  ON "organization_payroll_service_rates"("organizationId", "serviceId");
CREATE INDEX "organization_payroll_service_rates_organizationId_idx"
  ON "organization_payroll_service_rates"("organizationId");

-- Перенос: по одной записи на организацию из старых per-staff настроек (последняя по updatedAt)
INSERT INTO "organization_payroll_settings" (
  "organizationId", "rateMode", "baseMode", "unifiedPercent", "createdAt", "updatedAt"
)
SELECT DISTINCT ON ("organizationId")
  "organizationId", "rateMode", "baseMode", "unifiedPercent", "createdAt", "updatedAt"
FROM "staff_payroll_settings"
ORDER BY "organizationId", "updatedAt" DESC;

INSERT INTO "organization_payroll_category_rates" ("id", "organizationId", "categoryId", "percent")
SELECT DISTINCT ON ("organizationId", "categoryId")
  "id", "organizationId", "categoryId", "percent"
FROM "staff_payroll_category_rates"
ORDER BY "organizationId", "categoryId", "id";

INSERT INTO "organization_payroll_service_rates" ("id", "organizationId", "serviceId", "percent")
SELECT DISTINCT ON ("organizationId", "serviceId")
  "id", "organizationId", "serviceId", "percent"
FROM "staff_payroll_service_rates"
ORDER BY "organizationId", "serviceId", "id";

ALTER TABLE "organization_payroll_settings"
  ADD CONSTRAINT "organization_payroll_settings_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_payroll_category_rates"
  ADD CONSTRAINT "organization_payroll_category_rates_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_payroll_category_rates"
  ADD CONSTRAINT "organization_payroll_category_rates_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_payroll_service_rates"
  ADD CONSTRAINT "organization_payroll_service_rates_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_payroll_service_rates"
  ADD CONSTRAINT "organization_payroll_service_rates_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "staff_payroll_service_rates";
DROP TABLE "staff_payroll_category_rates";
DROP TABLE "staff_payroll_settings";
