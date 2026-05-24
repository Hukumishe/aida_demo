import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  ReferFriendInviteeRewardType,
  ReferFriendReferrerRewardType,
  RemotePaymentMethod,
  StudioLoyaltyMode,
} from '@prisma/client';
import { generateId, IdPrefix } from '../common/id-generator';
import { CreateStudioDto } from './dto/create-studio.dto';
import {
  StudioLoyaltyMilestoneItemDto,
  StudioLoyaltyTierItemDto,
} from './dto/update-studio-loyalty.dto';
import { UserRole, isDeveloperRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';
import { resolveAutoTierForTotalPaid } from '../common/loyalty/studio-loyalty.util';
import { DEFAULT_IANA_TIMEZONE } from '../common/effective-timezone';

@Injectable()
export class StudiosService {
  constructor(private prisma: PrismaService) {}

  async findAll(userRole: string, userStudioId: string | undefined, organizationId: string) {
    if (isDeveloperRole(userRole)) {
      return this.prisma.studio.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }
    if (isOwnerLevelRole(userRole) || userRole === UserRole.MANAGER) {
      return this.prisma.studio.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!userStudioId) {
      return [];
    }

    return this.prisma.studio.findMany({
      where: { id: userStudioId, organizationId },
    });
  }

  async create(createStudioDto: CreateStudioDto, organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return this.prisma.studio.create({
      data: {
        id: generateId(IdPrefix.Studio),
        organizationId,
        name: createStudioDto.name,
        address: createStudioDto.address,
        timezone:
          createStudioDto.timezone?.trim() ||
          org.ianaTimezone ||
          DEFAULT_IANA_TIMEZONE,
      },
    });
  }

  async findOne(id: string, userRole: string, userStudioId: string | undefined, organizationId: string) {
    const studio = await this.prisma.studio.findUnique({
      where: { id },
    });

    if (!studio) {
      return null;
    }

    if (!isDeveloperRole(userRole) && studio.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied to this studio');
    }

    if (isOwnerLevelRole(userRole) || userRole === UserRole.MANAGER) {
      return studio;
    }

    if (userStudioId !== id) {
      throw new ForbiddenException('Access denied to this studio');
    }

    return studio;
  }

  async getSettings(studioId: string, userRole: string, userStudioId: string | undefined) {
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: {
        id: true,
        organizationId: true,
        feedbackTwoGisUrl: true,
        organization: {
          select: {
            loyaltyMode: true,
            globalBonusPaymentLimitPercent: true,
            referFriendEnabled: true,
            referFriendInviteeRewardType: true,
            referFriendInviteeValue: true,
            referFriendReferrerRewardType: true,
            referFriendReferrerValue: true,
            marketingHoursStartHour: true,
            marketingHoursEndHour: true,
            paymentKaspiPhone: true,
            paymentKaspiCardHolder: true,
            remotePaymentMethod: true,
            paymentIpRequisites: true,
            nightHoldMinutes: true,
            dayInvoiceTaskDeadlineHours: true,
            nightReceiptTaskDeadlineHours: true,
            highPriorityGapMinutes: true,
            normalPriorityToleranceMinutes: true,
            nextbotOutboundWebhookUrl: true,
            nextbotOutboundWebhookApiKey: true,
            feedbackLowRatingTaskTitle: true,
          },
        },
      },
    });
    if (!studio) throw new NotFoundException('Studio not found');
    if (!isOwnerLevelRole(userRole) && userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
    }
    const org = studio.organization;
    const base = {
      loyaltyMode: org.loyaltyMode,
      globalBonusPaymentLimitPercent: org.globalBonusPaymentLimitPercent ?? 30,
      referFriendEnabled: org.referFriendEnabled,
      referFriendInviteeRewardType: org.referFriendInviteeRewardType,
      referFriendInviteeValue: org.referFriendInviteeValue,
      referFriendReferrerRewardType: org.referFriendReferrerRewardType,
      referFriendReferrerValue: org.referFriendReferrerValue,
      marketingHoursStartHour: org.marketingHoursStartHour,
      marketingHoursEndHour: org.marketingHoursEndHour,
      paymentKaspiPhone: org.paymentKaspiPhone,
      paymentKaspiCardHolder: org.paymentKaspiCardHolder,
      remotePaymentMethod: org.remotePaymentMethod,
      paymentIpRequisites: org.paymentIpRequisites,
      nightHoldMinutes: org.nightHoldMinutes,
      dayInvoiceTaskDeadlineHours: org.dayInvoiceTaskDeadlineHours,
      nightReceiptTaskDeadlineHours: org.nightReceiptTaskDeadlineHours,
      highPriorityGapMinutes: org.highPriorityGapMinutes,
      normalPriorityToleranceMinutes: org.normalPriorityToleranceMinutes,
      feedbackLowRatingTaskTitle: org.feedbackLowRatingTaskTitle,
      feedbackTwoGisUrl: studio.feedbackTwoGisUrl,
    };
    if (!isDeveloperRole(userRole)) {
      return base;
    }
    return {
      ...base,
      nextbotOutboundWebhookUrl: org.nextbotOutboundWebhookUrl,
      nextbotOutboundWebhookApiKey: org.nextbotOutboundWebhookApiKey,
    };
  }

  async updateSettings(
    studioId: string,
    dto: {
      globalBonusPaymentLimitPercent?: number;
      referFriendEnabled?: boolean;
      referFriendInviteeRewardType?: ReferFriendInviteeRewardType;
      referFriendInviteeValue?: number;
      referFriendReferrerRewardType?: ReferFriendReferrerRewardType;
      referFriendReferrerValue?: number;
      marketingHoursStartHour?: number | null;
      marketingHoursEndHour?: number | null;
      paymentKaspiPhone?: string | null;
      paymentKaspiCardHolder?: string | null;
      remotePaymentMethod?: RemotePaymentMethod;
      paymentIpRequisites?: string | null;
      nightHoldMinutes?: number | null;
      dayInvoiceTaskDeadlineHours?: number | null;
      nightReceiptTaskDeadlineHours?: number | null;
      highPriorityGapMinutes?: number | null;
      normalPriorityToleranceMinutes?: number | null;
      nextbotOutboundWebhookUrl?: string | null;
      nextbotOutboundWebhookApiKey?: string | null;
      feedbackLowRatingTaskTitle?: string | null;
      feedbackTwoGisUrl?: string | null;
    },
    userRole: string,
  ) {
    if (!isOwnerLevelRole(userRole)) {
      throw new ForbiddenException('Only owner level role can change studio settings');
    }
    const touchesNextbotIntegration =
      Object.prototype.hasOwnProperty.call(dto, 'nextbotOutboundWebhookUrl') ||
      Object.prototype.hasOwnProperty.call(dto, 'nextbotOutboundWebhookApiKey');
    if (touchesNextbotIntegration && !isDeveloperRole(userRole)) {
      throw new ForbiddenException(
        'Настройки интеграции Nextbot (webhook) может менять только разработчик',
      );
    }
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { id: true, organizationId: true },
    });
    if (!studio) throw new NotFoundException('Studio not found');

    const org = await this.prisma.organization.findUnique({
      where: { id: studio.organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const nextEnabled = dto.referFriendEnabled ?? org.referFriendEnabled;
    const nextInviteeType = dto.referFriendInviteeRewardType ?? org.referFriendInviteeRewardType;
    const nextInviteeValue =
      dto.referFriendInviteeValue !== undefined ? dto.referFriendInviteeValue : org.referFriendInviteeValue;
    const nextReferrerType =
      dto.referFriendReferrerRewardType ?? org.referFriendReferrerRewardType;
    const nextReferrerValue =
      dto.referFriendReferrerValue !== undefined
        ? dto.referFriendReferrerValue
        : org.referFriendReferrerValue;

    if (nextEnabled) {
      if (nextInviteeType == null || nextInviteeValue == null) {
        throw new BadRequestException(
          'При включённой акции «приведи друга» задайте тип и размер награды для приглашённого',
        );
      }
      if (nextInviteeValue < 0 || nextInviteeValue > 100) {
        throw new BadRequestException('referFriendInviteeValue должен быть от 0 до 100');
      }
      if (nextReferrerType == null || nextReferrerValue == null) {
        throw new BadRequestException(
          'При включённой акции «приведи друга» задайте тип и значение вознаграждения для пригласившего',
        );
      }
      if (nextReferrerType === 'PERCENT_OF_PAYMENT') {
        if (nextReferrerValue < 0 || nextReferrerValue > 100) {
          throw new BadRequestException(
            'Для процента от оплаты referFriendReferrerValue должен быть от 0 до 100',
          );
        }
      } else if (nextReferrerValue < 0) {
        throw new BadRequestException('Фиксированная сумма для пригласившего не может быть отрицательной');
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.globalBonusPaymentLimitPercent !== undefined) {
      data.globalBonusPaymentLimitPercent = dto.globalBonusPaymentLimitPercent;
    }
    if (dto.referFriendEnabled !== undefined) data.referFriendEnabled = dto.referFriendEnabled;
    if (dto.referFriendInviteeRewardType !== undefined) {
      data.referFriendInviteeRewardType = dto.referFriendInviteeRewardType;
    }
    if (dto.referFriendInviteeValue !== undefined) data.referFriendInviteeValue = dto.referFriendInviteeValue;
    if (dto.referFriendReferrerRewardType !== undefined) {
      data.referFriendReferrerRewardType = dto.referFriendReferrerRewardType;
    }
    if (dto.referFriendReferrerValue !== undefined) {
      data.referFriendReferrerValue = dto.referFriendReferrerValue;
    }

    // Рабочие часы: либо оба часа заданы, либо оба null. Пара «число + null» запрещена.
    const startProvided = Object.prototype.hasOwnProperty.call(dto, 'marketingHoursStartHour');
    const endProvided = Object.prototype.hasOwnProperty.call(dto, 'marketingHoursEndHour');
    if (startProvided || endProvided) {
      const nextStart = startProvided ? dto.marketingHoursStartHour ?? null : org.marketingHoursStartHour;
      const nextEnd = endProvided ? dto.marketingHoursEndHour ?? null : org.marketingHoursEndHour;
      if ((nextStart == null) !== (nextEnd == null)) {
        throw new BadRequestException(
          'Задайте оба часа рабочего времени отдела маркетинга (marketingHoursStartHour и marketingHoursEndHour) или оба null',
        );
      }
      if (nextStart != null && nextEnd != null && nextStart === nextEnd) {
        throw new BadRequestException(
          'marketingHoursStartHour не может совпадать с marketingHoursEndHour',
        );
      }
      if (startProvided) data.marketingHoursStartHour = nextStart;
      if (endProvided) data.marketingHoursEndHour = nextEnd;
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'paymentKaspiPhone')) {
      const v = dto.paymentKaspiPhone;
      data.paymentKaspiPhone = v == null || v.trim() === '' ? null : v.trim();
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'paymentKaspiCardHolder')) {
      const v = dto.paymentKaspiCardHolder;
      data.paymentKaspiCardHolder = v == null || v.trim() === '' ? null : v.trim();
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'remotePaymentMethod')) {
      data.remotePaymentMethod = dto.remotePaymentMethod ?? RemotePaymentMethod.PHONE_TRANSFER;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'paymentIpRequisites')) {
      const v = dto.paymentIpRequisites;
      data.paymentIpRequisites = v == null || v.trim() === '' ? null : v.trim();
    }
    const nextRemotePaymentMethod =
      dto.remotePaymentMethod ?? org.remotePaymentMethod ?? RemotePaymentMethod.PHONE_TRANSFER;
    const nextPaymentIpRequisites =
      Object.prototype.hasOwnProperty.call(dto, 'paymentIpRequisites')
        ? ((data.paymentIpRequisites as string | null | undefined) ?? null)
        : (org.paymentIpRequisites ?? null);
    if (
      nextRemotePaymentMethod === RemotePaymentMethod.IP_ACCOUNT &&
      (!nextPaymentIpRequisites || nextPaymentIpRequisites.trim() === '')
    ) {
      throw new BadRequestException(
        'Для remotePaymentMethod=IP_ACCOUNT заполните paymentIpRequisites (ссылка оплаты)',
      );
    }
    if (nextRemotePaymentMethod === RemotePaymentMethod.IP_ACCOUNT && nextPaymentIpRequisites) {
      const url = nextPaymentIpRequisites.trim();
      const isKaspiPayLink = /^https:\/\/pay\.kaspi\.kz\/pay\/[A-Za-z0-9_-]+$/i.test(url);
      if (!isKaspiPayLink) {
        throw new BadRequestException(
          'paymentIpRequisites должен быть ссылкой вида https://pay.kaspi.kz/pay/<id>',
        );
      }
    }

    // Тайминги Nextbot-потока оплаты. Все — nullable; null/undefined = «сбросить к дефолту в коде».
    if (Object.prototype.hasOwnProperty.call(dto, 'nightHoldMinutes')) {
      data.nightHoldMinutes = dto.nightHoldMinutes ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'dayInvoiceTaskDeadlineHours')) {
      data.dayInvoiceTaskDeadlineHours = dto.dayInvoiceTaskDeadlineHours ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'nightReceiptTaskDeadlineHours')) {
      data.nightReceiptTaskDeadlineHours = dto.nightReceiptTaskDeadlineHours ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'highPriorityGapMinutes')) {
      data.highPriorityGapMinutes = dto.highPriorityGapMinutes ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'normalPriorityToleranceMinutes')) {
      data.normalPriorityToleranceMinutes =
        dto.normalPriorityToleranceMinutes ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'nextbotOutboundWebhookUrl')) {
      data.nextbotOutboundWebhookUrl = dto.nextbotOutboundWebhookUrl ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'nextbotOutboundWebhookApiKey')) {
      data.nextbotOutboundWebhookApiKey = dto.nextbotOutboundWebhookApiKey ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'feedbackLowRatingTaskTitle')) {
      data.feedbackLowRatingTaskTitle = dto.feedbackLowRatingTaskTitle ?? null;
    }

    const studioData: { feedbackTwoGisUrl?: string | null } = {};
    if (Object.prototype.hasOwnProperty.call(dto, 'feedbackTwoGisUrl')) {
      studioData.feedbackTwoGisUrl = dto.feedbackTwoGisUrl ?? null;
    }

    await this.prisma.$transaction([
      this.prisma.organization.update({
        where: { id: studio.organizationId },
        data: data as any,
      }),
      ...(Object.keys(studioData).length
        ? [
            this.prisma.studio.update({
              where: { id: studioId },
              data: studioData,
            }),
          ]
        : []),
    ]);

    return this.getSettings(studioId, userRole, studioId);
  }

  private validateCustomLoyaltyPayload(
    tiers: StudioLoyaltyTierItemDto[],
    milestones: StudioLoyaltyMilestoneItemDto[],
  ) {
    if (tiers.length > 20) {
      throw new BadRequestException('Не более 20 уровней лояльности');
    }
    const sortOrders = [...new Set(tiers.map((t) => t.sortOrder))].sort((a, b) => a - b);
    if (sortOrders.length !== tiers.length) {
      throw new BadRequestException('У каждого уровня должен быть уникальный sortOrder');
    }
    for (let i = 0; i < sortOrders.length; i++) {
      if (sortOrders[i] !== i) {
        throw new BadRequestException(
          `Уровни: sortOrder должны идти без пропусков от 0 до ${tiers.length - 1}`,
        );
      }
    }
    const seenM = new Set<number>();
    for (const m of milestones) {
      if (seenM.has(m.minTotalPaid)) {
        throw new BadRequestException('В вехах не должно быть дублирующегося minTotalPaid');
      }
      seenM.add(m.minTotalPaid);
    }
    if (!milestones.some((m) => m.minTotalPaid === 0)) {
      throw new BadRequestException('Добавьте веху с minTotalPaid = 0 (базовый порог, обычно targetSortOrder = 0)');
    }
    const tierBySort = new Map(tiers.map((t) => [t.sortOrder, t]));
    for (const m of milestones) {
      const t = tierBySort.get(m.targetSortOrder);
      if (!t) {
        throw new BadRequestException(`Веха ссылается на несуществующий уровень sortOrder=${m.targetSortOrder}`);
      }
      if (t.manualOnly) {
        throw new BadRequestException(
          `Веха не может вести на ручной уровень «${t.name}» (manualOnly). Ручные уровни только через админку клиента.`,
        );
      }
    }
  }

  async getLoyalty(studioId: string, userRole: string, userStudioId: string | undefined) {
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { id: true, organizationId: true, organization: { select: { loyaltyMode: true } } },
    });
    if (!studio) throw new NotFoundException('Studio not found');
    if (!isOwnerLevelRole(userRole) && userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
    }
    const orgId = studio.organizationId;
    const [tiers, milestones] = await Promise.all([
      this.prisma.studioLoyaltyTier.findMany({
        where: { organizationId: orgId },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.studioLoyaltyMilestone.findMany({
        where: { organizationId: orgId },
        orderBy: { minTotalPaid: 'asc' },
      }),
    ]);
    return { loyaltyMode: studio.organization.loyaltyMode, tiers, milestones };
  }

  async updateLoyalty(
    studioId: string,
    dto: {
      loyaltyMode: StudioLoyaltyMode;
      tiers?: StudioLoyaltyTierItemDto[];
      milestones?: StudioLoyaltyMilestoneItemDto[];
    },
    userRole: string,
    userStudioId: string | undefined,
  ) {
    if (!isOwnerLevelRole(userRole)) {
      throw new ForbiddenException('Only owner level role can change loyalty settings');
    }
    const studio = await this.prisma.studio.findUnique({ where: { id: studioId } });
    if (!studio) throw new NotFoundException('Studio not found');

    const orgId = studio.organizationId;

    if (dto.loyaltyMode === StudioLoyaltyMode.PRESET) {
      await this.prisma.$transaction([
        this.prisma.studioLoyaltyMilestone.deleteMany({ where: { organizationId: orgId } }),
        this.prisma.studioLoyaltyTier.deleteMany({ where: { organizationId: orgId } }),
        this.prisma.clientStudioLoyalty.deleteMany({ where: { organizationId: orgId } }),
        this.prisma.organization.update({
          where: { id: orgId },
          data: { loyaltyMode: StudioLoyaltyMode.PRESET },
        }),
      ]);
      return this.getLoyalty(studioId, userRole, userStudioId);
    }

    const tiers = dto.tiers ?? [];
    const milestones = dto.milestones ?? [];
    if (tiers.length === 0 || milestones.length === 0) {
      throw new BadRequestException('В режиме CUSTOM передайте tiers и milestones');
    }
    this.validateCustomLoyaltyPayload(tiers, milestones);

    const snapshots = await this.prisma.clientStudioLoyalty.findMany({
      where: { organizationId: orgId },
      include: { currentTier: true },
    });
    const snapData = snapshots.map((row) => ({
      id: row.id,
      totalPaid: row.totalPaid,
      levelSetManually: row.levelSetManually,
      manualSortOrder:
        row.levelSetManually && row.currentTier ? row.currentTier.sortOrder : null,
    }));

    await this.prisma.$transaction(async (tx) => {
      await tx.studioLoyaltyMilestone.deleteMany({ where: { organizationId: orgId } });
      await tx.studioLoyaltyTier.deleteMany({ where: { organizationId: orgId } });

      for (const t of tiers) {
        await tx.studioLoyaltyTier.create({
          data: {
            id: generateId(IdPrefix.StudioLoyaltyTier),
            organizationId: orgId,
            sortOrder: t.sortOrder,
            name: t.name,
            cashbackPercent: t.cashbackPercent,
            manualOnly: t.manualOnly ?? false,
          },
        });
      }

      for (const m of milestones) {
        await tx.studioLoyaltyMilestone.create({
          data: {
            id: generateId(IdPrefix.StudioLoyaltyMilestone),
            organizationId: orgId,
            minTotalPaid: m.minTotalPaid,
            targetSortOrder: m.targetSortOrder,
          },
        });
      }

      await tx.organization.update({
        where: { id: orgId },
        data: { loyaltyMode: StudioLoyaltyMode.CUSTOM },
      });

      const createdTiers = await tx.studioLoyaltyTier.findMany({
        where: { organizationId: orgId },
        orderBy: { sortOrder: 'asc' },
      });
      const tierLikes = createdTiers.map((ct) => ({
        id: ct.id,
        sortOrder: ct.sortOrder,
        name: ct.name,
        cashbackPercent: ct.cashbackPercent,
        manualOnly: ct.manualOnly,
      }));
      const milestoneLikes = milestones.map((m) => ({
        minTotalPaid: m.minTotalPaid,
        targetSortOrder: m.targetSortOrder,
      }));

      for (const snap of snapData) {
        let currentTierId: string | null = null;
        let levelSetManually = snap.levelSetManually;
        if (levelSetManually && snap.manualSortOrder != null) {
          const t = createdTiers.find((ct) => ct.sortOrder === snap.manualSortOrder);
          if (t) {
            currentTierId = t.id;
          } else {
            levelSetManually = false;
          }
        }
        if (currentTierId == null) {
          const resolved = resolveAutoTierForTotalPaid(tierLikes, milestoneLikes, snap.totalPaid);
          currentTierId = resolved?.id ?? null;
          levelSetManually = false;
        }
        await tx.clientStudioLoyalty.update({
          where: { id: snap.id },
          data: { currentTierId, levelSetManually },
        });
      }
    });

    return this.getLoyalty(studioId, userRole, userStudioId);
  }
}
