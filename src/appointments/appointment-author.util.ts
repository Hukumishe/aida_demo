import {
  AppointmentCreatedSource,
  WaitlistEntrySource,
} from '@prisma/client';

const SOURCE_LABEL: Record<AppointmentCreatedSource, string> = {
  [AppointmentCreatedSource.CRM]: 'CRM',
  [AppointmentCreatedSource.NEXTBOT]: 'Nextbot',
  [AppointmentCreatedSource.LANDING]: 'Лендинг',
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Администратор',
  MASTER: 'Мастер',
  MANAGER: 'Менеджер',
  OWNER: 'Владелец',
  DEPUTY_OWNER: 'Заместитель',
  SERVICE: 'Сервис',
  DEVELOPER: 'Разработчик',
};

export type AppointmentCreatedByUserShape = {
  id: string;
  role: string;
  email: string | null;
  staffProfile: { firstName: string; lastName: string | null } | null;
};

/** Include для ответов API с данными автора записи. */
export const appointmentCreatedByInclude = {
  createdByUser: {
    select: {
      id: true,
      role: true,
      email: true,
      staffProfile: { select: { firstName: true, lastName: true } },
    },
  },
} as const;

export function resolveAppointmentCreatedBy(
  actingUserId?: string,
  explicitSource?: AppointmentCreatedSource,
  waitlistSource?: WaitlistEntrySource,
): { createdByUserId: string | null; createdSource: AppointmentCreatedSource } {
  let createdSource = explicitSource;
  if (!createdSource && waitlistSource) {
    if (waitlistSource === WaitlistEntrySource.NEXTBOT) {
      createdSource = AppointmentCreatedSource.NEXTBOT;
    } else if (waitlistSource === WaitlistEntrySource.LANDING) {
      createdSource = AppointmentCreatedSource.LANDING;
    }
  }
  if (!createdSource) {
    createdSource =
      actingUserId && actingUserId !== 'api-key'
        ? AppointmentCreatedSource.CRM
        : AppointmentCreatedSource.NEXTBOT;
  }
  if (createdSource === AppointmentCreatedSource.NEXTBOT) {
    return { createdSource, createdByUserId: null };
  }
  if (createdSource === AppointmentCreatedSource.LANDING) {
    return { createdSource, createdByUserId: null };
  }
  const createdByUserId =
    actingUserId && actingUserId !== 'api-key' ? actingUserId : null;
  return { createdSource: AppointmentCreatedSource.CRM, createdByUserId };
}

export function buildAppointmentAuthorLabel(
  createdSource: AppointmentCreatedSource,
  createdByUser?: AppointmentCreatedByUserShape | null,
): string {
  if (createdByUser) {
    const profile = createdByUser.staffProfile;
    const name = profile
      ? `${profile.firstName} ${profile.lastName ?? ''}`.trim()
      : createdByUser.email?.trim() || 'Сотрудник';
    const roleLabel = ROLE_LABEL[createdByUser.role];
    return roleLabel ? `${name} (${roleLabel})` : name;
  }
  return SOURCE_LABEL[createdSource] ?? createdSource;
}

export function enrichAppointmentWithAuthor<T extends {
  createdSource: AppointmentCreatedSource;
  createdByUser?: AppointmentCreatedByUserShape | null;
}>(appointment: T): T & { author: string } {
  return {
    ...appointment,
    author: buildAppointmentAuthorLabel(
      appointment.createdSource,
      appointment.createdByUser ?? null,
    ),
  };
}
