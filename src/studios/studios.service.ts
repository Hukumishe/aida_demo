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
} from '@prisma/client';
import { generateId, IdPrefix } from '../common/id-generator';
import { CreateStudioDto } from './dto/create-studio.dto';
import { UserRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';

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
}


