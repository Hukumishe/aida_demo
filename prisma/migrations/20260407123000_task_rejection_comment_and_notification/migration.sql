-- Add enum value for task rejection notification
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_REJECTED';

-- Store mandatory master's rejection reason on task
ALTER TABLE "studio_tasks"
ADD COLUMN "rejectionComment" TEXT;
