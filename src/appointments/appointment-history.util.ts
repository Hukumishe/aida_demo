import { AppointmentCreatedSource, AppointmentStatus } from '@prisma/client';
import { APPOINTMENT_STATUS_LABELS } from './appointment-status.constants';

export type HistoryChangeRow = {
  field: string;
  from: string | null;
  to: string | null;
};

export function formatStatus(status: AppointmentStatus): string {
  return APPOINTMENT_STATUS_LABELS[status] ?? status;
}

export function formatDateTime(iso: Date | string): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) {
    return String(iso);
  }
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMoneyTenge(amount: number | null | undefined): string {
  if (amount == null) {
    return '—';
  }
  return `${amount} ₸`;
}

export function formatCreatedSource(source: AppointmentCreatedSource): string {
  const map: Record<AppointmentCreatedSource, string> = {
    [AppointmentCreatedSource.CRM]: 'CRM',
    [AppointmentCreatedSource.NEXTBOT]: 'Nextbot',
    [AppointmentCreatedSource.LANDING]: 'Лендинг',
  };
  return map[source] ?? source;
}

export function formatUserDisplayName(user: {
  role: string;
  staffProfile: { firstName: string; lastName: string | null } | null;
  email?: string | null;
} | null): string {
  if (!user) {
    return '';
  }
  const profile = user.staffProfile;
  if (profile) {
    return `${profile.firstName} ${profile.lastName ?? ''}`.trim();
  }
  return user.email?.trim() || 'Сотрудник';
}
