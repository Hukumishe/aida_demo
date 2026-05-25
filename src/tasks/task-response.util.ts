import { TaskStatus } from '@prisma/client';
import { buildTaskStatusLabel, TaskUserBrief } from './task-status.constants';

type TaskRow = {
  status: TaskStatus;
  inProgressBy?: TaskUserBrief | null;
  completedBy?: TaskUserBrief | null;
} & Record<string, unknown>;

export function enrichStudioTask<T extends TaskRow>(task: T) {
  return {
    ...task,
    statusLabel: buildTaskStatusLabel(
      task.status,
      task.inProgressBy ?? null,
      task.completedBy ?? null,
    ),
  };
}

export function enrichStudioTasks<T extends TaskRow>(tasks: T[]) {
  return tasks.map((t) => enrichStudioTask(t));
}
