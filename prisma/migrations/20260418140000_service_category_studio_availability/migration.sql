-- AlterTable
ALTER TABLE "service_categories" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "studio_disabled_categories" (
    "studioId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_disabled_categories_pkey" PRIMARY KEY ("studioId","categoryId")
);

-- CreateIndex
CREATE INDEX "studio_disabled_categories_categoryId_idx" ON "studio_disabled_categories"("categoryId");

-- AddForeignKey
ALTER TABLE "studio_disabled_categories" ADD CONSTRAINT "studio_disabled_categories_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_disabled_categories" ADD CONSTRAINT "studio_disabled_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
