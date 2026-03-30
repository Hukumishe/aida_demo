import { BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

type Db = Pick<PrismaClient, 'landingPromotionCode' | 'client'>;

export function normalizeReferralCodeInput(raw: string | undefined | null): string | null {
  const t = raw?.trim();
  if (!t) return null;
  return t.toUpperCase();
}

/**
 * Промокоды акций лендинга нельзя подставлять вместо реферального кода клиента при создании клиента.
 */
export async function assertReferralCodeIsNotLandingPromo(
  prisma: Db,
  normalizedCode: string,
): Promise<void> {
  const promo = await prisma.landingPromotionCode.findUnique({
    where: { code: normalizedCode },
  });
  if (promo) {
    throw new BadRequestException(
      'При создании клиента можно указать только реферальный код другого клиента, не промокод акции с лендинга',
    );
  }
}

export async function findReferrerByClientReferralCode(prisma: Db, normalizedCode: string) {
  return prisma.client.findUnique({
    where: { referralCode: normalizedCode },
    select: { id: true, bonuses: true, firstName: true, lastName: true, referralCode: true },
  });
}
