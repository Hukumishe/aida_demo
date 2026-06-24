import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { LandingPromotionType, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  getDisabledCategoryIdsForStudio,
  getDisabledServiceIdsForStudio,
  isServiceOfferedInStudio,
} from '../service-studio-offering';

type Db = Pick<
  PrismaClient,
  'landingPromotionCode' | 'service' | 'studio'
>;

export type AppliedLandingPromo = {
  codeId: string;
  code: string;
  promotionId: string;
  type: LandingPromotionType;
  title: string;
  description: string | null;
  discountPercent: number | null;
  bundlePrice: number | null;
};

export type LandingPromoClientPayload = {
  code: string;
  promotionId: string;
  type: LandingPromotionType;
  title: string;
  description: string | null;
  discountPercent: number | null;
  bundlePrice: number | null;
  appliedServiceIds: string[];
};

export function landingPromoToClientPayload(
  applied: AppliedLandingPromo,
  appliedServiceIds: string[],
): LandingPromoClientPayload {
  return {
    code: applied.code,
    promotionId: applied.promotionId,
    type: applied.type,
    title: applied.title,
    description: applied.description,
    discountPercent: applied.discountPercent,
    bundlePrice: applied.bundlePrice,
    appliedServiceIds,
  };
}

export function formatLandingPromoComment(applied: AppliedLandingPromo): string {
  const parts = [`Акция «${applied.title}»`, `промокод ${applied.code}`];
  if (applied.description?.trim()) {
    parts.push(applied.description.trim());
  }
  if (applied.type === 'DISCOUNT' && applied.discountPercent != null) {
    parts.push(`скидка ${applied.discountPercent}%`);
  }
  if (
    (applied.type === 'ONE_PLUS_ONE' || applied.type === 'SERVICE_BUNDLE') &&
    applied.bundlePrice != null
  ) {
    parts.push(`цена по акции ${applied.bundlePrice} ₸`);
  }
  return parts.join(', ');
}

export function normalizeLandingPromoCode(raw: string | undefined | null): string {
  const code = raw?.trim().toUpperCase();
  if (!code) {
    throw new BadRequestException('Promo code is required');
  }
  return code;
}

/**
 * Проверяет промокод акции лендинга и готовит данные для применения к записи.
 * @param appointmentServiceIds — услуги в записи; пустой массив = только проверка кода (callback).
 */
