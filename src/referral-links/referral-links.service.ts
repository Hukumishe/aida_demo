import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateId, IdPrefix } from '../common/id-generator';
import { getOrganizationIdForStudio } from '../common/organization-scope';
import {
  canManageMarketingContent,
  hasOrganizationWideStudioAccess,
} from '../common/decorators/roles.decorator';
import { CreateStudioReferralLinkDto } from './dto/create-referral-link.dto';
import { UpdateStudioReferralLinkDto } from './dto/update-referral-link.dto';

@Injectable()
export class ReferralLinksService {
  constructor(private readonly prisma: PrismaService) {}

  private assertCanManageLinks(userRole: string) {
    if (!canManageMarketingContent(userRole)) {
      throw new ForbiddenException(
        'Управлять реферальными ссылками может владелец сети или маркетолог',
      );
    }
  }

  private assertStudioRead(studioId: string, userRole: string, userStudioId?: string) {
    if (!hasOrganizationWideStudioAccess(userRole)) {
      if (userStudioId !== studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }
    }
  }

  async findAll(studioId: string, userRole: string, userStudioId?: string) {
    this.assertStudioRead(studioId, userRole, userStudioId);
    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);
    return this.prisma.studioReferralLink.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    studioId: string,
    dto: CreateStudioReferralLinkDto,
    userRole: string,
    userStudioId?: string,
  ) {
    this.assertCanManageLinks(userRole);
    this.assertStudioRead(studioId, userRole, userStudioId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    if (dto.cashbackEnabled) {
      if (dto.cashbackPercent == null) {
        throw new BadRequestException('Укажите процент кэшбэка при включённом начислении');
      }
    }

    return this.prisma.studioReferralLink.create({
      data: {
        id: generateId(IdPrefix.StudioReferralLink),
        organizationId,
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
    this.assertCanManageLinks(userRole);
    this.assertStudioRead(studioId, userRole, userStudioId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const existing = await this.prisma.studioReferralLink.findFirst({
      where: { id: linkId, organizationId },
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
    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);
    const link = await this.prisma.studioReferralLink.findFirst({
      where: { id: linkId, organizationId },
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
