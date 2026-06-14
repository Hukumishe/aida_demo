export type VisitCheckoutLineKind =
  | 'SERVICES'
  | 'UPSELLS'
  | 'REFER_FRIEND_DISCOUNT'
  | 'MASTER_LATE_FINE'
  | 'BONUSES'
  | 'PREPAYMENT';

export type VisitCheckoutLine = {
  kind: VisitCheckoutLineKind;
  label: string;
  /** Положительное — начисление, отрицательное — скидка/списание. */
  amount: number;
};

export type VisitCheckoutSummary = {
  grossTotal: number;
  baseAmount: number;
  upsellsSum: number;
  referFriendDiscountPercent: number | null;
  referFriendDiscountAmount: number;
  masterLateFineAmount: number;
  /** Стоимость визита после скидок, до бонусов. */
  totalAfterDiscounts: number;
  prepaymentAmount: number;
  globalBonusPaymentLimitPercent: number;
  maxBonusesAllowed: number;
  clientBonusesAvailable: number;
  bonusesUsed: number;
  /** Вся оплата деньгами за визит (включая ранее внесённую предоплату). */
  totalMoneyPaid: number;
  /** Сумма к оплате на кассе сейчас. */
  moneyPaidNow: number;
  loyaltyEnabled: boolean;
  applyReferFriendRewards: boolean;
  eligibleFirstVisitReferral: boolean;
  lines: VisitCheckoutLine[];
};
