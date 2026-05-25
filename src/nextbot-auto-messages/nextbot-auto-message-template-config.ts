import {
  AppointmentStatus,
  NextbotAutoMessageAnchor,
  NextbotAutoMessageDirection,
  NextbotAutoMessageTriggerType,
} from '@prisma/client';
import { APPOINTMENT_STATUS_LABELS } from '../appointments/appointment-status.constants';

/** Подписи типов сценария для UI. */
export const NEXTBOT_TRIGGER_TYPE_LABELS: Record<NextbotAutoMessageTriggerType, string> = {
  [NextbotAutoMessageTriggerType.BOOKING_CONFIRMED]: 'Подтверждение записи',
  [NextbotAutoMessageTriggerType.REMINDER_BEFORE_VISIT]: 'Напоминание о визите',
  [NextbotAutoMessageTriggerType.HOLD_EXPIRY_WARNING]: 'Истечение брони',
  [NextbotAutoMessageTriggerType.FOLLOWUP_AFTER_VISIT]: 'Follow-up после визита',
  [NextbotAutoMessageTriggerType.FEEDBACK_REQUEST]: 'Запрос оценки',
  [NextbotAutoMessageTriggerType.CUSTOM_SCHEDULED]: 'Своё сообщение',
  [NextbotAutoMessageTriggerType.STATUS_CHANGED]: 'Смена статуса записи',
};

/** Форма шаблона «при смене статуса на …». */
export function getStatusChangedFormSchema() {
  return {
    triggerType: NextbotAutoMessageTriggerType.STATUS_CHANGED,
    anchor: NextbotAutoMessageAnchor.NONE,
    direction: NextbotAutoMessageDirection.AFTER,
    offsetValue: 1,
    offsetUnit: 'MINUTES',
    hideScheduleFields: true,
    triggerOnStatus: {
      label: 'Если статус сменили на',
      required: true,
      options: (Object.values(AppointmentStatus) as AppointmentStatus[]).map((value) => ({
        value,
        label: APPOINTMENT_STATUS_LABELS[value],
      })),
    },
    serviceCategoryRequired: false,
    hint: 'Сообщение уходит сразу после перехода записи в выбранный статус (в CRM или через Nextbot).',
  };
}

/** Схема формы «своё сообщение» для фронта. */
export function getCustomScheduleFormSchema() {
  return {
    triggerType: NextbotAutoMessageTriggerType.CUSTOM_SCHEDULED,
    phases: [
      {
        id: 'BEFORE_PROCEDURE',
        label: 'До процедуры',
        description: 'Относительно начала визита (запись в статусе «Забронировано»)',
        anchor: NextbotAutoMessageAnchor.APPOINTMENT_START,
        direction: NextbotAutoMessageDirection.BEFORE,
        offsetLabel: 'За сколько до начала визита',
      },
      {
        id: 'AFTER_PROCEDURE',
        label: 'После процедуры',
        description: 'После завершения визита (статус «Завершено»)',
        anchor: NextbotAutoMessageAnchor.VISIT_DONE_AT,
        direction: NextbotAutoMessageDirection.AFTER,
        offsetLabel: 'Через сколько после завершения',
      },
    ],
    offsetUnits: [
      { value: 'MINUTES', label: 'Минут' },
      { value: 'HOURS', label: 'Часов' },
      { value: 'DAYS', label: 'Дней' },
    ],
    serviceCategoryRequired: true,
    optionalMinLeadDays: {
      appliesToPhaseId: 'BEFORE_PROCEDURE',
      label: 'Мин. дней с момента брони до визита (опционально)',
      hint: 'Если задано — сообщение планируется только если с BOOKED до startAt прошло не меньше N суток',
    },
  };
}

export function requiresServiceCategory(
  triggerType: NextbotAutoMessageTriggerType,
): boolean {
  return (
    triggerType === NextbotAutoMessageTriggerType.FOLLOWUP_AFTER_VISIT ||
    triggerType === NextbotAutoMessageTriggerType.FEEDBACK_REQUEST ||
    triggerType === NextbotAutoMessageTriggerType.CUSTOM_SCHEDULED
  );
}

export function isCustomScheduledAfterVisit(template: {
  triggerType: NextbotAutoMessageTriggerType;
  anchor: NextbotAutoMessageAnchor;
  direction: NextbotAutoMessageDirection;
}): boolean {
  return (
    template.triggerType === NextbotAutoMessageTriggerType.CUSTOM_SCHEDULED &&
    template.anchor === NextbotAutoMessageAnchor.VISIT_DONE_AT &&
    template.direction === NextbotAutoMessageDirection.AFTER
  );
}

export function isStatusChangedTrigger(
  triggerType: NextbotAutoMessageTriggerType,
): boolean {
  return triggerType === NextbotAutoMessageTriggerType.STATUS_CHANGED;
}

export function assertValidTemplateSchedule(params: {
  triggerType: NextbotAutoMessageTriggerType;
  anchor: NextbotAutoMessageAnchor;
  direction: NextbotAutoMessageDirection;
  serviceCategoryId?: string | null;
  triggerOnStatus?: AppointmentStatus | null;
}): void {
  const { triggerType, anchor, direction, serviceCategoryId, triggerOnStatus } = params;

  if (isStatusChangedTrigger(triggerType)) {
    if (!triggerOnStatus) {
      throw new Error(
        'Для триггера «Смена статуса» укажите triggerOnStatus (на какой статус реагировать)',
      );
    }
    if (
      anchor !== NextbotAutoMessageAnchor.NONE ||
      direction !== NextbotAutoMessageDirection.AFTER
    ) {
      throw new Error(
        'Смена статуса: anchor NONE и direction AFTER (смещение не используется)',
      );
    }
    return;
  }

  if (triggerOnStatus) {
    throw new Error('triggerOnStatus допустим только для триггера STATUS_CHANGED');
  }

  if (requiresServiceCategory(triggerType) && !serviceCategoryId?.trim()) {
    throw new Error(
      'Для выбранного типа сценария укажите категорию услуг (serviceCategoryId)',
    );
  }

  if (triggerType !== NextbotAutoMessageTriggerType.CUSTOM_SCHEDULED) {
    return;
  }

  const beforeVisit =
    anchor === NextbotAutoMessageAnchor.APPOINTMENT_START &&
    direction === NextbotAutoMessageDirection.BEFORE;
  const afterVisit =
    anchor === NextbotAutoMessageAnchor.VISIT_DONE_AT &&
    direction === NextbotAutoMessageDirection.AFTER;

  if (!beforeVisit && !afterVisit) {
    throw new Error(
      'Своё сообщение: «до процедуры» — anchor APPOINTMENT_START + BEFORE; ' +
        '«после процедуры» — VISIT_DONE_AT + AFTER',
    );
  }
}
