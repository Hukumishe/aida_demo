import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateId, IdPrefix } from '../common/id-generator';
import { isOwnerLevelRole, UserRole } from '../common/decorators/roles.decorator';
import { CreateStudioReferralLinkDto } from './dto/create-referral-link.dto';
import { UpdateStudioReferralLinkDto } from './dto/update-referral-link.dto';

@Injectable()
export class ReferralLinksService {
  constructor(private readonly prisma: PrismaService) {}

  private assertOwnerOrDeputy(userRole: string) {
    if (userRole !== UserRole.OWNER && userRole !== UserRole.DEPUTY_OWNER) {
      throw new ForbiddenException('Только владелец или заместитель могут управлять реферальными ссылками');
    }
  }

  private assertStudioRead(studioId: string, userRole: string, userStudioId?: string) {
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userStudioId !== studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }
    }
  }

  async findAll(studioId: string, userRole: string, userStudioId?: string) {
    this.assertStudioRead(studioId, userRole, userStudioId);
    return this.prisma.studioReferralLink.findMany({
      where: { studioId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    studioId: string,
    dto: CreateStudioReferralLinkDto,
    userRole: string,
    userStudioId?: string,
  ) {
    this.assertOwnerOrDeputy(userRole);
    this.assertStudioRead(studioId, userRole, userStudioId);

    if (dto.cashbackEnabled) {
      if (dto.cashbackPercent == null) {
        throw new BadRequestException('Укажите процент кэшбэка при включённом начислении');
      }
    }

    return this.prisma.studioReferralLink.create({
      data: {
        id: generateId(IdPrefix.StudioReferralLink),
        studioId,
        sourceName: dto.sourceName.trim(),
        cashbackEnabled: dto.cashbackEnabled,
        cashbackPercent: dto.cashbackEnabled ? dto.cashbackPercent! : null,
      },
    });
  }

  async update(
    studioId: string,
    linkId: string,
    dto: UpdateStudioReferralLinkDto,
    userRole: string,
    userStudioId?: string,
  ) {
    this.assertOwnerOrDeputy(userRole);
    this.assertStudioRead(studioId, userRole, userStudioId);

    const existing = await this.prisma.studioReferralLink.findFirst({
      where: { id: linkId, studioId },
    });
    if (!existing) throw new NotFoundException('Ссылка не найдена');

    const nextCashbackEnabled = dto.cashbackEnabled ?? existing.cashbackEnabled;
    if (nextCashbackEnabled) {
      const pct = dto.cashbackPercent ?? existing.cashbackPercent;
      if (pct == null || pct < 1) {
        throw new BadRequestException('При включённом кэшбэке укажите процент от 1 до 100');
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.sourceName !== undefined) data.sourceName = dto.sourceName.trim();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.cashbackEnabled !== undefined) data.cashbackEnabled = dto.cashbackEnabled;
    if (dto.cashbackPercent !== undefined) data.cashbackPercent = dto.cashbackPercent;
    if (dto.cashbackEnabled === false) {
      data.cashbackPercent = null;
    } else if (nextCashbackEnabled && dto.cashbackPercent !== undefined) {
      data.cashbackPercent = dto.cashbackPercent;
    }

    return this.prisma.studioReferralLink.update({
      where: { id: linkId },
      data: data as any,
    });
  }

  /** Публичная проверка ссылки для лендинга (до регистрации) */
  async resolveForLanding(studioId: string, linkId: string) {
    const link = await this.prisma.studioReferralLink.findFirst({
      where: { id: linkId, studioId },
    });
    if (!link || !link.isActive) {
      return { valid: false as const };
    }
    return {
      valid: true as const,
      sourceName: link.sourceName,
      cashbackEnabled: link.cashbackEnabled,
      cashbackPercent: link.cashbackPercent,
    };
  }
}
