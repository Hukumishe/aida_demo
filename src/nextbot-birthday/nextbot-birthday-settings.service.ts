import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BirthdayBonusType, ClientLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  isDeveloperRole,
  isOwnerLevelRole,
} from '../common/decorators/roles.decorator';
import { assertUserOrganizationMatchesStudio } from '../common/organization-scope';
import { UpsertBirthdaySettingsDto } from './dto/upsert-birthday-settings.dto';

@Injectable()
export class NextbotBirthdaySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertCanEdit(role?: string) {
    if (!isDeveloperRole(role) && !isOwnerLevelRole(role)) {
      throw new ForbiddenException(
        'Настройки дня рождения может менять только владелец сети (или разработчик)',
      );
    }
  }

  private validateBonus(dto: { bonusValue?: number }) {
    if (dto.bonusValue != null && dto.bonusValue < 1) {
      throw new BadRequestException('Количество бонусных баллов должно быть ≥ 1');
    }
  }

  private mapRow(row: {
    studioId: string;
    isActive: boolean;
    minClientLevel: ClientLevel;
    daysBeforeBirthday: number;
    bonusType: BirthdayBonusType;
    bonusValue: number;
    messageText: string;
    updatedAt: Date;
  }) {
    return {
      studioId: row.studioId,
      isActive: row.isActive,
      minClientLevel: row.minClientLevel,
      daysBeforeBirthday: row.daysBeforeBirthday,
      bonusType: row.bonusType,
      bonusValue: row.bonusValue,
      messageText: row.messageText,
      updatedAt: row.updatedAt,
    };
  }

  async getSettings(
    studioId: string,
    userRole?: string,
    userOrganizationId?: string,
  ) {
    await assertUserOrganizationMatchesStudio(
      this.prisma,
      studioId,
      userOrganizationId,
      userRole,
    );

    const row = await this.prisma.studioBirthdayMessageSettings.findUnique({
      where: { studioId },
    });

    if (!row) {
      return {
        studioId,
        isActive: false,
        minClientLevel: ClientLevel.BRONZE,
        daysBeforeBirthday: 3,
        bonusType: BirthdayBonusType.BONUS_POINTS,
        bonusValue: 500,
        messageText:
          '{{name}}, с наступающим днём рождения! Вам начислено {{bonusDescription}}.',
        configured: false,
      };
    }

    return { ...this.mapRow(row), configured: true };
  }

  async upsertSettings(
    studioId: string,
    dto: UpsertBirthdaySettingsDto,
    userRole?: string,
    userOrganizationId?: string,
  ) {
    this.assertCanEdit(userRole);
    await assertUserOrganizationMatchesStudio(
      this.prisma,
      studioId,
      userOrganizationId,
      userRole,
    );

    const existing = await this.prisma.studioBirthdayMessageSettings.findUnique({
      where: { studioId },
    });

    const merged = {
      isActive: dto.isActive ?? existing?.isActive ?? false,
      minClientLevel: dto.minClientLevel ?? existing?.minClientLevel ?? ClientLevel.BRONZE,
      daysBeforeBirthday:
        dto.daysBeforeBirthday ?? existing?.daysBeforeBirthday ?? 3,
      bonusType: BirthdayBonusType.BONUS_POINTS,
      bonusValue: dto.bonusValue ?? existing?.bonusValue ?? 500,
      messageText:
        dto.messageText?.trim() ??
        existing?.messageText ??
        '{{name}}, с наступающим днём рождения! {{bonusDescription}}',
    };

    this.validateBonus(merged);

    if (!merged.messageText.trim()) {
      throw new BadRequestException('Укажите поздравительный текст');
    }

    const data: Prisma.StudioBirthdayMessageSettingsCreateInput = {
      studio: { connect: { id: studioId } },
      isActive: merged.isActive,
      minClientLevel: merged.minClientLevel,
      daysBeforeBirthday: merged.daysBeforeBirthday,
      bonusType: merged.bonusType,
      bonusValue: merged.bonusValue,
      messageText: merged.messageText.trim(),
    };

    const row = await this.prisma.studioBirthdayMessageSettings.upsert({
      where: { studioId },
      create: data,
      update: {
        isActive: merged.isActive,
        minClientLevel: merged.minClientLevel,
        daysBeforeBirthday: merged.daysBeforeBirthday,
        bonusType: merged.bonusType,
        bonusValue: merged.bonusValue,
        messageText: merged.messageText.trim(),
      },
    });

    return { ...this.mapRow(row), configured: true };
  }

  async findLogs(
    studioId: string,
    userOrganizationId?: string,
    userRole?: string,
    limit = 100,
  ) {
    await assertUserOrganizationMatchesStudio(
      this.prisma,
      studioId,
      userOrganizationId,
      userRole,
    );

    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { organizationId: true },
    });
    if (!studio) {
      throw new NotFoundException('Studio not found');
    }

    const rows = await this.prisma.nextbotBirthdayMessageLog.findMany({
      where: { studioId },
      take: Math.min(limit, 500),
      orderBy: { scheduledAt: 'desc' },
      include: {
        client: { select: { id: true, firstName: true, phone: true, birthDate: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      clientName: r.client.firstName,
      congratulationYear: r.congratulationYear,
      scheduledAt: r.scheduledAt,
      sentAt: r.sentAt,
      status: r.status,
      skipReason: r.skipReason,
      error: r.error,
      bonusApplied: r.bonusApplied,
      renderedText: r.renderedText,
    }));
  }
}
