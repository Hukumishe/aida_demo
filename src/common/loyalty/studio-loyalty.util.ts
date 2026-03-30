export type LoyaltyTierLike = {
  id: string;
  sortOrder: number;
  name: string;
  cashbackPercent: number;
  manualOnly: boolean;
};

export type LoyaltyMilestoneLike = {
  minTotalPaid: number;
  targetSortOrder: number;
};

/** Последняя подходящая веха по возрастанию minTotalPaid: при нескольких вехах с одной суммой — последняя в списке после сортировки. */
export function resolveTargetSortOrderFromMilestones(
  milestones: LoyaltyMilestoneLike[],
  totalPaid: number,
): number {
  const sorted = [...milestones].sort((a, b) => a.minTotalPaid - b.minTotalPaid);
  let target = 0;
  for (const m of sorted) {
    if (totalPaid >= m.minTotalPaid) target = m.targetSortOrder;
  }
  return target;
}

export function findAutoTierForSortOrder(
  tiers: LoyaltyTierLike[],
  sortOrder: number,
): LoyaltyTierLike | null {
  const t = tiers.find((x) => x.sortOrder === sortOrder);
  if (!t || t.manualOnly) return null;
  return t;
}

export function resolveAutoTierForTotalPaid(
  tiers: LoyaltyTierLike[],
  milestones: LoyaltyMilestoneLike[],
  totalPaid: number,
): LoyaltyTierLike | null {
  const sortOrder = resolveTargetSortOrderFromMilestones(milestones, totalPaid);
  return findAutoTierForSortOrder(tiers, sortOrder);
}

/** Ближайшая веха с minTotalPaid строго больше текущей суммы (прогресс «до следующего порога»). */
export function nextMilestoneProgress(
  milestones: LoyaltyMilestoneLike[],
  tiers: LoyaltyTierLike[],
  totalPaid: number,
): {
  nextMilestoneMinPaid: number | null;
  nextTargetSortOrder: number | null;
  nextTierName: string | null;
  remainingToNext: number | null;
} {
  const sorted = [...milestones].sort((a, b) => a.minTotalPaid - b.minTotalPaid);
  const next = sorted.find((m) => m.minTotalPaid > totalPaid);
  if (!next) {
    return {
      nextMilestoneMinPaid: null,
      nextTargetSortOrder: null,
      nextTierName: null,
      remainingToNext: null,
    };
  }
  const tier = tiers.find((t) => t.sortOrder === next.targetSortOrder);
  return {
    nextMilestoneMinPaid: next.minTotalPaid,
    nextTargetSortOrder: next.targetSortOrder,
    nextTierName: tier?.name ?? null,
    remainingToNext: Math.max(0, next.minTotalPaid - totalPaid),
  };
}
