-- CreateEnum
CREATE TYPE "NextbotAutoMessageTiming" AS ENUM ('BEFORE_PROCEDURE', 'AFTER_PROCEDURE');

-- CreateEnum
CREATE TYPE "NextbotAutoMessageOffsetUnit" AS ENUM ('MINUTES', 'HOURS', 'DAYS');

-- CreateTable
CREATE TABLE "nextbot_auto_message_templates" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "serviceCategoryId" TEXT NOT NULL,
    "timing" "NextbotAutoMessageTiming" NOT NULL,
    "offsetValue" INTEGER NOT NULL,
    "offsetUnit" "NextbotAutoMessageOffsetUnit" NOT NULL,
    "messageText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nextbot_auto_message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nextbot_auto_message_templates_studioId_idx" ON "nextbot_auto_message_templates"("studioId");

-- CreateIndex
CREATE INDEX "nextbot_auto_message_templates_studioId_serviceCategoryId_tim_idx" ON "nextbot_auto_message_templates"("studioId", "serviceCategoryId", "timing");

-- AddForeignKey
ALTER TABLE "nextbot_auto_message_templates" ADD CONSTRAINT "nextbot_auto_message_templates_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nextbot_auto_message_templates" ADD CONSTRAINT "nextbot_auto_message_templates_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
