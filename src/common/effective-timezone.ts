/** Дефолт, если в БД нет значения (и для обратной совместимости). */
export const DEFAULT_IANA_TIMEZONE = 'Asia/Almaty';

/** Таймзона организации (настройки уровня тенанта: в т.ч. маркетинговые часы Nextbot). */
export function organizationTimezone(org: {
  ianaTimezone?: string | null;
}): string {
  const t = org.ianaTimezone?.trim();
  return t || DEFAULT_IANA_TIMEZONE;
}

/**
 * «Настенные» часы филиала: поле studio.timezone; если пусто — организация.
 * (В схеме у Studio есть default, поэтому обычно используется studio.timezone.)
 */
export function studioWallClockTimezone(
  studio: { timezone?: string | null },
  org?: { ianaTimezone?: string | null } | null,
): string {
  const s = studio.timezone?.trim();
  if (s) return s;
  return organizationTimezone(org ?? {});
}
