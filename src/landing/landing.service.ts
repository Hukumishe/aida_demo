import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  AppointmentCreatedSource,
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
import { generateId, IdPrefix } from '../common/id-generator';
import {
  assertUserOrganizationMatchesStudio,
  getOrganizationIdForStudio,
} from '../common/organization-scope';
import {
  assertServiceBookableAtStudio,
  getDisabledServiceIdsForStudio,
  getDisabledCategoryIdsForStudio,
  isServiceOfferedInStudio,
} from '../common/service-studio-offering';
import { isDeveloperRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';
import { ServicesService } from '../services/services.service';

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

@Injectable()
export class LandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servicesService: ServicesService,
    private readonly appointmentsService: AppointmentsService,
    private readonly availabilityService: AvailabilityService,
    private readonly clientsService: ClientsService,
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

  async getMasters(studioId: string) {
    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);
    const [configs, staff] = await Promise.all([
      this.prisma.landingMaster.findMany({
        where: { organizationId },
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

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const staffIds = dto.items.map((i) => i.staffUserId);
    const existingStaff = await this.prisma.user.findMany({
      where: { id: { in: staffIds }, studioId },
      select: { id: true },
    });
    const validIds = new Set(existingStaff.map((s) => s.id));

    const filtered = dto.items.filter((i) => validIds.has(i.staffUserId));

    await this.prisma.$transaction(async (tx) => {
      await tx.landingMaster.deleteMany({ where: { organizationId } });
      for (const i of filtered) {
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

    return this.getMasters(studioId);
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
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

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
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

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
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

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
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

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

  // --- Helpers ---

  private ensureStudioAccess(studioId: string, userRole?: string, userStudioId?: string) {
    if (!isOwnerLevelRole(userRole)) {
      if (userStudioId !== studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }
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
   * Полная запись: startAt + serviceId + staffUserId (staff из выбранного слота).
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

    const wantsBooking =
      !!dto.startAt?.trim() && !!dto.serviceId?.trim() && !!dto.staffUserId?.trim();

    if (wantsBooking) {
      const createDto = {
        staffUserId: dto.staffUserId!.trim(),
        clientId: client.id,
        serviceIds: [dto.serviceId!.trim()],
        startAt: dto.startAt!.trim(),
        comment: dto.comment?.trim() || undefined,
        preferWaitlist: true,
        waitlistSource: WaitlistEntrySource.LANDING,
        createdSource: AppointmentCreatedSource.LANDING,
        promoCode: dto.promoCode?.trim() || undefined,
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

        if (created && typeof created === 'object' && 'outcome' in created) {
          const wrapped = created as {
            outcome: 'booked' | 'waitlist';
            appointment?: { id: string; status: string; startAt: string };
            waitlistEntry?: { id: string };
          };
          if (wrapped.outcome === 'waitlist') {
            return {
              outcome: 'waitlist' as const,
              message:
                'Выбранное время занято. Мы добавили вас в лист ожидания и свяжемся, когда появится окно.',
              waitlistEntryId: wrapped.waitlistEntry?.id,
              clientId: client.id,
            };
          }
          return {
            outcome: 'booked' as const,
            message: 'Запись создана. Мы свяжемся с вами для подтверждения.',
            appointmentId: wrapped.appointment?.id,
            clientId: client.id,
          };
        }

        const appt = created as { id: string };
        return {
          outcome: 'booked' as const,
          message: 'Запись создана. Мы свяжемся с вами для подтверждения.',
          appointmentId: appt.id,
          clientId: client.id,
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

    const noteBlock = [
      '[Заявка с лендинга — перезвоним]',
      dto.serviceId ? `Услуга (id): ${dto.serviceId}` : 'Услуга: не выбрана',
      dto.startAt
        ? `Желаемое время: ${dto.startAt}`
        : 'Желаемое время: не указано',
      dto.comment?.trim() ? `Комментарий: ${dto.comment.trim()}` : 'Комментарий: —',
      dto.promoCode?.trim() ? `Промокод: ${dto.promoCode.trim()}` : null,
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
      message: 'Заявка принята. Мы перезвоним и подберём удобное время.',
      clientId: client.id,
    };
  }
}

