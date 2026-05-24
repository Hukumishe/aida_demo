/** Статус активации промотекста Target (поле activationStatus в ответе API). */
export enum TargetPromoActivationStatus {
  NOT_MATCHED = 'NOT_MATCHED',
  EXHAUSTED = 'EXHAUSTED',
  MATCHED = 'MATCHED',
}

export const TARGET_PROMO_PROMPT_KEYS: Record<TargetPromoActivationStatus, string> = {
  [TargetPromoActivationStatus.NOT_MATCHED]: 'target_promo_not_matched',
  [TargetPromoActivationStatus.EXHAUSTED]: 'target_promo_exhausted',
  [TargetPromoActivationStatus.MATCHED]: 'target_promo',
};

export const TARGET_PROMO_PROMPT_FALLBACKS: Record<TargetPromoActivationStatus, string> = {
  [TargetPromoActivationStatus.NOT_MATCHED]:
    'Промотекст не распознан. Вежливо уточни, откуда клиент узнал об акции, или предложи записаться в обычном режиме.',
  [TargetPromoActivationStatus.EXHAUSTED]:
    'Акция по этому промотексту уже исчерпала лимит активаций. Сообщи клиенту об этом и предложи записаться без акции или уточни у администратора.',
  [TargetPromoActivationStatus.MATCHED]: '',
};

export function targetPromoPromptKeyForId(promoId: string): string {
  return `target_promo_${promoId}`;
}
