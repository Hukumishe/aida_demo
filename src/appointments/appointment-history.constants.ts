import { AppointmentHistoryAction } from '@prisma/client';

export const APPOINTMENT_HISTORY_ACTION_LABELS: Record<AppointmentHistoryAction, string> = {
  [AppointmentHistoryAction.CREATED]: 'Создание',
  [AppointmentHistoryAction.UPDATED]: 'Изменение',
  [AppointmentHistoryAction.STATUS_CHANGED]: 'Статус',
  [AppointmentHistoryAction.RESCHEDULED]: 'Перенос',
  [AppointmentHistoryAction.PREPAYMENT_CHANGED]: 'Предоплата',
  [AppointmentHistoryAction.COMMENT_CHANGED]: 'Комментарий',
  [AppointmentHistoryAction.CLIENT_ARRIVED]: 'Клиент пришёл',
  [AppointmentHistoryAction.VISIT_COMPLETED]: 'Визит завершён',
  [AppointmentHistoryAction.NO_SHOW]: 'Не пришёл',
  [AppointmentHistoryAction.LATE_PENALTY]: 'Опоздание',
  [AppointmentHistoryAction.STAFF_LATE_FINE]: 'Штраф мастера',
  [AppointmentHistoryAction.CANCELLED]: 'Отмена',
  [AppointmentHistoryAction.UPSELL_ADDED]: 'Допродажа',
  [AppointmentHistoryAction.UPSELL_UPDATED]: 'Допродажа изменена',
  [AppointmentHistoryAction.UPSELL_REMOVED]: 'Допродажа удалена',
};