export async function resolveLandingPromoForBooking(
  prisma: Db,
  params: {
    organizationId: string;
    studioId: string;
    rawCode: string;
    appointmentServiceIds: string[];
  },
): Promise<AppliedLandingPromo> {
  const code = normalizeLandingPromoCode(params.rawCode);

  const codeRow = await prisma.landingPromotionCode.findUnique({
    where: { code },
    include: {
      promotion: {
        include: {
          services: {
            include: {
              service: { include: { category: true } },
            },
          },
        },
      },
    },
  });

  if (!codeRow || codeRow.promotion.organizationId !== params.organizationId) {
    throw new NotFoundException('Promo code not found');
  }
  if (!codeRow.isActive || !codeRow.promotion.isActive) {
    throw new BadRequestException('Promo code is inactive');
  }
  const now = new Date();
  const promotion = codeRow.promotion;
  if (promotion.validUntil && promotion.validUntil <= now) {
    throw new BadRequestException('Promotion has ended');
  }
  if (codeRow.expiresAt && codeRow.expiresAt < now) {
    throw new BadRequestException('Promo code has expired');
  }
  if (codeRow.usageLimit != null && codeRow.usedCount >= codeRow.usageLimit) {
    throw new BadRequestException('Promo code usage limit reached');
  }

  const [disabledServiceIds, disabledCategoryIds] = await Promise.all([
    getDisabledServiceIdsForStudio(prisma as unknown as PrismaService, params.studioId),
    getDisabledCategoryIdsForStudio(prisma as unknown as PrismaService, params.studioId),
  ]);

  const serviceIds = [...new Set(params.appointmentServiceIds.map((id) => id.trim()).filter(Boolean))];

  const base: AppliedLandingPromo = {
    codeId: codeRow.id,
    code,
    promotionId: promotion.id,
    type: promotion.type,
    title: promotion.title,
    description: promotion.description,
    discountPercent: promotion.discountPercent,
    bundlePrice: promotion.bundlePrice,
  };

  if (serviceIds.length === 0) {
    return base;
  }

  if (promotion.type === 'DISCOUNT') {
    const allowedIds = new Set(
      promotion.services
        .map((x) => x.service)
        .filter(
          (s) =>
            s &&
            isServiceOfferedInStudio(s, s.category, disabledServiceIds, disabledCategoryIds),
        )
        .map((s) => s!.id),
    );
    for (const sid of serviceIds) {
      if (!allowedIds.has(sid)) {
        throw new BadRequestException(
          `Услуга не участвует в акции «${promotion.title}»`,
        );
      }
    }
    return base;
  }

  if (promotion.type === 'ONE_PLUS_ONE') {
    if (!promotion.serviceIdA || !promotion.serviceIdB || promotion.bundlePrice == null) {
      throw new BadRequestException('ONE_PLUS_ONE promotion is misconfigured');
    }
    const required = [promotion.serviceIdA, promotion.serviceIdB].sort().join(',');
    const got = [...serviceIds].sort().join(',');
    if (required !== got) {
      throw new BadRequestException(
        `Для акции «${promotion.title}» нужно выбрать обе услуги: 1+1`,
      );
    }
    for (const sid of [promotion.serviceIdA, promotion.serviceIdB]) {
      await assertServiceInStudioForPromo(
        prisma,
        params.organizationId,
        params.studioId,
        sid,
        disabledServiceIds,
        disabledCategoryIds,
        promotion.title,
      );
    }
    return base;
  }

  if (promotion.type === 'SERVICE_BUNDLE') {
    if (promotion.bundlePrice == null) {
      throw new BadRequestException('SERVICE_BUNDLE promotion is misconfigured');
    }
    const requiredIds = promotion.services.map((x) => x.serviceId).sort();
    const gotIds = [...serviceIds].sort();
    if (
      requiredIds.length !== gotIds.length ||
      requiredIds.some((id, i) => id !== gotIds[i])
    ) {
      throw new BadRequestException(
        `Для акции «${promotion.title}» нужно выбрать все услуги набора`,
      );
    }
    for (const sid of serviceIds) {
      await assertServiceInStudioForPromo(
        prisma,
        params.organizationId,
        params.studioId,
        sid,
        disabledServiceIds,
        disabledCategoryIds,
        promotion.title,
      );
    }
    return base;
  }

  throw new BadRequestException('Unsupported promotion type');
}

async function assertServiceInStudioForPromo(
  prisma: Db,
  organizationId: string,
  studioId: string,
  serviceId: string,
  disabledServiceIds: Set<string>,
  disabledCategoryIds: Set<string>,
  promotionTitle: string,
): Promise<void> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, organizationId, isActive: true },
    include: { category: true },
  });
  if (
    !service ||
    !isServiceOfferedInStudio(service, service.category, disabledServiceIds, disabledCategoryIds)
  ) {
    throw new BadRequestException(`Услуга недоступна в филиале для акции «${promotionTitle}»`);
  }
}

/** Применяет цены акции к строкам услуг записи (после resolveAppointmentServices). */
export function applyLandingPromoPrices(
  resolvedServices: Array<{ serviceId: string; price: number | null }>,
  applied: AppliedLandingPromo,
): void {
  if (applied.type === 'DISCOUNT') {
    const pct = applied.discountPercent ?? 0;
    if (pct <= 0) return;
    for (const row of resolvedServices) {
      const base = row.price ?? 0;
      row.price = Math.round((base * (100 - pct)) / 100);
    }
    return;
  }

  const bundlePrice = applied.bundlePrice;
  if (bundlePrice == null) return;

  const bases = resolvedServices.map((r) => ({
    row: r,
    base: Math.max(0, r.price ?? 0),
  }));
  const totalBase = bases.reduce((sum, b) => sum + b.base, 0);

  if (totalBase <= 0) {
    const each = Math.floor(bundlePrice / bases.length);
    bases.forEach((b, idx) => {
      b.row.price =
        idx === bases.length - 1
          ? bundlePrice - each * (bases.length - 1)
          : each;
    });
    return;
  }

  let allocated = 0;
  bases.forEach((b, idx) => {
    if (idx === bases.length - 1) {
      b.row.price = bundlePrice - allocated;
    } else {
      const share = Math.round((bundlePrice * b.base) / totalBase);
      b.row.price = share;
      allocated += share;
    }
  });
}

export async function incrementLandingPromoUsedCount(
  tx: Pick<PrismaClient, 'landingPromotionCode'>,
  codeId: string,
): Promise<void> {
  await tx.landingPromotionCode.update({
    where: { id: codeId },
    data: { usedCount: { increment: 1 } },
  });
}
