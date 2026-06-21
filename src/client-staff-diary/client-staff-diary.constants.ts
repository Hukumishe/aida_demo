import { ClientStaffDiaryVisibility } from '@prisma/client';

/** Подписи для UI при выборе типа заметки (упрощённое описание PRIVATE). */
export const CLIENT_STAFF_DIARY_VISIBILITY_UI = {
  [ClientStaffDiaryVisibility.PRIVATE]: {
    value: ClientStaffDiaryVisibility.PRIVATE,
    label: 'Личная',
    description: 'Видите только вы (мастер)',
  },
  [ClientStaffDiaryVisibility.SHARED]: {
    value: ClientStaffDiaryVisibility.SHARED,
    label: 'Общая',
    description: 'Видят все сотрудники с доступом к клиенту',
  },
} as const;

export function listClientStaffDiaryVisibilityOptions() {
  return Object.values(CLIENT_STAFF_DIARY_VISIBILITY_UI);
}
