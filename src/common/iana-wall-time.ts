import { BadRequestException } from '@nestjs/common';

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

/**
 * UTC-момент, когда в зоне `timeZone` на дате `dateStr` наступает локальное время `hhMm`
 * (формат HH:MM или HH:MM:SS). Перебор вокруг полудня UTC для устойчивости к DST.
 */
export function utcAtWallClockInTimeZone(
  dateStr: string,
  hhMm: string,
  timeZone: string,
): Date {
  const time = padHhMmToIsoTime(hhMm);
  const [Y, M, D] = dateStr.split('-').map((x) => parseInt(x, 10));
  const [h, mi, s] = time.split(':').map((x) => parseInt(x, 10));
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const anchor = Date.UTC(Y, M - 1, D, 12, 0, 0);
  for (let delta = -24 * 3600 * 1000; delta <= 24 * 3600 * 1000; delta += 60 * 1000) {
    const t = anchor + delta;
    const parts = Object.fromEntries(
      dtf
        .formatToParts(new Date(t))
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, parseInt(p.value, 10)]),
    ) as Record<string, number>;
    if (
      parts.year === Y &&
      parts.month === M &&
      parts.day === D &&
      parts.hour === h &&
      parts.minute === mi &&
      (parts.second ?? 0) === s
    ) {
      return new Date(t);
    }
  }
  throw new BadRequestException(
    `Invalid local time ${dateStr} ${hhMm} in ${timeZone}`,
  );
}

/** Интервал [dayStart, nextDayStart) в UTC для календарного дня `dateStr` (YYYY-MM-DD) в зоне `timeZone`. */
export function zonedDayRangeUtc(
  dateStr: string,
  timeZone: string,
): { dayStart: Date; nextDayStart: Date } {
  const dayStart = utcAtWallClockInTimeZone(dateStr, '00:00:00', timeZone);
  const dtf = new Intl.DateTimeFormat('en-CA', { timeZone });
  let t = dayStart.getTime() + 60 * 1000;
  const max = dayStart.getTime() + 49 * 3600 * 1000;
  while (t < max && dtf.format(new Date(t)) === dateStr) {
    t += 60 * 1000;
  }
  const nextStr = dtf.format(new Date(t));
  const nextDayStart = utcAtWallClockInTimeZone(nextStr, '00:00:00', timeZone);
  return { dayStart, nextDayStart };
}

export function extractLocalTimeHHMM(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hh}:${mm}`;
}
