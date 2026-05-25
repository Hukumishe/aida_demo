import { AppointmentStatus } from '@prisma/client';

/** Подписи статусов записи для CRM и шаблонов автосообщений. */
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.BOOKED]: 'Забронировано',
  [AppointmentStatus.CANCELLED]: 'Отменено',
  [AppointmentStatus.ARRIVED]: 'Пришёл',
  [AppointmentStatus.DONE]: 'Завершено',
  [AppointmentStatus.TENTATIVE]: 'Предварительная бронь',
  [AppointmentStatus.PENDING_CONFIRMATION]: 'Ожидает подтверждения',
  [AppointmentStatus.AWAITING_PREPAYMENT]: 'Ожидаем предоплату',
};

export function listAppointmentStatusOptions() {
  return (Object.values(AppointmentStatus) as AppointmentStatus[]).map((value) => ({
    value,
    label: APPOINTMENT_STATUS_LABELS[value],
  }));
}
