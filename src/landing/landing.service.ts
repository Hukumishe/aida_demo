import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  AppointmentCreatedSource,
  UserRole as PrismaUserRole,
  WaitlistEntrySource,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { AvailabilityService } from '../availability/availability.service';
import { ClientsService } from '../clients/clients.service';
import { LandingBookingRequestDto } from './dto/landing-booking-request.dto';
import { UserRole } from '../common/decorators/roles.decorator';
import { CreateLandingPromotionDto } from './dto/create-promotion.dto';
import { UpdateLandingPromotionDto } from './dto/update-promotion.dto';
import { UpdateLandingMastersDto } from './dto/update-masters.dto';
import { CreateLandingServiceCardDto } from './dto/create-service-card.dto';
import { UpdateLandingServiceCardDto } from './dto/update-service-card.dto';
import { ReorderLandingServiceCardsDto } from './dto/reorder-service-cards.dto';
import { CreateLandingCategoryCardDto } from './dto/create-category-card.dto';
import { UpdateLandingCategoryCardDto } from './dto/update-category-card.dto';
import { ReorderLandingCategoryCardsDto } from './dto/reorder-category-cards.dto';
import { UpdateLandingWhatsAppSettingsDto } from './dto/update-whatsapp-settings.dto';
import { generateId, IdPrefix } from '../common/id-generator';
import {
  assertUserOrganizationMatchesStudio,
  assertUserOrganizationMatchesOrganizationId,
  getOrganizationIdForStudio,
} from '../common/organization-scope';
import {
  assertServiceBookableAtStudio,
  assertCategoryOfferedAtStudio,
  getDisabledServiceIdsForStudio,
  getDisabledCategoryIdsForStudio,
  isCategoryOfferedInStudio,
  isServiceOfferedInStudio,
} from '../common/service-studio-offering';
import { getStaffUserIdsOfferingAllServicesInStudio } from '../common/staff-service-offering';
import { isDeveloperRole, hasOrganizationWideStudioAccess } from '../common/decorators/roles.decorator';
import { ServicesService } from '../services/services.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  assertLandingMasterStaffIdsBelongToOrganization,
  filterLandingMastersForStudio,
  findOrganizationLandingStaff,
  mapStaffToLandingMasterItems,
} from './landing-masters.util';
import {
  formatLandingPromoComment,
  incrementLandingPromoUsedCount,
  landingPromoToClientPayload,
  resolveLandingPromoForBooking,
  type LandingPromoClientPayload,
} from '../common/landing-promo/landing-promo-booking.util';

function normalizeLandingPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }
  return raw.trim();
}

function buildWhatsAppDeepLink(phone: string | null, text: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  const encodedText = text?.trim() ? encodeURIComponent(text.trim()) : '';
  return encodedText
    ? `https://wa.me/${digits}?text=${encodedText}`
    : `https://wa.me/${digits}`;
}

