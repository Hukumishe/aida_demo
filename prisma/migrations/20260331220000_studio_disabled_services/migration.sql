-- Per-studio service visibility: row = service is NOT offered at this branch (org catalog unchanged).

CREATE TABLE "studio_disabled_services" (
    "studioId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_disabled_services_pkey" PRIMARY KEY ("studioId","serviceId"),
    CONSTRAINT "studio_disabled_services_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "studio_disabled_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "studio_disabled_services_serviceId_idx" ON "studio_disabled_services"("serviceId");
