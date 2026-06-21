import { BadRequestException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import {
  DEFAULT_IANA_TIMEZONE,
  studioWallClockTimezone,
} from '../common/effective-timezone';
import {
  normalizeCalendarDateStr,
  zonedDayRangeUtc,
} from '../common/iana-wall-time';

export type StaffProfileAppointmentStats = {
  period: { from: string; to: string };
  studioId: string | null;
  studioScope: 'single' | 'all_work_studios';
  total: number;
  excludingCancelled: number;
  byStatus: Record<string, number>;
};

type StudioWithOrg = {
  timezone: string | null;
  organization: { ianaTimezone?: string | null } | null;
};

/** Календарный месяц [from, to] в wall-clock TZ. */
export function defaultCalendarMonthPeriodInTz(
  timeZone: string,
  reference = new Date(),
): { from: string; to: string } {
  const todayStr = normalizeCalendarDateStr(
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(reference),
  );
  const [y, m] = todayStr.split('-');
  const from = `${y}-${m}-01`;
  const month = parseInt(m, 10);
  const year = parseInt(y, 10);
  const nextMonthStart =
    month === 12
      ? `${year + 1}-01-01`
      : `${y}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEndExclusive = zonedDayRangeUtc(nextMonthStart, timeZone).dayStart;
  const lastDayStr = normalizeCalendarDateStr(
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(
      new Date(monthEndExclusive.getTime() - 60_000),
    ),
  );
  return { from, to: lastDayStr };
}

export function resolveStaffProfileStatsPeriod(
  fromInput: string | undefined,
  toInput: string | undefined,
  timeZone: string,
): { fromLabel: string; toLabel: string; startAtGte: Date; startAtLt: Date } {
  const labels =
    fromInput?.trim() && toInput?.trim()
      ? {
          from: normalizeCalendarDateStr(fromInput),
          to: normalizeCalendarDateStr(toInput),
        }
      : fromInput?.trim() || toInput?.trim()
        ? {
            from: normalizeCalendarDateStr(fromInput ?? toInput!),
            to: normalizeCalendarDateStr(toInput ?? fromInput!),
          }
        : defaultCalendarMonthPeriodInTz(timeZone);

  const startAtGte = zonedDayRangeUtc(labels.from, timeZone).dayStart;
  const endNext = zonedDayRangeUtc(labels.to, timeZone).nextDayStart;
  if (startAtGte >= endNext) {
    throw new BadRequestException('from must be before or equal to to');
  }
  return {
    fromLabel: labels.from,
    toLabel: labels.to,
    startAtGte,
    startAtLt: endNext,
  };
}

export function collectStaffWorkStudioIds(staff: {
  studioId: string | null;
  studioMemberships: { studioId: string }[];
}): string[] {
  const ids = new Set<string>();
  if (staff.studioId) {
    ids.add(staff.studioId);
  }
  for (const m of staff.studioMemberships) {
    ids.add(m.studioId);
  }
  return [...ids];
}

export function buildAppointmentStatsFromRows(
  rows: { status: AppointmentStatus }[],
  period: { from: string; to: string },
  studioId: string | null,
  studioScope: 'single' | 'all_work_studios',
): StaffProfileAppointmentStats {
  const byStatus: Record<string, number> = {};
  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  }
  const total = rows.length;
  const excludingCancelled =
    total - (byStatus[AppointmentStatus.CANCELLED] ?? 0);

  return {
    period,
    studioId,
    studioScope,
    total,
    excludingCancelled,
    byStatus,
  };
}

export function timezoneFromStudio(
  studio: StudioWithOrg | null | undefined,
): string {
  if (!studio) {
    return DEFAULT_IANA_TIMEZONE;
  }
  return studioWallClockTimezone(studio, studio.organization ?? undefined);
}
