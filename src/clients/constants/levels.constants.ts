/**
 * Пороги суммы оплаченных денег (тенге) для уровней и кэшбэк по ТЗ.
 * DIAMOND назначается вручную, кэшбэк 30%.
 */
export const LEVEL_THRESHOLDS: Record<string, { minTotalPaid: number; cashbackPercent: number }> = {
  BRONZE: { minTotalPaid: 0, cashbackPercent: 3 },
  SILVER: { minTotalPaid: 50_000, cashbackPercent: 5 },
  GOLD: { minTotalPaid: 120_000, cashbackPercent: 10 },
  DIAMOND: { minTotalPaid: 0, cashbackPercent: 30 },
};

export const LEVEL_ORDER = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'] as const;

export function getCashbackPercent(level: string): number {
  return LEVEL_THRESHOLDS[level]?.cashbackPercent ?? 3;
}

export function getNextLevel(currentLevel: string): string | null {
  const i = LEVEL_ORDER.indexOf(currentLevel as any);
  if (i < 0 || i >= LEVEL_ORDER.length - 1) return null;
  return LEVEL_ORDER[i + 1];
}

export function getLevelProgress(totalPaidForLevel: number, currentLevel: string): {
  currentTotalPaid: number;
  nextLevel: string | null;
  nextLevelThreshold: number | null;
  remainingToNext: number | null;
} {
  const next = getNextLevel(currentLevel);
  const nextThreshold = next ? LEVEL_THRESHOLDS[next]?.minTotalPaid ?? null : null;
  return {
    currentTotalPaid: totalPaidForLevel,
    nextLevel: next,
    nextLevelThreshold: nextThreshold,
    remainingToNext: nextThreshold != null ? Math.max(0, nextThreshold - totalPaidForLevel) : null,
  };
}

/** Вычисляет уровень по сумме оплаченных деньгами (только BRONZE/SILVER/GOLD; DIAMOND вручную). */
export function getLevelFromTotalPaid(totalPaidForLevel: number): string {
  let level = 'BRONZE';
  for (const l of ['SILVER', 'GOLD'] as const) {
    if (totalPaidForLevel >= (LEVEL_THRESHOLDS[l]?.minTotalPaid ?? 0)) level = l;
  }
  return level;
}
