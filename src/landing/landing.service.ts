import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateLandingPromotionDto } from './dto/create-promotion.dto';
import { UpdateLandingPromotionDto } from './dto/update-promotion.dto';
import { UpdateLandingMastersDto } from './dto/update-masters.dto';
import { CreateLandingServiceCardDto } from './dto/create-service-card.dto';
import { UpdateLandingServiceCardDto } from './dto/update-service-card.dto';
import { ReorderLandingServiceCardsDto } from './dto/reorder-service-cards.dto';
import { generateId, IdPrefix } from '../common/id-generator';
import { isOwnerLevelRole } from '../common/decorators/roles.decorator';

@Injectable()
export class LandingService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Promotions ---

  async getPromotions(studioId: string) {
    const now = new Date();
    return this.prisma.landingPromotion.findMany({
      where: {
        studioId,
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
      include: {
        services: {
          include: { service: true },
        },
        codes: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolvePromotionCode(studioId: string, rawCode: string) {
    const code = rawCode?.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('Promo code is required');
    }

    const codeRow = await this.prisma.landingPromotionCode.findUnique({
      where: { code },
      include: {
        promotion: {
          include: {
            services: {
              include: {
                service: true,
              },
            },
          },
        },
      },
    });

    if (!codeRow || codeRow.promotion.studioId !== studioId) {
      throw new NotFoundException('Promo code not found');
    }
    if (!codeRow.isActive || !codeRow.promotion.isActive) {
      throw new BadRequestException('Promo code is inactive');
    }
    const now = new Date();
    if (codeRow.promotion.validUntil && codeRow.promotion.validUntil <= now) {
      throw new BadRequestException('Promotion has ended');
    }
    if (codeRow.expiresAt && codeRow.expiresAt < now) {
      throw new BadRequestException('Promo code has expired');
    }
    if (codeRow.usageLimit != null && codeRow.usedCount >= codeRow.usageLimit) {
      throw new BadRequestException('Promo code usage limit reached');
    }

    const promotion = codeRow.promotion;
    if (promotion.type === 'ONE_PLUS_ONE') {
      if (!promotion.serviceIdA || !promotion.serviceIdB || promotion.bundlePrice == null) {
        throw new BadRequestException('ONE_PLUS_ONE promotion is misconfigured');
      }
      const services = await this.prisma.service.findMany({
        where: {
          studioId,
          isActive: true,
          id: { in: [promotion.serviceIdA, promotion.serviceIdB] },
        },
        select: {
          id: true,
          name: true,
          defaultPrice: true,
          defaultDurationMin: true,
        },
      });
      return {
        code,
        promotionId: promotion.id,
        type: promotion.type,
        title: promotion.title,
        description: promotion.description,
        autoFill: {
          mode: 'ONE_PLUS_ONE',
          serviceIds: [promotion.serviceIdA, promotion.serviceIdB],
          services,
          finalPrice: promotion.bundlePrice,
        },
      };
    }

    if (promotion.type === 'SERVICE_BUNDLE') {
      const services = promotion.services
        .map((x) => x.service)
        .filter((s) => s.studioId === studioId && s.isActive)
        .map((s) => ({
          id: s.id,
          name: s.name,
          defaultPrice: s.defaultPrice,
          defaultDurationMin: s.defaultDurationMin,
        }));
      return {
        code,
        promotionId: promotion.id,
        type: promotion.type,
        title: promotion.title,
        description: promotion.description,
        autoFill: {
          mode: 'SERVICE_BUNDLE',
          serviceIds: services.map((s) => s.id),
          services,
          finalPrice: promotion.bundlePrice,
        },
      };
    }

    if (promotion.type === 'DISCOUNT') {
      const discountPercent = promotion.discountPercent ?? 0;
      const services = promotion.services
        .map((x) => x.service)
        .filter((s) => s.studioId === studioId && s.isActive)
        .map((s) => ({
          id: s.id,
          name: s.name,
          defaultPrice: s.defaultPrice ?? 0,
          defaultDurationMin: s.defaultDurationMin,
          discountedPrice: Math.round(((s.defaultPrice ?? 0) * (100 - discountPercent)) / 100),
        }));
      return {
        code,
        promotionId: promotion.id,
        type: promotion.type,
        title: promotion.title,
        description: promotion.description,
        autoFill: {
          mode: 'DISCOUNT',
          discountPercent,
          serviceIds: services.map((s) => s.id),
          defaultServiceId: services[0]?.id ?? null,
          services,
        },
      };
    }

    throw new BadRequestException('Unsupported promotion type');
  }

  async createPromotion(
    studioId: string,
    dto: CreateLandingPromotionDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

    if (dto.type === 'DISCOUNT') {
      if (!dto.discountPercent || !dto.serviceIds || dto.serviceIds.length === 0) {
        throw new BadRequestException('DISCOUNT promotion must have discountPercent and serviceIds');
      }
    }
    if (dto.type === 'ONE_PLUS_ONE') {
      if (!dto.serviceIdA || !dto.serviceIdB || dto.bundlePrice == null) {
        throw new BadRequestException('ONE_PLUS_ONE promotion must have serviceIdA, serviceIdB and bundlePrice');
      }
    }
    if (dto.type === 'SERVICE_BUNDLE') {
      const ids = dto.serviceIds ?? [];
      const unique = [...new Set(ids)];
      if (unique.length < 2 || dto.bundlePrice == null) {
        throw new BadRequestException(
          'SERVICE_BUNDLE promotion must have at least 2 distinct serviceIds and bundlePrice',
        );
      }
    }

    const promotion = await this.prisma.landingPromotion.create({
      data: {
        id: generateId(IdPrefix.LandingPromotion),
        studioId,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        isActive: dto.isActive ?? true,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        discountPercent: dto.type === 'DISCOUNT' ? dto.discountPercent ?? null : null,
        serviceIdA: dto.type === 'ONE_PLUS_ONE' ? dto.serviceIdA ?? null : null,
        serviceIdB: dto.type === 'ONE_PLUS_ONE' ? dto.serviceIdB ?? null : null,
        bundlePrice:
          dto.type === 'ONE_PLUS_ONE' || dto.type === 'SERVICE_BUNDLE'
            ? dto.bundlePrice ?? null
            : null,
        services:
          (dto.type === 'DISCOUNT' || dto.type === 'SERVICE_BUNDLE') && dto.serviceIds?.length
            ? {
                create: [...new Set(dto.serviceIds)].map((serviceId) => ({
                  id: generateId(IdPrefix.LandingPromotionService),
                  serviceId,
                })),
              }
            : undefined,
      },
    });

    // Автоматически создаём один промокод для акции
    const code = await this.generatePromoCode();
    await this.prisma.landingPromotionCode.create({
      data: {
        id: generateId(IdPrefix.LandingPromotionCode),
        promotionId: promotion.id,
        code,
      },
    });

    return this.prisma.landingPromotion.findUnique({
      where: { id: promotion.id },
      include: {
        services: {
          include: { service: true },
        },
        codes: true,
      },
    });
  }

  async updatePromotion(
    studioId: string,
    id: string,
    dto: UpdateLandingPromotionDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

    const existing = await this.prisma.landingPromotion.findFirst({
      where: { id, studioId },
    });
    if (!existing) {
      throw new NotFoundException('Promotion not found');
    }

    // Обновление связей услуг для DISCOUNT и SERVICE_BUNDLE
    if ((existing.type === 'DISCOUNT' || existing.type === 'SERVICE_BUNDLE') && dto.serviceIds) {
      if (existing.type === 'SERVICE_BUNDLE') {
        const unique = [...new Set(dto.serviceIds)];
        if (unique.length < 2) {
          throw new BadRequestException('SERVICE_BUNDLE must have at least 2 distinct serviceIds');
        }
      }
      await this.prisma.$transaction([
        this.prisma.landingPromotionService.deleteMany({
          where: { promotionId: id },
        }),
        ...[...new Set(dto.serviceIds)].map((serviceId) =>
          this.prisma.landingPromotionService.create({
            data: {
              id: generateId(IdPrefix.LandingPromotionService),
              promotionId: id,
              serviceId,
            },
          }),
        ),
      ]);
    }

    const updated = await this.prisma.landingPromotion.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        description: dto.description ?? undefined,
        isActive: dto.isActive ?? undefined,
        validUntil:
          dto.validUntil === undefined
            ? undefined
            : dto.validUntil === null
              ? null
              : new Date(dto.validUntil),
        discountPercent:
          existing.type === 'DISCOUNT' ? dto.discountPercent ?? existing.discountPercent : existing.discountPercent,
        serviceIdA:
          existing.type === 'ONE_PLUS_ONE' ? dto.serviceIdA ?? existing.serviceIdA : existing.serviceIdA,
        serviceIdB:
          existing.type === 'ONE_PLUS_ONE' ? dto.serviceIdB ?? existing.serviceIdB : existing.serviceIdB,
        bundlePrice:
          existing.type === 'ONE_PLUS_ONE' || existing.type === 'SERVICE_BUNDLE'
            ? dto.bundlePrice ?? existing.bundlePrice
            : existing.bundlePrice,
      },
      include: {
        services: {
          include: { service: true },
        },
        codes: true,
      },
    });

    return updated;
  }

  async deletePromotion(
    studioId: string,
    id: string,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

    const existing = await this.prisma.landingPromotion.findFirst({
      where: { id, studioId },
    });
    if (!existing) {
      throw new NotFoundException('Promotion not found');
    }

    await this.prisma.landingPromotion.delete({ where: { id } });
    return { success: true };
  }

  // --- Masters ---

  async getMasters(studioId: string) {
    const [configs, staff] = await Promise.all([
      this.prisma.landingMaster.findMany({
        where: { studioId },
        orderBy: { order: 'asc' },
      }),
      this.prisma.user.findMany({
        where: { studioId, isActive: true },
        include: { staffProfile: true },
      }),
    ]);

    const byStaffId = new Map(configs.map((c) => [c.staffUserId, c]));

    return staff.map((u) => {
      const cfg = byStaffId.get(u.id);
      return {
        staffUserId: u.id,
        isVisible: cfg?.isVisible ?? false,
        order: cfg?.order ?? 0,
        staff: u,
      };
    });
  }

  async updateMasters(
    studioId: string,
    dto: UpdateLandingMastersDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

    const staffIds = dto.items.map((i) => i.staffUserId);
    const existingStaff = await this.prisma.user.findMany({
      where: { id: { in: staffIds }, studioId },
      select: { id: true },
    });
    const validIds = new Set(existingStaff.map((s) => s.id));

    const filtered = dto.items.filter((i) => validIds.has(i.staffUserId));

    await this.prisma.$transaction(async (tx) => {
      await tx.landingMaster.deleteMany({ where: { studioId } });
      for (const i of filtered) {
        await tx.landingMaster.create({
          data: {
            id: generateId(IdPrefix.LandingMaster),
            studioId,
            staffUserId: i.staffUserId,
            isVisible: i.isVisible,
            order: i.order,
          },
        });
      }
    });

    return this.getMasters(studioId);
  }

  // --- Services ---

  async getServiceCards(studioId: string) {
    return this.prisma.landingServiceCard.findMany({
      where: { studioId },
      include: {
        service: true,
      },
      orderBy: { order: 'asc' },
    });
  }

  async createServiceCard(
    studioId: string,
    dto: CreateLandingServiceCardDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, studioId },
    });
    if (!service) {
      throw new NotFoundException('Service not found in this studio');
    }

    const count = await this.prisma.landingServiceCard.count({
      where: { studioId },
    });

    return this.prisma.landingServiceCard.create({
      data: {
        id: generateId(IdPrefix.LandingServiceCard),
        studioId,
        serviceId: dto.serviceId,
        title: dto.title ?? null,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        order: dto.order ?? count,
      },
      include: { service: true },
    });
  }

  async updateServiceCard(
    studioId: string,
    id: string,
    dto: UpdateLandingServiceCardDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

    const existing = await this.prisma.landingServiceCard.findFirst({
      where: { id, studioId },
    });
    if (!existing) {
      throw new NotFoundException('Service card not found');
    }

    return this.prisma.landingServiceCard.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        description: dto.description ?? undefined,
        imageUrl: dto.imageUrl ?? undefined,
      },
      include: { service: true },
    });
  }

  async deleteServiceCard(
    studioId: string,
    id: string,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

    const existing = await this.prisma.landingServiceCard.findFirst({
      where: { id, studioId },
    });
    if (!existing) {
      throw new NotFoundException('Service card not found');
    }

    await this.prisma.landingServiceCard.delete({ where: { id } });
    return { success: true };
  }

  async reorderServiceCards(
    studioId: string,
    dto: ReorderLandingServiceCardsDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

    const ids = dto.items.map((i) => i.id);
    const existing = await this.prisma.landingServiceCard.findMany({
      where: { id: { in: ids }, studioId },
      select: { id: true },
    });
    const validIds = new Set(existing.map((c) => c.id));

    const updates = dto.items.filter((i) => validIds.has(i.id));

    await this.prisma.$transaction(
      updates.map((i) =>
        this.prisma.landingServiceCard.update({
          where: { id: i.id },
          data: { order: i.order },
        }),
      ),
    );

    return this.getServiceCards(studioId);
  }

  // --- Helpers ---

  private ensureStudioAccess(studioId: string, userRole?: string, userStudioId?: string) {
    if (!isOwnerLevelRole(userRole)) {
      if (userStudioId !== studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }
    }
  }

  private async generatePromoCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const length = 8;

    for (let attempt = 0; attempt < 50; attempt++) {
      let code = '';
      for (let i = 0; i < length; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      const existing = await this.prisma.landingPromotionCode.findUnique({
        where: { code },
      });
      if (!existing) return code;
    }

    throw new BadRequestException('Could not generate unique promo code');
  }
}