@Injectable()
export class LandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servicesService: ServicesService,
    private readonly appointmentsService: AppointmentsService,
    private readonly availabilityService: AvailabilityService,
    private readonly clientsService: ClientsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Каталог услуг организации для выпадающего списка при создании карточки лендинга.
   * Не путать с getServiceCards — там уже сохранённые карточки.
   */
  getServiceCatalogForLandingCards(
    studioId: string,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
  ) {
    return this.servicesService.findAll(
      userRole,
      userStudioId,
      userOrganizationId,
      undefined,
      studioId,
    );
  }

  getCategoryCatalogForLandingCards(
    studioId: string,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
  ) {
    return this.servicesService.findCategories(
      userRole,
      userStudioId,
      userOrganizationId,
      undefined,
      studioId,
    );
  }

  async getWhatsAppSettings(studioId: string) {
    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        landingWhatsappPhone: true,
        landingWhatsappPrefillMessage: true,
      },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return {
      whatsappPhone: org.landingWhatsappPhone,
      whatsappPrefillMessage: org.landingWhatsappPrefillMessage,
      whatsappUrl: buildWhatsAppDeepLink(
        org.landingWhatsappPhone,
        org.landingWhatsappPrefillMessage,
      ),
    };
  }

  async updateWhatsAppSettings(
    studioId: string,
    dto: UpdateLandingWhatsAppSettingsDto,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
  ) {
    await this.ensureStudioAccess(studioId, userRole, userStudioId, userOrganizationId);
    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);
    const data: {
      landingWhatsappPhone?: string | null;
      landingWhatsappPrefillMessage?: string | null;
    } = {};
    if (dto.whatsappPhone !== undefined) {
      const raw = dto.whatsappPhone ?? '';
      const normalized = raw.trim() ? normalizeLandingPhone(raw) : null;
      data.landingWhatsappPhone = normalized;
    }
    if (dto.whatsappPrefillMessage !== undefined) {
      const raw = dto.whatsappPrefillMessage ?? '';
      const message = raw.trim();
      data.landingWhatsappPrefillMessage = message || null;
    }
    const org = await this.prisma.organization.update({
      where: { id: organizationId },
      data,
      select: {
        landingWhatsappPhone: true,
        landingWhatsappPrefillMessage: true,
      },
    });
    return {
      whatsappPhone: org.landingWhatsappPhone,
      whatsappPrefillMessage: org.landingWhatsappPrefillMessage,
      whatsappUrl: buildWhatsAppDeepLink(
        org.landingWhatsappPhone,
        org.landingWhatsappPrefillMessage,
      ),
    };
  }

  // --- Promotions (organization-level) ---

  /**
   * Список активных акций организации. Акции общие по всей сети — studioId не нужен.
   * Публичный вызов (лендинг): `organizationId` передаётся в query.
   */
  async getPromotionsForOrganization(organizationId: string) {
    await this.assertOrganizationExists(organizationId);
    const now = new Date();
    return this.prisma.landingPromotion.findMany({
      where: {
        organizationId,
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

  /**
   * Проверить промокод в рамках организации.
   * @param studioIdForFilter — опциональный id филиала. Если задан, услуги в ответе
   *   фильтруются по тому, что реально доступно для записи в филиале
   *   (учёт StudioDisabledService / StudioDisabledCategory). Если не задан —
   *   возвращаем все услуги организации, на которые распространяется акция.
   */
  async resolvePromotionCodeForOrganization(
    organizationId: string,
    rawCode: string,
    studioIdForFilter?: string,
  ) {
    await this.assertOrganizationExists(organizationId);
    if (studioIdForFilter) {
      const studio = await this.prisma.studio.findUnique({
        where: { id: studioIdForFilter },
        select: { organizationId: true },
      });
      if (!studio || studio.organizationId !== organizationId) {
        throw new BadRequestException('studioId не принадлежит этой организации');
      }
    }
    const [disabledServiceIds, disabledCategoryIds] = studioIdForFilter
      ? await Promise.all([
          getDisabledServiceIdsForStudio(this.prisma, studioIdForFilter),
          getDisabledCategoryIdsForStudio(this.prisma, studioIdForFilter),
        ])
      : [new Set<string>(), new Set<string>()];
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
                service: { include: { category: true } },
              },
            },
          },
        },
      },
    });

    if (!codeRow || codeRow.promotion.organizationId !== organizationId) {
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
      const servicesRaw = await this.prisma.service.findMany({
        where: {
          organizationId,
          isActive: true,
          id: { in: [promotion.serviceIdA, promotion.serviceIdB] },
          category: { isActive: true },
        },
        select: {
          id: true,
          name: true,
          defaultPrice: true,
          defaultDurationMin: true,
          isActive: true,
          categoryId: true,
          category: { select: { id: true, isActive: true } },
        },
      });
      const services = servicesRaw.filter((s) =>
        isServiceOfferedInStudio(
          s,
          s.category,
          disabledServiceIds,
          disabledCategoryIds,
        ),
      );
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
        .filter(
          (s) =>
            s &&
            s.organizationId === organizationId &&
            isServiceOfferedInStudio(
              s,
              s.category,
              disabledServiceIds,
              disabledCategoryIds,
            ),
        )
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
        .filter(
          (s) =>
            s &&
            s.organizationId === organizationId &&
            isServiceOfferedInStudio(
              s,
              s.category,
              disabledServiceIds,
              disabledCategoryIds,
            ),
        )
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

  async createPromotionForOrganization(
    organizationId: string,
    dto: CreateLandingPromotionDto,
  ) {
    await this.assertOrganizationExists(organizationId);

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
        organizationId,
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

  async updatePromotionForOrganization(
    organizationId: string,
    id: string,
    dto: UpdateLandingPromotionDto,
  ) {
    await this.assertOrganizationExists(organizationId);

    const existing = await this.prisma.landingPromotion.findFirst({
      where: { id, organizationId },
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

  async deletePromotionForOrganization(organizationId: string, id: string) {
    await this.assertOrganizationExists(organizationId);

    const existing = await this.prisma.landingPromotion.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Promotion not found');
    }

    await this.prisma.landingPromotion.delete({ where: { id } });
    return { success: true };
  }

  // --- Masters ---

  /** Публичная витрина: мастера, работающие в филиале, с org-настройками видимости. */
  async getMasters(studioId: string) {
    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);
    const items = await this.buildOrganizationLandingMasterItems(organizationId);
    const forStudio = await filterLandingMastersForStudio(this.prisma, studioId, items);
    return forStudio.map(({ staffUserId, isVisible, order, staff }) => ({
      staffUserId,
      isVisible,
      order,
      staff,
    }));
  }

  /** Админка: все сотрудники всех филиалов сети + единые настройки лендинга. */
  async getMastersForOrganization(
    organizationId: string,
    userRole?: string,
    userOrganizationId?: string,
  ) {
    assertUserOrganizationMatchesOrganizationId(
      organizationId,
      userOrganizationId,
      userRole,
    );
    const items = await this.buildOrganizationLandingMasterItems(organizationId);
    return {
      organizationId,
      items: items.sort(
        (a, b) => a.order - b.order || a.staffUserId.localeCompare(b.staffUserId),
      ),
    };
  }

  private async buildOrganizationLandingMasterItems(organizationId: string) {
    const [configs, staff] = await Promise.all([
      this.prisma.landingMaster.findMany({
        where: { organizationId },
        orderBy: { order: 'asc' },
      }),
      findOrganizationLandingStaff(this.prisma, organizationId),
    ]);
    return mapStaffToLandingMasterItems(staff, configs);
  }

  async updateMasters(
    studioId: string,
    dto: UpdateLandingMastersDto,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
  ) {
    await assertUserOrganizationMatchesStudio(
      this.prisma,
      studioId,
      userOrganizationId,
      userRole,
    );
    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);
    return this.updateMastersForOrganization(
      organizationId,
      dto,
      userRole,
      userOrganizationId,
    );
  }

  async updateMastersForOrganization(
    organizationId: string,
    dto: UpdateLandingMastersDto,
    userRole?: string,
    userOrganizationId?: string,
  ) {
    assertUserOrganizationMatchesOrganizationId(
      organizationId,
      userOrganizationId,
      userRole,
    );

    const staffIds = dto.items.map((i) => i.staffUserId);
    await assertLandingMasterStaffIdsBelongToOrganization(
      this.prisma,
      organizationId,
      staffIds,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.landingMaster.deleteMany({ where: { organizationId } });
      for (const i of dto.items) {
        await tx.landingMaster.create({
          data: {
            id: generateId(IdPrefix.LandingMaster),
            organizationId,
            staffUserId: i.staffUserId,
            isVisible: i.isVisible,
            order: i.order,
          },
        });
      }
    });

    return this.getMastersForOrganization(organizationId, userRole, userOrganizationId);
  }

  // --- Services ---

  async getServiceCards(studioId: string) {
    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);
    const [disabledServiceIds, disabledCategoryIds] = await Promise.all([
      getDisabledServiceIdsForStudio(this.prisma, studioId),
      getDisabledCategoryIdsForStudio(this.prisma, studioId),
    ]);
    const cards = await this.prisma.landingServiceCard.findMany({
      where: { organizationId },
      include: {
        service: { include: { category: true } },
      },
      orderBy: { order: 'asc' },
    });
    return cards.filter(
      (c) =>
        c.service &&
        isServiceOfferedInStudio(
          c.service,
          c.service.category,
          disabledServiceIds,
          disabledCategoryIds,
        ),
    );
  }

  async createServiceCard(
    studioId: string,
    dto: CreateLandingServiceCardDto,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
  ) {
    await this.ensureStudioAccess(studioId, userRole, userStudioId, userOrganizationId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    await assertServiceBookableAtStudio(this.prisma, studioId, dto.serviceId, organizationId);

    const count = await this.prisma.landingServiceCard.count({
      where: { organizationId },
    });

    return this.prisma.landingServiceCard.create({
      data: {
        id: generateId(IdPrefix.LandingServiceCard),
        organizationId,
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
    userOrganizationId?: string,
  ) {
    await this.ensureStudioAccess(studioId, userRole, userStudioId, userOrganizationId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const existing = await this.prisma.landingServiceCard.findFirst({
      where: { id, organizationId },
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
    userOrganizationId?: string,
  ) {
    await this.ensureStudioAccess(studioId, userRole, userStudioId, userOrganizationId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const existing = await this.prisma.landingServiceCard.findFirst({
      where: { id, organizationId },
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
    userOrganizationId?: string,
  ) {
    await this.ensureStudioAccess(studioId, userRole, userStudioId, userOrganizationId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const ids = dto.items.map((i) => i.id);
    const existing = await this.prisma.landingServiceCard.findMany({
      where: { id: { in: ids }, organizationId },
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

  // --- Category cards ---

  private mapCategoryCardForLanding(card: {
    id: string;
    categoryId: string;
    title: string | null;
    description: string | null;
    order: number;
    category: { id: string; name: string; description: string | null };
  }) {
    return {
      id: card.id,
      categoryId: card.categoryId,
      title: card.title ?? card.category.name,
      description: card.description ?? card.category.description ?? null,
      order: card.order,
    };
  }

  async getCategoryCards(studioId: string) {
    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);
    const disabledCategoryIds = await getDisabledCategoryIdsForStudio(this.prisma, studioId);
    const cards = await this.prisma.landingCategoryCard.findMany({
      where: { organizationId },
      include: { category: true },
      orderBy: { order: 'asc' },
    });
    return cards
      .filter((c) => c.category && isCategoryOfferedInStudio(c.category, disabledCategoryIds))
      .map((c) => this.mapCategoryCardForLanding(c));
  }

  async createCategoryCard(
    studioId: string,
    dto: CreateLandingCategoryCardDto,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
  ) {
    await this.ensureStudioAccess(studioId, userRole, userStudioId, userOrganizationId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    await assertCategoryOfferedAtStudio(
      this.prisma,
      studioId,
      dto.categoryId,
      organizationId,
    );

    const count = await this.prisma.landingCategoryCard.count({
      where: { organizationId },
    });

    const card = await this.prisma.landingCategoryCard.create({
      data: {
        id: generateId(IdPrefix.LandingCategoryCard),
        organizationId,
        categoryId: dto.categoryId,
        title: dto.title ?? null,
        description: dto.description ?? null,
        order: dto.order ?? count,
      },
      include: { category: true },
    });

    return this.mapCategoryCardForLanding(card);
  }

  async updateCategoryCard(
    studioId: string,
    id: string,
    dto: UpdateLandingCategoryCardDto,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
  ) {
    await this.ensureStudioAccess(studioId, userRole, userStudioId, userOrganizationId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const existing = await this.prisma.landingCategoryCard.findFirst({
      where: { id, organizationId },
      include: { category: true },
    });
    if (!existing) {
      throw new NotFoundException('Category card not found');
    }

    const card = await this.prisma.landingCategoryCard.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        description: dto.description ?? undefined,
      },
      include: { category: true },
    });

    return this.mapCategoryCardForLanding(card);
  }

  async deleteCategoryCard(
    studioId: string,
    id: string,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
  ) {
    await this.ensureStudioAccess(studioId, userRole, userStudioId, userOrganizationId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const existing = await this.prisma.landingCategoryCard.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Category card not found');
    }

    await this.prisma.landingCategoryCard.delete({ where: { id } });
    return { success: true };
  }

  async reorderCategoryCards(
    studioId: string,
    dto: ReorderLandingCategoryCardsDto,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
  ) {
    await this.ensureStudioAccess(studioId, userRole, userStudioId, userOrganizationId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const ids = dto.items.map((i) => i.id);
    const existing = await this.prisma.landingCategoryCard.findMany({
      where: { id: { in: ids }, organizationId },
      select: { id: true },
    });
    const validIds = new Set(existing.map((c) => c.id));

    const updates = dto.items.filter((i) => validIds.has(i.id));

    await this.prisma.$transaction(
      updates.map((i) =>
        this.prisma.landingCategoryCard.update({
          where: { id: i.id },
          data: { order: i.order },
        }),
      ),
    );

    return this.getCategoryCards(studioId);
  }

  // --- Helpers ---

  private async ensureStudioAccess(
    studioId: string,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
  ) {
    if (isDeveloperRole(userRole)) return;
    if (hasOrganizationWideStudioAccess(userRole)) {
      if (!userOrganizationId?.trim()) {
        throw new BadRequestException('Organization context required');
      }
      await assertUserOrganizationMatchesStudio(
        this.prisma,
        studioId,
        userOrganizationId,
        userRole,
      );
      return;
    }
    if (userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
    }
  }

  /**
   * Преобразует пользователя + query-параметр `organizationId` в валидный organizationId.
   * DEVELOPER может передать `?organizationId=` чтобы работать в чужой организации.
   * Для прочих ролей organizationId всегда берётся из JWT.
   */
  async resolveOrganizationIdForPromotion(
    userRole: string | undefined,
    userOrganizationId: string | undefined,
    organizationIdQuery: string | undefined,
  ): Promise<string> {
    if (isDeveloperRole(userRole) && organizationIdQuery?.trim()) {
      const organizationId = organizationIdQuery.trim();
      await this.assertOrganizationExists(organizationId);
      return organizationId;
    }
    if (!userOrganizationId?.trim()) {
      throw new BadRequestException('Organization context required');
    }
    return userOrganizationId.trim();
  }

  private async assertOrganizationExists(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) {
      throw new NotFoundException(`Organization with ID ${organizationId} not found`);
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

  /** Филиалы сети для выпадающего списка в форме записи на лендинге. */
  async getPublicStudiosForOrganization(organizationId: string) {
    const orgId = organizationId?.trim();
    if (!orgId) {
      throw new BadRequestException('organizationId is required');
    }
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    const studios = await this.prisma.studio.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, address: true, timezone: true },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });
    return { organizationId: orgId, organizationName: org.name, studios };
  }

  /**
   * Услуги, доступные для записи в филиале (каталог CRM, не карточки лендинга).
   */
  async getPublicBookableServices(studioId: string, staffUserId?: string) {
    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);
    const staffFilter = staffUserId?.trim() || undefined;
    const services = await this.servicesService.findAll(
      UserRole.OWNER,
      undefined,
      organizationId,
      undefined,
      studioId,
      staffFilter,
    );
    return services.map((s) => ({
      serviceId: s.id,
      name: s.name,
      defaultPrice: s.defaultPrice,
      defaultDurationMin: s.defaultDurationMin,
      categoryName: s.category?.name ?? null,
    }));
  }

  /**
   * Мастера для формы записи: все активные MASTER/ADMIN в филиале (+ membership).
   * Настройки «Показывать на сайте» (landing_masters) здесь не используются — только для витрины GET .../landing/masters.
   */
  async getPublicBookableMasters(studioId: string, serviceIds?: string[]) {
    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);
    const filterServiceIds = (serviceIds ?? [])
      .map((id) => id.trim())
      .filter(Boolean);
    let allowedStaffIds: Set<string> | null = null;
    if (filterServiceIds.length > 0) {
      const offering = await getStaffUserIdsOfferingAllServicesInStudio(
        this.prisma,
        studioId,
        filterServiceIds,
      );
      allowedStaffIds = new Set(offering);
    }
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { id: true },
    });
    if (!studio) {
      throw new NotFoundException('Studio not found');
    }

    const configs = await this.prisma.landingMaster.findMany({
      where: { organizationId },
      orderBy: { order: 'asc' },
    });
    const configByStaffId = new Map(configs.map((c) => [c.staffUserId, c]));

    const staff = await this.prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        role: { in: [PrismaUserRole.MASTER, PrismaUserRole.ADMIN] },
        OR: [
          { studioId },
          { studioMemberships: { some: { studioId } } },
        ],
      },
      include: { staffProfile: true },
      orderBy: { createdAt: 'asc' },
    });

    const items = staff
      .map((u) => {
        if (allowedStaffIds && !allowedStaffIds.has(u.id)) {
          return null;
        }
        const cfg = configByStaffId.get(u.id);
        return {
          staffUserId: u.id,
          isVisible: true,
          order: cfg?.order ?? 999,
          staff: u,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    items.sort((a, b) => a.order - b.order || a.staffUserId.localeCompare(b.staffUserId));
    return items;
  }

  /** Публичные свободные слоты для формы записи на лендинге. */
  async getPublicAvailability(
    studioId: string,
    date: string,
    serviceId: string,
    staffUserId?: string,
  ) {
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { id: true, timezone: true },
    });
    if (!studio) {
      throw new NotFoundException('Studio not found');
    }
    if (!serviceId?.trim()) {
      throw new BadRequestException('serviceId is required');
    }
    return this.availabilityService.computeNextbotFreeSlots(studioId, date, {
      staffUserId: staffUserId?.trim() || undefined,
      serviceIds: [serviceId.trim()],
    });
  }

  /**
   * Публичная отправка формы «Запись в удобное время».
   * Полная запись: startAt + serviceId/serviceIds + staffUserId (staff из выбранного слота).
   * Иначе — заявка на обратный звонок (обновление notes у клиента).
   */
  async submitBookingRequest(dto: LandingBookingRequestDto) {
    const studio = await this.prisma.studio.findUnique({
      where: { id: dto.studioId },
      include: { organization: true },
    });
    if (!studio) {
      throw new NotFoundException('Studio not found');
    }

    const phone = normalizeLandingPhone(dto.phone);
    const organizationId = studio.organizationId;

    let client = await this.prisma.client.findUnique({
      where: {
        organizationId_phone: { organizationId, phone },
      },
    });

    if (client?.isBlacklisted) {
      void this.notificationsService
        .maybeNotifyBlacklistedBookingAttempt(dto.studioId, client, {
          actingUserId: 'api-key',
          createdSource: AppointmentCreatedSource.LANDING,
        })
        .catch(() => undefined);
      throw new BadRequestException('Запись недоступна для этого номера телефона');
    }

    if (!client) {
      client = await this.clientsService.create(
        {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName?.trim() || undefined,
          patronymic: dto.patronymic?.trim() || undefined,
          instagram: dto.instagram?.trim() || undefined,
          phone,
          referralLinkId: dto.referralLinkId?.trim() || undefined,
        },
        UserRole.SERVICE,
        undefined,
        organizationId,
      );
    }

    const bookingServiceIds = this.resolveBookingServiceIds(dto);

    const wantsBooking =
      !!dto.startAt?.trim() &&
      bookingServiceIds.length > 0 &&
      !!dto.staffUserId?.trim();

    if (wantsBooking) {
      const createDto = {
        staffUserId: dto.staffUserId!.trim(),
        clientId: client.id,
        serviceIds: bookingServiceIds,
        startAt: dto.startAt!.trim(),
        comment: dto.comment?.trim() || undefined,
        preferWaitlist: true,
        waitlistSource: WaitlistEntrySource.LANDING,
        createdSource: AppointmentCreatedSource.LANDING,
        promoCode: dto.promoCode?.trim() || undefined,
        tentative: true,
      };

      try {
        const created = await this.appointmentsService.create(
          dto.studioId,
          createDto,
          UserRole.SERVICE,
          dto.studioId,
          organizationId,
          'api-key',
        );

        const landingPromotion = this.extractLandingPromotionFromCreateResult(created);

        if (created && typeof created === 'object' && 'outcome' in created) {
          const wrapped = created as {
            outcome: 'booked' | 'waitlist';
            appointment?: { id: string; status: string; startAt: string };
            waitlistEntry?: { id: string };
            landingPromotion?: LandingPromoClientPayload;
          };
          const promo = landingPromotion ?? wrapped.landingPromotion;
          if (wrapped.outcome === 'waitlist') {
            return {
              outcome: 'waitlist' as const,
              message: this.buildLandingBookingUserMessage(
                'Выбранное время занято. Мы добавили вас в лист ожидания и свяжемся, когда появится окно.',
                promo,
              ),
              waitlistEntryId: wrapped.waitlistEntry?.id,
              clientId: client.id,
              landingPromotion: promo,
            };
          }
          return {
            outcome: 'booked' as const,
            message: this.buildLandingBookingUserMessage(
              'Запись создана. Мы свяжемся с вами для подтверждения.',
              promo,
            ),
            appointmentId: wrapped.appointment?.id,
            clientId: client.id,
            landingPromotion: promo,
          };
        }

        if (created && typeof created === 'object' && 'appointment' in created) {
          const wrapped = created as {
            appointment: { id: string };
            landingPromotion?: LandingPromoClientPayload;
          };
          const promo = landingPromotion ?? wrapped.landingPromotion;
          return {
            outcome: 'booked' as const,
            message: this.buildLandingBookingUserMessage(
              'Запись создана. Мы свяжемся с вами для подтверждения.',
              promo,
            ),
            appointmentId: wrapped.appointment.id,
            clientId: client.id,
            landingPromotion: promo,
          };
        }

        const appt = created as { id: string };
        return {
          outcome: 'booked' as const,
          message: this.buildLandingBookingUserMessage(
            'Запись создана. Мы свяжемся с вами для подтверждения.',
            landingPromotion,
          ),
          appointmentId: appt.id,
          clientId: client.id,
          landingPromotion,
        };
      } catch (e) {
        if (e instanceof ConflictException) {
          throw new BadRequestException(
            'Выбранное время недоступно. Выберите другое время или оставьте заявку без точного слота.',
          );
        }
        throw e;
      }
    }

    let landingPromotion: LandingPromoClientPayload | undefined;
    if (dto.promoCode?.trim()) {
      const applied = await resolveLandingPromoForBooking(this.prisma, {
        organizationId,
        studioId: dto.studioId,
        rawCode: dto.promoCode,
        appointmentServiceIds: bookingServiceIds,
      });
      await incrementLandingPromoUsedCount(this.prisma, applied.codeId);
      landingPromotion = landingPromoToClientPayload(applied, bookingServiceIds);
    }

    const noteBlock = [
      '[Заявка с лендинга — перезвоним]',
      bookingServiceIds.length
        ? `Услуга (id): ${bookingServiceIds.join(', ')}`
        : dto.serviceId
          ? `Услуга (id): ${dto.serviceId}`
          : 'Услуга: не выбрана',
      dto.startAt
        ? `Желаемое время: ${dto.startAt}`
        : 'Желаемое время: не указано',
      dto.comment?.trim() ? `Комментарий: ${dto.comment.trim()}` : 'Комментарий: —',
      landingPromotion
        ? formatLandingPromoComment({
            codeId: '',
            code: landingPromotion.code,
            promotionId: landingPromotion.promotionId,
            type: landingPromotion.type,
            title: landingPromotion.title,
            description: landingPromotion.description,
            discountPercent: landingPromotion.discountPercent,
            bundlePrice: landingPromotion.bundlePrice,
          })
        : dto.promoCode?.trim()
          ? `Промокод: ${dto.promoCode.trim()}`
          : null,
    ]
      .filter(Boolean)
      .join('\n');

    const mergedNotes = [client.notes?.trim(), noteBlock].filter(Boolean).join('\n\n');

    await this.prisma.client.update({
      where: { id: client.id },
      data: { notes: mergedNotes },
    });

    return {
      outcome: 'callback' as const,
      message: this.buildLandingBookingUserMessage(
        'Заявка принята. Мы перезвоним и подберём удобное время.',
        landingPromotion,
      ),
      clientId: client.id,
      landingPromotion,
    };
  }

  private resolveBookingServiceIds(dto: LandingBookingRequestDto): string[] {
    const fromArray = (dto.serviceIds ?? []).map((s) => s.trim()).filter(Boolean);
    if (fromArray.length > 0) {
      return [...new Set(fromArray)];
    }
    const single = dto.serviceId?.trim();
    return single ? [single] : [];
  }

  private extractLandingPromotionFromCreateResult(
    created: unknown,
  ): LandingPromoClientPayload | undefined {
    if (!created || typeof created !== 'object' || !('landingPromotion' in created)) {
      return undefined;
    }
    const promo = (created as { landingPromotion?: LandingPromoClientPayload }).landingPromotion;
    return promo ?? undefined;
  }

  private buildLandingBookingUserMessage(
    base: string,
    promo?: LandingPromoClientPayload,
  ): string {
    if (!promo) return base;
    const parts = [`Акция «${promo.title}»`];
    if (promo.description?.trim()) {
      parts.push(promo.description.trim());
    }
    if (promo.discountPercent != null && promo.discountPercent > 0) {
      parts.push(`скидка ${promo.discountPercent}%`);
    }
    if (promo.bundlePrice != null) {
      parts.push(`цена по акции ${promo.bundlePrice} ₸`);
    }
    return `${base} ${parts.join('. ')}.`;
  }
}

