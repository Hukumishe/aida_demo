import { UserRole } from './decorators/roles.decorator';

/**
 * Маска для мастера: +7(***) *** 3494 (последние 4 цифры).
 * Полный номер в API для MASTER не отдаётся.
 */
export function maskPhonePartial(phone: string | null | undefined): string | null {
  if (!phone?.trim()) {
    return null;
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) {
    return '(***) ***';
  }
  const last4 = digits.slice(-4);
  if (digits.length >= 11 && digits.startsWith('7')) {
    return `+7(***) *** ${last4}`;
  }
  if (digits.length >= 11 && digits.startsWith('8')) {
    return `+7(***) *** ${last4}`;
  }
  if (digits.length >= 10) {
    return `+${digits[0]}(***) *** ${last4}`;
  }
  return `(***) *** ${last4}`;
}

export type ClientPhoneFields = {
  phone?: string | null;
  phoneMasked?: string | null;
};

export function maskClientPhoneForRole<T extends ClientPhoneFields>(
  client: T,
  userRole?: string,
): T {
  if (userRole !== UserRole.MASTER || !client.phone?.trim()) {
    return client;
  }
  return {
    ...client,
    phone: undefined,
    phoneMasked: maskPhonePartial(client.phone),
  };
}

export function maskAppointmentClientForRole<
  T extends { client?: ClientPhoneFields | null },
>(appointment: T, userRole?: string): T {
  if (!appointment.client) {
    return appointment;
  }
  return {
    ...appointment,
    client: maskClientPhoneForRole(appointment.client, userRole),
  };
}

export function maskAppointmentsClientForRole<
  T extends { client?: ClientPhoneFields | null },
>(appointments: T[], userRole?: string): T[] {
  if (userRole !== UserRole.MASTER) {
    return appointments;
  }
  return appointments.map((a) => maskAppointmentClientForRole(a, userRole));
}
