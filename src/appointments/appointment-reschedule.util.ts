import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';

/** Статусы, при которых запись можно переносить (время / мастер). */
export const MOVABLE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.TENTATIVE,
  AppointmentStatus.PENDING_CONFIRMATION,
  AppointmentStatus.AWAITING_PREPAYMENT,
  AppointmentStatus.BOOKED,
  AppointmentStatus.ARRIVED,
];

export type RescheduleErrorCode =
  | 'SLOT_BUSY'
  | 'OUTSIDE_WORKING_HOURS'
  | 'STATUS_NOT_MOVABLE'
  | 'INVALID_DATE'
  | 'NOT_FOUND';

export function throwRescheduleError(
  status: number,
  error: RescheduleErrorCode,
  message: string,
  extra?: Record<string, unknown>,
): never {
  const body = { error, message, ...(extra ?? {}) };
  if (status === 404) {
    throw new NotFoundException(body);
  }
  if (status === 409) {
    throw new ConflictException(body);
  }
  throw new BadRequestException(body);
}

/** Маппинг кодов AvailabilityService → коды фронта для переноса. */
export function remapAvailabilityErrorForReschedule(err: unknown): never {
  if (!(err instanceof HttpException)) {
    throw err;
  }
  const resp = err.getResponse();
  const nestError =
    typeof resp === 'object' && resp !== null
      ? String((resp as any).error ?? (resp as any).code ?? '')
      : '';
  const message =
    typeof resp === 'object' && resp !== null
      ? String((resp as any).message ?? err.message)
      : err.message;
  const conflictingAppointmentId =
    typeof resp === 'object' && resp !== null
      ? (resp as any).conflictingAppointmentId
      : undefined;

  if (
    nestError === 'APPOINTMENT_NO_SCHEDULE' ||
    nestError === 'APPOINTMENT_OUTSIDE_HOURS' ||
    nestError === 'APPOINTMENT_IN_BREAK'
  ) {
    throwRescheduleError(400, 'OUTSIDE_WORKING_HOURS', message);
  }

  if (
    nestError === 'APPOINTMENT_BUSY_SLOT_CONFLICT' ||
    nestError === 'APPOINTMENT_APPOINTMENT_CONFLICT'
  ) {
    throwRescheduleError(400, 'SLOT_BUSY', message, {
      ...(conflictingAppointmentId
        ? { conflictingAppointmentId }
        : {}),
    });
  }

  throw err;
}

export function parseRescheduleDate(
  value: string,
  field: 'startAt' | 'endAt',
): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throwRescheduleError(
      400,
      'INVALID_DATE',
      `Некорректная дата в поле ${field}`,
    );
  }
  return d;
}

/** Допуск 1 с при сравнении длительности (округление ISO). */
const DURATION_TOLERANCE_MS = 1000;

export function assertRescheduleDurationMatches(
  startAt: Date,
  endAt: Date,
  currentDurationMs: number,
): void {
  const provided = endAt.getTime() - startAt.getTime();
  if (provided <= 0) {
    throwRescheduleError(
      400,
      'INVALID_DATE',
      'endAt должен быть позже startAt',
    );
  }
  if (Math.abs(provided - currentDurationMs) > DURATION_TOLERANCE_MS) {
    throwRescheduleError(
      400,
      'INVALID_DATE',
      'Длительность при переносе не должна меняться: endAt должен быть startAt + текущая длительность записи',
    );
  }
}
