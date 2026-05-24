/** YYYY-MM-DD в часовом поясе IANA. */
export function toWallDateYmd(date: Date, timeZone: string): string {
  return date.toLocaleDateString('en-CA', { timeZone });
}

/** Добавить/вычесть календарные дни от YYYY-MM-DD. */
export function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Следующий день рождения (месяц/день из birthDate) не раньше refYmd. */
export function nextBirthdayYmd(birthDate: Date, refYmd: string): string {
  const month = birthDate.getUTCMonth() + 1;
  const day = birthDate.getUTCDate();
  const refYear = Number(refYmd.slice(0, 4));
  let candidate = `${refYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (candidate < refYmd) {
    candidate = `${refYear + 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return candidate;
}
