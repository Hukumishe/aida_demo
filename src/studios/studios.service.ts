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
  StudioLoyaltyMode,
} from '@prisma/client';
import { generateId, IdPrefix } from '../common/id-generator';
import { CreateStudioDto } from './dto/create-studio.dto';
import {
  StudioLoyaltyMilestoneItemDto,
  StudioLoyaltyTierItemDto,
} from './dto/update-studio-loyalty.dto';
import { UserRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';
import { resolveAutoTierForTotalPaid } from '../common/loyalty/studio-loyalty.util';

@Injectable()
export class StudiosService {
  constructor(private prisma: PrismaService) {}

  async findAll(userRole: string, userStudioId?: string) {
    if (isOwnerLevelRole(userRole)) {
      return this.prisma.studio.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }

    // MANAGER and MASTER can only see their studio
    if (!userStudioId) {
      return [];
    }

    return this.prisma.studio.findMany({
      where: { id: userStudioId },
    });
  }

  async create(createStudioDto: CreateStudioDto) {
    return this.prisma.studio.create({
      data: {
        id: generateId(IdPrefix.Studio),
        name: createStudioDto.name,
        address: createStudioDto.address,
        timezone: createStudioDto.timezone || 'Asia/Almaty',
      },
    });
  }

  async findOne(id: string, userRole: string, userStudioId?: string) {
    const studio = await this.prisma.studio.findUnique({
      where: { id },
    });

    if (!studio) {
      return null;
    }

    // OWNER and DEPUTY_OWNER can access any studio
    if (isOwnerLevelRole(userRole)) {
      return studio;
    }

    // MANAGER and MASTER can only access their studio
    if (userStudioId !== id) {
      throw new ForbiddenException('Access denied to this studio');
    }

    return studio;
  }

  async getSettings(studioId: string, userRole: string, userStudioId?: string) {
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: {
        id: true,
        loyaltyMode: true,
        globalBonusPaymentLimitPercent: true,
        referFriendEnabled: true,
        referFriendInviteeRewardType: true,
        referFriendInviteeValue: true,
        referFriendReferrerRewardType: true,
        referFriendReferrerValue: true,
      },
    });
    if (!studio) throw new NotFoundException('Studio not found');
    if (!isOwnerLevelRole(userRole) && userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
    }
    return {
      loyaltyMode: studio.loyaltyMode,
      globalBonusPaymentLimitPercent: studio.globalBonusPaymentLimitPercent ?? 30,
      referFriendEnabled: studio.referFriendEnabled,
      referFriendInviteeRewardType: studio.referFriendInviteeRewardType,
      referFriendInviteeValue: studio.referFriendInviteeValue,
      referFriendReferrerRewardType: studio.referFriendReferrerRewardType,
      referFriendReferrerValue: studio.referFriendReferrerValue,
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
    },
    userRole: string,
  ) {
    if (!isOwnerLevelRole(userRole)) {
      throw new ForbiddenException('Only owner level role can change studio settings');
    }
    const studio = await this.prisma.studio.findUnique({ where: { id: studioId } });
    if (!studio) throw new NotFoundException('Studio not found');

    const nextEnabled = dto.referFriendEnabled ?? studio.referFriendEnabled;
    const nextInviteeType = dto.referFriendInviteeRewardType ?? studio.referFriendInviteeRewardType;
    const nextInviteeValue =
      dto.referFriendInviteeValue !== undefined ? dto.referFriendInviteeValue : studio.referFriendInviteeValue;
    const nextReferrerType =
      dto.referFriendReferrerRewardType ?? studio.referFriendReferrerRewardType;
    const nextReferrerValue =
      dto.referFriendReferrerValue !== undefined
        ? dto.referFriendReferrerValue
        : studio.referFriendReferrerValue;

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

    return this.prisma.studio.update({
      where: { id: studioId },
      data: data as any,
    });
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
          `Уровни: sortOrder должны идти без пропусков от 0 до ${sortOrders.length - 1}`,
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

  async getLoyalty(studioId: string, userRole: string, userStudioId?: string) {
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { id: true, loyaltyMode: true },
    });
    if (!studio) throw new NotFoundException('Studio not found');
    if (!isOwnerLevelRole(userRole) && userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
    }
    const [tiers, milestones] = await Promise.all([
      this.prisma.studioLoyaltyTier.findMany({
        where: { studioId },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.studioLoyaltyMilestone.findMany({
        where: { studioId },
        orderBy: { minTotalPaid: 'asc' },
      }),
    ]);
    return { loyaltyMode: studio.loyaltyMode, tiers, milestones };
  }

  async updateLoyalty(
    studioId: string,
    dto: {
      loyaltyMode: StudioLoyaltyMode;
      tiers?: StudioLoyaltyTierItemDto[];
      milestones?: StudioLoyaltyMilestoneItemDto[];
    },
    userRole: string,
  ) {
    if (!isOwnerLevelRole(userRole)) {
      throw new ForbiddenException('Only owner level role can change loyalty settings');
    }
    const studio = await this.prisma.studio.findUnique({ where: { id: studioId } });
    if (!studio) throw new NotFoundException('Studio not found');

    if (dto.loyaltyMode === StudioLoyaltyMode.PRESET) {
      await this.prisma.$transaction([
        this.prisma.studioLoyaltyMilestone.deleteMany({ where: { studioId } }),
        this.prisma.studioLoyaltyTier.deleteMany({ where: { studioId } }),
        this.prisma.clientStudioLoyalty.deleteMany({ where: { studioId } }),
        this.prisma.studio.update({
          where: { id: studioId },
          data: { loyaltyMode: StudioLoyaltyMode.PRESET },
        }),
      ]);
      return this.getLoyalty(studioId, userRole, studioId);
    }

    const tiers = dto.tiers ?? [];
    const milestones = dto.milestones ?? [];
    if (tiers.length === 0 || milestones.length === 0) {
      throw new BadRequestException('В режиме CUSTOM передайте tiers и milestones');
    }
    this.validateCustomLoyaltyPayload(tiers, milestones);

    const snapshots = await this.prisma.clientStudioLoyalty.findMany({
      where: { studioId },
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
      await tx.studioLoyaltyMilestone.deleteMany({ where: { studioId } });
      await tx.studioLoyaltyTier.deleteMany({ where: { studioId } });

      for (const t of tiers) {
        await tx.studioLoyaltyTier.create({
          data: {
            id: generateId(IdPrefix.StudioLoyaltyTier),
            studioId,
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
            studioId,
            minTotalPaid: m.minTotalPaid,
            targetSortOrder: m.targetSortOrder,
          },
        });
      }

      await tx.studio.update({
        where: { id: studioId },
        data: { loyaltyMode: StudioLoyaltyMode.CUSTOM },
      });

      const createdTiers = await tx.studioLoyaltyTier.findMany({
        where: { studioId },
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

    return this.getLoyalty(studioId, userRole, studioId);
  }
}


