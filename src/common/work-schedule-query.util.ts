import { PrismaService } from './prisma/prisma.service';

/** Как в schedule.service: дата календарного дня в work_schedule_days. */
export function parseWorkScheduleDateInput(dateStr: string): Date {
  const normalized = dateStr.includes('T') ? dateStr.split('T')[0]! : dateStr;
  return new Date(`${normalized}T00:00:00.000Z`);
}

export function todayDateStringInTimeZone(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const d = parseWorkScheduleDateInput(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function workScheduleDateToYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Мастера с хотя бы одним рабочим днём (не выходной) начиная с fromDate. */
export async function findStaffUserIdsWithWorkScheduleFrom(
  prisma: PrismaService,
  studioId: string,
  params: {
    candidateStaffUserIds?: string[];
    fromDateStr: string;
  },
): Promise<Set<string>> {
  const fromDate = parseWorkScheduleDateInput(params.fromDateStr);
  const where: {
    studioId: string;
    isDayOff: boolean;
    date: { gte: Date };
    staffUserId?: { in: string[] };
  } = {
    studioId,
    isDayOff: false,
    date: { gte: fromDate },
  };
  if (params.candidateStaffUserIds?.length) {
    where.staffUserId = { in: params.candidateStaffUserIds };
  }

  const rows = await prisma.workScheduleDay.findMany({
    where,
    select: { staffUserId: true },
    distinct: ['staffUserId'],
  });
  return new Set(rows.map((r) => r.staffUserId));
}

/** Уникальные YYYY-MM-DD, когда у мастеров есть рабочий день в диапазоне [from, to]. */
export async function findWorkingDayStringsInRange(
  prisma: PrismaService,
  studioId: string,
  params: {
    staffUserIds?: string[];
    fromDateStr: string;
    toDateStr: string;
  },
): Promise<string[]> {
  const fromDate = parseWorkScheduleDateInput(params.fromDateStr);
  const toDate = parseWorkScheduleDateInput(params.toDateStr);
  const where: {
    studioId: string;
    isDayOff: boolean;
    date: { gte: Date; lte: Date };
    staffUserId?: { in: string[] };
  } = {
    studioId,
    isDayOff: false,
    date: { gte: fromDate, lte: toDate },
  };
  if (params.staffUserIds?.length) {
    where.staffUserId = { in: params.staffUserIds };
  }

  const rows = await prisma.workScheduleDay.findMany({
    where,
    select: { date: true },
    orderBy: { date: 'asc' },
  });

  const dates = new Set<string>();
  for (const row of rows) {
    dates.add(workScheduleDateToYmd(row.date));
  }
  return [...dates].sort();
}
