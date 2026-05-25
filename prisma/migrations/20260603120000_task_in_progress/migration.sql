-- Статус «В работе» и кто взял / кто завершил задачу
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';

ALTER TABLE "studio_tasks" ADD COLUMN IF NOT EXISTS "inProgressByUserId" TEXT;
ALTER TABLE "studio_tasks" ADD COLUMN IF NOT EXISTS "completedByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "studio_tasks_inProgressByUserId_idx" ON "studio_tasks"("inProgressByUserId");
CREATE INDEX IF NOT EXISTS "studio_tasks_completedByUserId_idx" ON "studio_tasks"("completedByUserId");

ALTER TABLE "studio_tasks" ADD CONSTRAINT "studio_tasks_inProgressByUserId_fkey"
  FOREIGN KEY ("inProgressByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "studio_tasks" ADD CONSTRAINT "studio_tasks_completedByUserId_fkey"
  FOREIGN KEY ("completedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
