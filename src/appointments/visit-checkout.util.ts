import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  VisitCheckoutLine,
  VisitCheckoutSummary,
} from './visit-checkout.types';

type CheckoutAppointment = {
  prepaymentAmount: number | null;
  masterLateFineAmount: number | null;
  client: {
    id: string;
    bonuses: number;
    loyaltyEnabled: boolean | null;
    referredByClientId: string | null;
    referralFirstVisitBonusCredited: boolean | null;
  };
  service: { defaultPrice: number | null };
  serviceItems: Array<{ price: number | null }>;
  upsells: Array<{ totalAmount: number }>;
  studio: {
    organization: {
      referFriendEnabled: boolean;
      referFriendInviteeRewardType: string | null;
      referFriendInviteeValue: number | null;
      globalBonusPaymentLimitPercent: number;
    };
  };
};

export async function computeVisitCheckout(
  prisma: PrismaService,
  appointment: CheckoutAppointment,
  requestedBonus: number,
): Promise<VisitCheckoutSummary> {
  const org = appointment.studio.organization;
  const client = appointment.client;
  const loyaltyEnabled = client.loyaltyEnabled !== false;
  const prepayment = appointment.prepaymentAmount ?? 0;

  const baseAmount =
    appointment.serviceItems.length > 0
      ? appointment.serviceItems.reduce((sum, item) => sum + (item.price ?? 0), 0)
      : (appointment.service.defaultPrice ?? 0);
  const upsellsSum = appointment.upsells.reduce((s, u) => s + u.totalAmount, 0);
  const grossTotal = baseAmount + upsellsSum;

  const doneBefore = await prisma.appointment.count({
    where: { clientId: client.id, status: AppointmentStatus.DONE },
  });
  const referProgramOn = org.referFriendEnabled === true;
  const eligibleFirstVisitReferral =
    !!client.referredByClientId &&
    doneBefore === 0 &&
    !client.referralFirstVisitBonusCredited;
  const applyReferFriendRewards =
    loyaltyEnabled && referProgramOn && eligibleFirstVisitReferral;
  const applyReferFriendDiscount =
    applyReferFriendRewards &&
    org.referFriendInviteeRewardType === 'DISCOUNT_PERCENT' &&
    org.referFriendInviteeValue != null;

  let referFriendDiscountPercent: number | null = null;
  let referFriendDiscountAmount = 0;
  let totalAfterDiscounts = grossTotal;

  if (applyReferFriendDiscount) {
    referFriendDiscountPercent = Math.min(100, Math.max(0, org.referFriendInviteeValue!));
    totalAfterDiscounts = Math.round(
      (grossTotal * (100 - referFriendDiscountPercent)) / 100,
    );
    referFriendDiscountAmount = grossTotal - totalAfterDiscounts;
  }

  const masterLateFineAmount = appointment.masterLateFineAmount ?? 0;
  if (masterLateFineAmount > 0) {
    totalAfterDiscounts = Math.max(0, totalAfterDiscounts - masterLateFineAmount);
  }

  const limitPercent = org.globalBonusPaymentLimitPercent ?? 30;
  const maxBonusesAllowed = Math.floor((totalAfterDiscounts * limitPercent) / 100);
  const bonusesUsed = loyaltyEnabled
    ? Math.min(
        Math.max(0, requestedBonus),
        Math.max(0, client.bonuses),
        maxBonusesAllowed,
      )
    : 0;

  const totalMoneyPaid = totalAfterDiscounts - bonusesUsed;
  const moneyPaidNow = Math.max(0, totalMoneyPaid - prepayment);

  const lines: VisitCheckoutLine[] = [];
  if (upsellsSum > 0) {
    if (baseAmount > 0) {
      lines.push({ kind: 'SERVICES', label: 'Услуги', amount: baseAmount });
    }
    lines.push({ kind: 'UPSELLS', label: 'Допродажи', amount: upsellsSum });
  } else {
    lines.push({ kind: 'SERVICES', label: 'Сумма услуг', amount: grossTotal });
  }
  if (referFriendDiscountAmount > 0) {
    lines.push({
      kind: 'REFER_FRIEND_DISCOUNT',
      label: `Скидка «приведи друга» (${referFriendDiscountPercent}%)`,
      amount: -referFriendDiscountAmount,
    });
  }
  if (masterLateFineAmount > 0) {
    lines.push({
      kind: 'MASTER_LATE_FINE',
      label: 'Скидка за опоздание мастера',
      amount: -masterLateFineAmount,
    });
  }
  if (bonusesUsed > 0) {
    lines.push({
      kind: 'BONUSES',
      label: 'Списано бонусов',
      amount: -bonusesUsed,
    });
  }
  if (prepayment > 0) {
    lines.push({
      kind: 'PREPAYMENT',
      label: 'Уже оплачено (предоплата)',
      amount: -prepayment,
    });
  }

  return {
    grossTotal,
    baseAmount,
    upsellsSum,
    referFriendDiscountPercent,
    referFriendDiscountAmount,
    masterLateFineAmount,
    totalAfterDiscounts,
    prepaymentAmount: prepayment,
    globalBonusPaymentLimitPercent: limitPercent,
    maxBonusesAllowed,
    clientBonusesAvailable: Math.max(0, client.bonuses),
    bonusesUsed,
    totalMoneyPaid,
    moneyPaidNow,
    loyaltyEnabled,
    applyReferFriendRewards,
    eligibleFirstVisitReferral,
    lines,
  };
}
