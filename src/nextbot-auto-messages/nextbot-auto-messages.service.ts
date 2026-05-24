import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NextbotAutoMessageOffsetUnit,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  UserRole,
  isDeveloperRole,
  isOwnerLevelRole,
} from '../common/decorators/roles.decorator';
import { assertUserOrganizationMatchesStudio } from '../common/organization-scope';
import { getDisabledCategoryIdsForStudio } from '../common/service-studio-offering';
import { generateId, IdPrefix } from '../common/id-generator';
import { CreateNextbotAutoMessageTemplateDto } from './dto/create-nextbot-auto-message-template.dto';
import { UpdateNextbotAutoMessageTemplateDto } from './dto/update-nextbot-auto-message-template.dto';
import { NEXTBOT_AUTO_MESSAGE_VARIABLES } from './nextbot-auto-message-variables';

const MAX_OFFSET_MINUTES = 365 * 24 * 60;

@Injectable()
export class NextbotAutoMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  private canEdit(role: string | undefined): boolean {
    return (
      isDeveloperRole(role) ||
      isOwnerLevelRole(role) ||
      role === UserRole.MARKETER ||
      role === UserRole.SERVICE
    );
  }

  private assertCanEdit(role: string | undefined) {
    if (!this.canEdit(role)) {
      throw new ForbiddenException(
        'Редактировать автосообщения могут владелец, заместитель, маркетолог, SERVICE или разработчик',
      );
    }
  }

  private offsetToMinutes(value: number, unit: NextbotAutoMessageOffsetUnit): number {
    switch (unit) {
      case NextbotAutoMessageOffsetUnit.MINUTES:
        return value;
      case NextbotAutoMessageOffsetUnit.HOURS:
        return value * 60;
      case NextbotAutoMessageOffsetUnit.DAYS:
        return value * 24 * 60;
      default:
        return value;
    }
  }

  private validateOffset(value: number, unit: NextbotAutoMessageOffsetUnit) {
    const minutes = this.offsetToMinutes(value, unit);
    if (minutes < 1) {
      throw new BadRequestException('Смещение должно быть не меньше 1 минуты');
    }
    if (minutes > MAX_OFFSET_MINUTES) {
      throw new BadRequestException('Смещение не может превышать 365 дней');
    }
  }

  private async assertCategoryOfferedInStudio(studioId: string, categoryId: string) {
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { organizationId: true },
    });
    if (!studio) {
      throw new NotFoundException(`Studio with ID ${studioId} not found`);
    }
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
      select: { organizationId: true, isActive: true, name: true },
    });
    if (!category || category.organizationId !== studio.organizationId) {
      throw new BadRequestException(
        'Категория не найдена или не принадлежит организации этого филиала',
      );
    }
    if (!category.isActive) {
      throw new BadRequestException('Категория отключена в каталоге сети');
    }
    const disabled = await getDisabledCategoryIdsForStudio(this.prisma, studioId);
    if (disabled.has(categoryId)) {
      throw new BadRequestException('Категория отключена в этом филиале');
    }
    return { studio, category };
  }

  private templateInclude() {
    return {
      category: { select: { id: true, name: true, isActive: true } },
    } satisfies Prisma.NextbotAutoMessageTemplateInclude;
  }

  private mapTemplate(row: {
    id: string;
    studioId: string;
    serviceCategoryId: string;
    timing: string;
    offsetValue: number;
    offsetUnit: string;
    messageText: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    category: { id: string; name: string; isActive: boolean };
  }) {
    return {
      id: row.id,
      studioId: row.studioId,
      serviceCategoryId: row.serviceCategoryId,
      serviceCategoryName: row.category.name,
      timing: row.timing,
      offsetValue: row.offsetValue,
      offsetUnit: row.offsetUnit,
      messageText: row.messageText,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  listVariables() {
    return {
      syntax: '{{variableKey}}',
      variables: NEXTBOT_AUTO_MESSAGE_VARIABLES,
    };
  }

  async findAll(studioId: string, userRole?: string, userOrganizationId?: string) {
    await assertUserOrganizationMatchesStudio(
      this.prisma,
      studioId,
      userOrganizationId,
      userRole,
    );
    const rows = await this.prisma.nextbotAutoMessageTemplate.findMany({
      where: { studioId },
      include: this.templateInclude(),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => this.mapTemplate(r));
  }

  async findOne(
    studioId: string,
    templateId: string,
    userRole?: string,
    userOrganizationId?: string,
  ) {
    await assertUserOrganizationMatchesStudio(
      this.prisma,
      studioId,
      userOrganizationId,
      userRole,
    );
    const row = await this.prisma.nextbotAutoMessageTemplate.findFirst({
      where: { id: templateId, studioId },
      include: this.templateInclude(),
    });
    if (!row) {
      throw new NotFoundException('Шаблон автосообщения не найден');
    }
    return this.mapTemplate(row);
  }

  async create(
    studioId: string,
    dto: CreateNextbotAutoMessageTemplateDto,
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
    this.validateOffset(dto.offsetValue, dto.offsetUnit);
    await this.assertCategoryOfferedInStudio(studioId, dto.serviceCategoryId);

    const created = await this.prisma.nextbotAutoMessageTemplate.create({
      data: {
        id: generateId(IdPrefix.NextbotAutoMessageTemplate),
        studioId,
        serviceCategoryId: dto.serviceCategoryId,
        timing: dto.timing,
        offsetValue: dto.offsetValue,
        offsetUnit: dto.offsetUnit,
        messageText: dto.messageText.trim(),
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: this.templateInclude(),
    });
    return this.mapTemplate(created);
  }

  async update(
    studioId: string,
    templateId: string,
    dto: UpdateNextbotAutoMessageTemplateDto,
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

    const existing = await this.prisma.nextbotAutoMessageTemplate.findFirst({
      where: { id: templateId, studioId },
    });
    if (!existing) {
      throw new NotFoundException('Шаблон автосообщения не найден');
    }

    const nextOffsetValue = dto.offsetValue ?? existing.offsetValue;
    const nextOffsetUnit = dto.offsetUnit ?? existing.offsetUnit;
    this.validateOffset(nextOffsetValue, nextOffsetUnit);

    if (dto.serviceCategoryId) {
      await this.assertCategoryOfferedInStudio(studioId, dto.serviceCategoryId);
    }

    const data: Prisma.NextbotAutoMessageTemplateUpdateInput = {};
    if (dto.serviceCategoryId !== undefined) {
      data.category = { connect: { id: dto.serviceCategoryId } };
    }
    if (dto.timing !== undefined) data.timing = dto.timing;
    if (dto.offsetValue !== undefined) data.offsetValue = dto.offsetValue;
    if (dto.offsetUnit !== undefined) data.offsetUnit = dto.offsetUnit;
    if (dto.messageText !== undefined) data.messageText = dto.messageText.trim();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    const updated = await this.prisma.nextbotAutoMessageTemplate.update({
      where: { id: templateId },
      data,
      include: this.templateInclude(),
    });
    return this.mapTemplate(updated);
  }

  async remove(
    studioId: string,
    templateId: string,
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
    const existing = await this.prisma.nextbotAutoMessageTemplate.findFirst({
      where: { id: templateId, studioId },
    });
    if (!existing) {
      throw new NotFoundException('Шаблон автосообщения не найден');
    }
    await this.prisma.nextbotAutoMessageTemplate.delete({ where: { id: templateId } });
    return { deleted: true, id: templateId };
  }
}
