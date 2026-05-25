import { TaskStatus } from '@prisma/client';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.OPEN]: 'Открыта',
  [TaskStatus.IN_PROGRESS]: 'В работе',
  [TaskStatus.DONE]: 'Выполнена',
  [TaskStatus.CANCELLED]: 'Отменена',
};

export type TaskUserBrief = {
  id: string;
  role: string;
  staffProfile: { firstName: string; lastName: string | null } | null;
};

export function formatTaskUserName(user: TaskUserBrief | null | undefined): string {
  if (!user) {
    return '';
  }
  const profile = user.staffProfile;
  if (profile) {
    return `${profile.firstName} ${profile.lastName ?? ''}`.trim();
  }
  return user.id;
}

/** Подпись для UI: «В работе (Иван Иванов)», «Выполнена (Мария)». */
export function buildTaskStatusLabel(
  status: TaskStatus,
  inProgressBy?: TaskUserBrief | null,
  completedBy?: TaskUserBrief | null,
): string {
  if (status === TaskStatus.IN_PROGRESS) {
    const name = formatTaskUserName(inProgressBy);
    return name ? `${TASK_STATUS_LABELS[status]} (${name})` : TASK_STATUS_LABELS[status];
  }
  if (status === TaskStatus.DONE) {
    const name = formatTaskUserName(completedBy);
    return name ? `${TASK_STATUS_LABELS[status]} (${name})` : TASK_STATUS_LABELS[status];
  }
  return TASK_STATUS_LABELS[status] ?? status;
}

export function listTaskStatusOptions() {
  return (Object.values(TaskStatus) as TaskStatus[]).map((value) => ({
    value,
    label: TASK_STATUS_LABELS[value],
  }));
}
