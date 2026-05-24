import {
  NextbotAutoMessageAnchor,
  NextbotAutoMessageDirection,
  NextbotAutoMessageOffsetUnit,
} from '@prisma/client';

export function offsetToMilliseconds(
  value: number,
  unit: NextbotAutoMessageOffsetUnit,
): number {
  switch (unit) {
    case NextbotAutoMessageOffsetUnit.MINUTES:
      return value * 60_000;
    case NextbotAutoMessageOffsetUnit.HOURS:
      return value * 3_600_000;
    case NextbotAutoMessageOffsetUnit.DAYS:
      return value * 86_400_000;
    default:
      return value * 60_000;
  }
}

export function computeScheduledAt(params: {
  anchor: NextbotAutoMessageAnchor;
  direction: NextbotAutoMessageDirection;
  offsetValue: number;
  offsetUnit: NextbotAutoMessageOffsetUnit;
  startAt: Date;
  holdExpiresAt: Date | null;
  visitDoneAt: Date | null;
}): Date | null {
  const delta = offsetToMilliseconds(params.offsetValue, params.offsetUnit);
  const { anchor, direction } = params;

  if (anchor === NextbotAutoMessageAnchor.NONE) {
    return new Date();
  }

  let base: Date | null = null;
  if (anchor === NextbotAutoMessageAnchor.APPOINTMENT_START) {
    base = params.startAt;
  } else if (anchor === NextbotAutoMessageAnchor.HOLD_EXPIRES_AT) {
    base = params.holdExpiresAt;
  } else if (anchor === NextbotAutoMessageAnchor.VISIT_DONE_AT) {
    base = params.visitDoneAt;
  }

  if (!base) return null;

  if (direction === NextbotAutoMessageDirection.BEFORE) {
    return new Date(base.getTime() - delta);
  }
  return new Date(base.getTime() + delta);
}

export function meetsMinLeadDays(
  bookedAt: Date | null,
  startAt: Date,
  minLeadDays: number | null | undefined,
): boolean {
  if (minLeadDays == null || minLeadDays <= 0) return true;
  if (!bookedAt) return false;
  const ms = startAt.getTime() - bookedAt.getTime();
  return ms >= minLeadDays * 86_400_000;
}
