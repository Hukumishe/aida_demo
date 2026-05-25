/** Личное время мастера (busy slot) — для журнала: серый блок в UI. */
export const BUSY_SLOT_TYPE_PERSONAL_TIME = 'PERSONAL_TIME' as const;

export function enrichBusySlotForSchedule<T extends { comment?: string | null }>(slot: T) {
  const comment = slot.comment?.trim();
  return {
    ...slot,
    slotType: BUSY_SLOT_TYPE_PERSONAL_TIME,
    displayLabel: comment || 'Личное время',
    uiColorHint: 'gray' as const,
  };
}

export function enrichBusySlotsForSchedule<T extends { comment?: string | null }>(slots: T[]) {
  return slots.map((s) => enrichBusySlotForSchedule(s));
}
