/** Эффективная длительность и цена услуги мастера с учётом override. */
export function resolveStaffServiceTiming(
  service: { defaultDurationMin: number; defaultPrice: number | null },
  override?: { durationMin: number | null; price: number | null } | null,
): { durationMin: number; price: number | null } {
  return {
    durationMin: override?.durationMin ?? service.defaultDurationMin,
    price: override?.price ?? service.defaultPrice ?? null,
  };
}

export function mapStaffServiceRow<
  T extends {
    serviceId: string;
    service: { defaultDurationMin: number; defaultPrice: number | null; [k: string]: unknown };
    override?: { durationMin: number | null; price: number | null } | null;
  },
>(row: T) {
  const timing = resolveStaffServiceTiming(row.service, row.override ?? null);
  return {
    ...row,
    durationMin: timing.durationMin,
    price: timing.price,
  };
}
