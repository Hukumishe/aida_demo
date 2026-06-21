import { AppointmentCreatedSource } from '@prisma/client';
import { UserRole } from './decorators/roles.decorator';

export type BlacklistBookingAttemptSource = 'LANDING' | 'NEXTBOT' | 'OTHER';

const SOURCE_LABELS: Record<BlacklistBookingAttemptSource, string> = {
  LANDING: 'лендинг',
  NEXTBOT: 'Nextbot',
  OTHER: 'онлайн-запись',
};

export function formatClientDisplayName(client: {
  firstName: string;
  lastName?: string | null;
  patronymic?: string | null;
}): string {
  return [client.firstName, client.lastName, client.patronymic]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function resolveBlacklistBookingAttemptSource(
  createdSource?: AppointmentCreatedSource,
  actingUserId?: string,
): BlacklistBookingAttemptSource {
  if (createdSource === AppointmentCreatedSource.LANDING || actingUserId === 'api-key') {
    return 'LANDING';
  }
  if (createdSource === AppointmentCreatedSource.NEXTBOT) {
    return 'NEXTBOT';
  }
  return 'OTHER';
}

export function getBlacklistBookingAttemptSourceLabel(
  source: BlacklistBookingAttemptSource,
): string {
  return SOURCE_LABELS[source];
}

/**
 * Уведомляем менеджеров только при попытках с лендинга / Nextbot,
 * не когда сотрудник CRM сам пробует создать запись.
 */
export function shouldNotifyManagersOnBlacklistBookingAttempt(params: {
  userRole?: string;
  actingUserId?: string;
  createdSource?: AppointmentCreatedSource;
}): boolean {
  const { userRole, actingUserId, createdSource } = params;

  if (
    createdSource === AppointmentCreatedSource.LANDING ||
    createdSource === AppointmentCreatedSource.NEXTBOT
  ) {
    return true;
  }
  if (actingUserId === 'api-key') {
    return true;
  }

  const staffRoles: string[] = [
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.MASTER,
    UserRole.OWNER,
    UserRole.DEPUTY_OWNER,
    UserRole.DEVELOPER,
    UserRole.SERVICE,
  ];
  if (
    userRole &&
    staffRoles.includes(userRole) &&
    actingUserId &&
    actingUserId !== 'api-key'
  ) {
    return false;
  }

  return false;
}
