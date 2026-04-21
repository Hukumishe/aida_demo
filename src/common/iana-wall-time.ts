import { BadRequestException } from '@nestjs/common';

/** Берёт календарную дату YYYY-MM-DD из строки фронта (`2026-04-21`, ISO, `2026-04-21 00:00:00`). */
export function normalizeCalendarDateStr(input: string): string {
  const s = input.trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) {
    throw new BadRequestException(`Invalid calendar date: ${input}`);
  }
  return m[1];
}

function padHhMmToIsoTime(raw: string): string {
  const p = raw.trim().split(':');
  const h = parseInt(p[0], 10);
  const m = parseInt(p[1] ?? '0', 10);
  const s = parseInt(p[2] ?? '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s)) {
    throw new BadRequestException(`Invalid time format: ${raw}`);
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function buildWallClockMatcher(timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  });
}

/**
 * UTC-момент, когда в зоне `timeZone` на дате `dateStr` наступает локальное время `hhMm`
 * (формат HH:MM или HH:MM:SS). Перебор вокруг полудня UTC для устойчивости к DST и смещениям UTC±14.
 */
export function utcAtWallClockInTimeZone(
  dateStr: string,
  hhMm: string,
  timeZone: string,
): Date {
  const normDate = normalizeCalendarDateStr(dateStr);
  const time = padHhMmToIsoTime(hhMm);
  const [Y, M, D] = normDate.split('-').map((x) => parseInt(x, 10));
  const [h, mi, s] = time.split(':').map((x) => parseInt(x, 10));
  const dtf = buildWallClockMatcher(timeZone);
  const anchor = Date.UTC(Y, M - 1, D, 12, 0, 0);
  const windowMs = 52 * 3600 * 1000;
  for (let delta = -windowMs; delta <= windowMs; delta += 60 * 1000) {
    const t = anchor + delta;
    const parts = Object.fromEntries(
      dtf
        .formatToParts(new Date(t))
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, parseInt(p.value, 10)]),
    ) as Record<string, number>;
    let hour = parts.hour ?? 0;
    if (hour === 24) {
      hour = 0;
    }
    if (
      parts.year === Y &&
      parts.month === M &&
      parts.day === D &&
      hour === h &&
      parts.minute === mi &&
      (parts.second ?? 0) === s
    ) {
      return new Date(t);
    }
  }
  throw new BadRequestException(
    `Invalid local time ${normDate} ${hhMm} in ${timeZone}`,
  );
}

/** Интервал [dayStart, nextDayStart) в UTC для календарного дня `dateStr` (YYYY-MM-DD) в зоне `timeZone`. */
export function zonedDayRangeUtc(
  dateStr: string,
  timeZone: string,
): { dayStart: Date; nextDayStart: Date } {
  const norm = normalizeCalendarDateStr(dateStr);
  const dayStart = utcAtWallClockInTimeZone(norm, '00:00:00', timeZone);
  const dtf = new Intl.DateTimeFormat('en-CA', { timeZone });
  let t = dayStart.getTime() + 60 * 1000;
  const max = dayStart.getTime() + 52 * 3600 * 1000;
  while (t < max && dtf.format(new Date(t)) === norm) {
    t += 60 * 1000;
  }
  const nextStr = normalizeCalendarDateStr(dtf.format(new Date(t)));
  const nextDayStart = utcAtWallClockInTimeZone(nextStr, '00:00:00', timeZone);
  return { dayStart, nextDayStart };
}

export function extractLocalTimeHHMM(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(date);
  let hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  if (hh === '24') {
    hh = '00';
  }
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hh}:${mm}`;
}
