import { BadRequestException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { DEFAULT_IANA_TIMEZONE } from '../common/effective-timezone';
import {
  normalizeCalendarDateStr,
  zonedDayRangeUtc,
} from '../common/iana-wall-time';
import {
  getAppointmentPrimaryServicesRevenue,
  getDoneAppointmentRevenue,
} from '../dashboard/dashboard-revenue.util';

export type AppointmentsListPeriod = {
  from: string;
  to: string;
  startAtGte: Date;
  startAtLt: Date;
};

export function resolveAppointmentsListPeriod(
  fromInput: string,
  toInput: string,
  timeZone: string = DEFAULT_IANA_TIMEZONE,
): AppointmentsListPeriod {
  const from = normalizeCalendarDateStr(fromInput);
  const to = normalizeCalendarDateStr(toInput);
  const startAtGte = zonedDayRangeUtc(from, timeZone).dayStart;
  const startAtLt = zonedDayRangeUtc(to, timeZone).nextDayStart;
  if (startAtGte >= startAtLt) {
    throw new BadRequestException('from must be before or equal to to');
  }
  return { from, to, startAtGte, startAtLt };
}

type RevenueLike = Parameters<typeof getAppointmentPrimaryServicesRevenue>[0] & {
  status: AppointmentStatus;
};

export function getAppointmentListDisplayRevenue(appointment: RevenueLike): number {
  if (appointment.status === AppointmentStatus.DONE) {
    return getDoneAppointmentRevenue(appointment);
  }
  return getAppointmentPrimaryServicesRevenue(appointment);
}

export function buildAppointmentsListSummary(
  rows: RevenueLike[],
  totalCount?: number,
): { count: number; revenue: number } {
  const count = totalCount ?? rows.length;
  const revenue = rows.reduce(
    (sum, row) => sum + getAppointmentListDisplayRevenue(row),
    0,
  );
  return { count, revenue };
}

const revenueSummarySelect = {
  status: true,
  prepaymentAmount: true,
  completedMoneyPaid: true,
  service: { select: { id: true, name: true, defaultPrice: true } },
  serviceItems: {
    select: {
      serviceId: true,
      price: true,
      service: { select: { id: true, name: true } },
    },
  },
  upsells: { select: { totalAmount: true } },
} as const;

export { revenueSummarySelect };
