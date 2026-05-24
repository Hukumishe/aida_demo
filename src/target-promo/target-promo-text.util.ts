/** Нормализация промотекста для поиска (точное совпадение после trim). */
export function normalizeTargetPromoText(raw: string): string {
  return raw.trim();
}
