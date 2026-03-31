-- Задачи по филиалу + типы уведомлений
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');

ALTER TYPE "NotificationType" ADD VALUE 'NEW_TASK';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_DEADLINE_APPROACHING';

CREATE TABLE "studio_tasks" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "deadlineReminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "studio_tasks_studioId_idx" ON "studio_tasks"("studioId");
CREATE INDEX "studio_tasks_assigneeUserId_idx" ON "studio_tasks"("assigneeUserId");
CREATE INDEX "studio_tasks_deadlineAt_idx" ON "studio_tasks"("deadlineAt");
CREATE INDEX "studio_tasks_studioId_status_idx" ON "studio_tasks"("studioId", "status");

ALTER TABLE "studio_tasks" ADD CONSTRAINT "studio_tasks_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "studio_tasks" ADD CONSTRAINT "studio_tasks_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "studio_tasks" ADD CONSTRAINT "studio_tasks_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "studio_task_controllers" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "studio_task_controllers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "studio_task_controllers_taskId_userId_key" ON "studio_task_controllers"("taskId", "userId");
CREATE INDEX "studio_task_controllers_userId_idx" ON "studio_task_controllers"("userId");

ALTER TABLE "studio_task_controllers" ADD CONSTRAINT "studio_task_controllers_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "studio_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "studio_task_controllers" ADD CONSTRAINT "studio_task_controllers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
