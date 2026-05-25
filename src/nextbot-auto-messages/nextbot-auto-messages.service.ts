import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NextbotAutoMessageOffsetUnit,
  NextbotAutoMessageTriggerType,
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
import {
  NEXTBOT_AUTO_MESSAGE_VARIABLES,
  NextbotAutoMessageVariableKey,
  renderNextbotAutoMessageTemplate,
} from './nextbot-auto-message-variables';
import { TestSendNextbotMessageDto } from './dto/test-send-nextbot-message.dto';
import { NextbotOutboundService } from './nextbot-outbound.service';
import { NextbotAutoMessageOrchestratorService } from './nextbot-auto-message-orchestrator.service';
import {
  assertValidTemplateSchedule,
  getCustomScheduleFormSchema,
  getStatusChangedFormSchema,
  isStatusChangedTrigger,
  NEXTBOT_TRIGGER_TYPE_LABELS,
  requiresServiceCategory,
} from './nextbot-auto-message-template-config';
import {
  APPOINTMENT_STATUS_LABELS,
  listAppointmentStatusOptions,
} from '../appointments/appointment-status.constants';
import {
  AppointmentStatus,
  NextbotAutoMessageAnchor,
  NextbotAutoMessageDirection,
} from '@prisma/client';

const MAX_OFFSET_MINUTES = 365 * 24 * 60;

@Injectable()
export class NextbotAutoMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: NextbotOutboundService,
    private readonly orchestrator: NextbotAutoMessageOrchestratorService,
  ) {}

  private canEdit(role: string | undefined): boolean {
    return isDeveloperRole(role) || isOwnerLevelRole(role);
  }

  private assertCanEdit(role: string | undefined) {
    if (!this.canEdit(role)) {
      throw new ForbiddenException(
        'Редактировать автосообщения может только владелец сети (или разработчик)',
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

  private requiresCategory(triggerType: NextbotAutoMessageTriggerType): boolean {
    return requiresServiceCategory(triggerType);
  }

  private validateTemplateScheduleOrThrow(params: {
    triggerType: NextbotAutoMessageTriggerType;
    anchor: import('@prisma/client').NextbotAutoMessageAnchor;
    direction: import('@prisma/client').NextbotAutoMessageDirection;
    serviceCategoryId?: string | null;
    triggerOnStatus?: AppointmentStatus | null;
  }) {
    try {
      assertValidTemplateSchedule(params);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : String(e));
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

  /** Схема формы «своё сообщение» (до/после процедуры по категории). */
  getCustomScheduleFormSchema() {
    return getCustomScheduleFormSchema();
  }

  getStatusChangedFormSchema() {
    return getStatusChangedFormSchema();
  }

  listAppointmentStatuses() {
    return listAppointmentStatusOptions();
  }

  private normalizeStatusChangedSchedule(
    dto: Pick<
      CreateNextbotAutoMessageTemplateDto,
      'triggerType' | 'anchor' | 'direction' | 'offsetValue' | 'offsetUnit' | 'triggerOnStatus'
    >,
  ) {
    if (!isStatusChangedTrigger(dto.triggerType)) {
      return dto;
    }
    return {
      ...dto,
      anchor: NextbotAutoMessageAnchor.NONE,
      direction: NextbotAutoMessageDirection.AFTER,
      offsetValue: dto.offsetValue ?? 1,
      offsetUnit: dto.offsetUnit ?? NextbotAutoMessageOffsetUnit.MINUTES,
    };
  }

  /** Пресеты для админки (типовые сценарии из ТЗ). */
  listTriggerPresets() {
    return [
      {
        triggerType: NextbotAutoMessageTriggerType.BOOKING_CONFIRMED,
        anchor: 'NONE',
        direction: 'AFTER',
        offsetValue: 0,
        offsetUnit: 'MINUTES',
        minLeadDays: null,
        hint: 'Сразу при переходе записи в BOOKED',
      },
      {
        triggerType: NextbotAutoMessageTriggerType.REMINDER_BEFORE_VISIT,
        anchor: 'APPOINTMENT_START',
        direction: 'BEFORE',
        offsetValue: 1,
        offsetUnit: 'DAYS',
        minLeadDays: 2,
        hint: 'За 24 ч до визита, если с BOOKED до startAt ≥ 2 суток',
      },
      {
        triggerType: NextbotAutoMessageTriggerType.REMINDER_BEFORE_VISIT,
        anchor: 'APPOINTMENT_START',
        direction: 'BEFORE',
        offsetValue: 4,
        offsetUnit: 'HOURS',
        minLeadDays: null,
        hint: 'За 4 ч до визита, всегда',
      },
      {
        triggerType: NextbotAutoMessageTriggerType.HOLD_EXPIRY_WARNING,
        anchor: 'HOLD_EXPIRES_AT',
        direction: 'BEFORE',
        offsetValue: 5,
        offsetUnit: 'MINUTES',
        minLeadDays: null,
        hint: 'За 5 мин до конца ночного холда',
      },
      {
        triggerType: NextbotAutoMessageTriggerType.FOLLOWUP_AFTER_VISIT,
        anchor: 'VISIT_DONE_AT',
        direction: 'AFTER',
        offsetValue: 24,
        offsetUnit: 'DAYS',
        minLeadDays: null,
        hint: 'Через N дней после DONE (категория обязательна)',
      },
      {
        triggerType: NextbotAutoMessageTriggerType.FEEDBACK_REQUEST,
        anchor: 'VISIT_DONE_AT',
        direction: 'AFTER',
        offsetValue: 15,
        offsetUnit: 'MINUTES',
        minLeadDays: null,
        hint: 'Через N мин после DONE — запрос оценки (категория обязательна)',
      },
      {
        triggerType: NextbotAutoMessageTriggerType.STATUS_CHANGED,
        anchor: 'NONE',
        direction: 'AFTER',
        offsetValue: 1,
        offsetUnit: 'MINUTES',
        triggerOnStatus: AppointmentStatus.AWAITING_PREPAYMENT,
        minLeadDays: null,
        hint: 'Сразу при переходе записи в «Ожидаем предоплату»',
      },
    ];
  }

  private mapTemplate(row: {
    id: string;
    studioId: string;
    serviceCategoryId: string | null;
    triggerType: string;
    triggerOnStatus: AppointmentStatus | null;
    anchor: string;
    direction: string;
    offsetValue: number;
    offsetUnit: string;
    minLeadDays: number | null;
    messageText: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    category: { id: string; name: string; isActive: boolean } | null;
  }) {
    return {
      id: row.id,
      studioId: row.studioId,
      serviceCategoryId: row.serviceCategoryId,
      serviceCategoryName: row.category?.name ?? null,
      triggerType: row.triggerType,
      triggerTypeLabel:
        NEXTBOT_TRIGGER_TYPE_LABELS[
          row.triggerType as keyof typeof NEXTBOT_TRIGGER_TYPE_LABELS
        ] ?? row.triggerType,
      triggerOnStatus: row.triggerOnStatus ?? null,
      triggerOnStatusLabel:
        row.triggerOnStatus != null
          ? APPOINTMENT_STATUS_LABELS[row.triggerOnStatus]
          : null,
      anchor: row.anchor,
      direction: row.direction,
      offsetValue: row.offsetValue,
      offsetUnit: row.offsetUnit,
      minLeadDays: row.minLeadDays,
      messageText: row.messageText,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findLogs(
    studioId: string,
    userRole?: string,
    userOrganizationId?: string,
    limit = 100,
  ) {
    await assertUserOrganizationMatchesStudio(
      this.prisma,
      studioId,
      userOrganizationId,
      userRole,
    );
    const rows = await this.prisma.nextbotAutoMessageLog.findMany({
      where: { appointment: { studioId } },
      take: Math.min(limit, 500),
      orderBy: { scheduledAt: 'desc' },
      include: {
        template: { select: { id: true, triggerType: true, messageText: true } },
        appointment: { select: { id: true, startAt: true, status: true } },
        client: { select: { id: true, firstName: true, phone: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      templateId: r.templateId,
      triggerType: r.template.triggerType,
      appointmentId: r.appointmentId,
      appointmentStatus: r.appointment.status,
      clientId: r.clientId,
      clientName: r.client.firstName,
      scheduledAt: r.scheduledAt,
      sentAt: r.sentAt,
      status: r.status,
      skipReason: r.skipReason,
      error: r.error,
      renderedText: r.renderedText,
    }));
  }

  listVariables() {
    return {
      syntax: '{{variableKey}}',
      variables: NEXTBOT_AUTO_MESSAGE_VARIABLES,
    };
  }

  /**
   * Тестовая отправка в Nextbot с вашими данными (не пишет в очередь автосообщений).
   */
  async testSend(
    studioId: string,
    dto: TestSendNextbotMessageDto,
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
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { organizationId: true },
    });
    if (!studio) {
      throw new NotFoundException(`Studio with ID ${studioId} not found`);
    }

    let rawText = dto.messageText?.trim() ?? '';
    if (!rawText && dto.templateId?.trim()) {
      const template = await this.prisma.nextbotAutoMessageTemplate.findFirst({
        where: { id: dto.templateId.trim(), studioId },
      });
      if (!template) {
        throw new NotFoundException('Шаблон не найден в этом филиале');
      }
      rawText = template.messageText;
    }
    if (!rawText) {
      throw new BadRequestException('Укажите messageText или templateId');
    }

    let variables: Partial<Record<NextbotAutoMessageVariableKey, string>> = {};
    if (dto.appointmentId?.trim()) {
      variables = await this.orchestrator.getVariablesForAppointment(
        dto.appointmentId.trim(),
        studioId,
      );
    }
    if (dto.variables && typeof dto.variables === 'object') {
      for (const [key, value] of Object.entries(dto.variables)) {
        if (value != null) {
          variables[key as NextbotAutoMessageVariableKey] = String(value);
        }
      }
    }

    const renderedText = renderNextbotAutoMessageTemplate(rawText, variables);
    const dialogId = dto.dialogId;

    try {
      await this.outbound.send(studio.organizationId, {
        dialogId,
        text: renderedText,
        appointmentId: dto.appointmentId?.trim() || undefined,
        templateId: dto.templateId?.trim() || undefined,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(message);
    }

    return {
      ok: true,
      dialogId,
      renderedText,
      variablesUsed: variables,
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
    const normalized = this.normalizeStatusChangedSchedule(dto);
    if (!isStatusChangedTrigger(normalized.triggerType)) {
      this.validateOffset(normalized.offsetValue!, normalized.offsetUnit!);
    }
    this.validateTemplateScheduleOrThrow({
      triggerType: normalized.triggerType,
      anchor: normalized.anchor!,
      direction: normalized.direction!,
      serviceCategoryId: dto.serviceCategoryId,
      triggerOnStatus: normalized.triggerOnStatus ?? null,
    });
    if (dto.serviceCategoryId?.trim()) {
      await this.assertCategoryOfferedInStudio(studioId, dto.serviceCategoryId);
    }

    const created = await this.prisma.nextbotAutoMessageTemplate.create({
      data: {
        id: generateId(IdPrefix.NextbotAutoMessageTemplate),
        studioId,
        serviceCategoryId: dto.serviceCategoryId?.trim() || null,
        triggerType: normalized.triggerType,
        anchor: normalized.anchor!,
        direction: normalized.direction!,
        offsetValue: normalized.offsetValue ?? 1,
        offsetUnit: normalized.offsetUnit ?? NextbotAutoMessageOffsetUnit.MINUTES,
        minLeadDays: dto.minLeadDays ?? null,
        triggerOnStatus: normalized.triggerOnStatus ?? null,
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

    const nextTrigger = dto.triggerType ?? existing.triggerType;
    let nextAnchor = dto.anchor ?? existing.anchor;
    let nextDirection = dto.direction ?? existing.direction;
    let nextOffsetValue = dto.offsetValue ?? existing.offsetValue;
    let nextOffsetUnit = dto.offsetUnit ?? existing.offsetUnit;
    const nextTriggerOnStatus =
      dto.triggerOnStatus !== undefined ? dto.triggerOnStatus : existing.triggerOnStatus;

    if (isStatusChangedTrigger(nextTrigger)) {
      nextAnchor = NextbotAutoMessageAnchor.NONE;
      nextDirection = NextbotAutoMessageDirection.AFTER;
      nextOffsetValue = dto.offsetValue ?? 1;
      nextOffsetUnit = dto.offsetUnit ?? NextbotAutoMessageOffsetUnit.MINUTES;
    } else {
      this.validateOffset(nextOffsetValue, nextOffsetUnit);
    }

    const nextCategoryId =
      dto.serviceCategoryId !== undefined
        ? dto.serviceCategoryId
        : existing.serviceCategoryId;

    if (dto.serviceCategoryId) {
      await this.assertCategoryOfferedInStudio(studioId, dto.serviceCategoryId);
    }

    this.validateTemplateScheduleOrThrow({
      triggerType: nextTrigger,
      anchor: nextAnchor,
      direction: nextDirection,
      serviceCategoryId: nextCategoryId,
      triggerOnStatus: nextTriggerOnStatus,
    });

    const data: Prisma.NextbotAutoMessageTemplateUpdateInput = {};
    if (dto.triggerType !== undefined) data.triggerType = dto.triggerType;
    if (dto.anchor !== undefined || isStatusChangedTrigger(nextTrigger)) {
      data.anchor = nextAnchor;
    }
    if (dto.direction !== undefined || isStatusChangedTrigger(nextTrigger)) {
      data.direction = nextDirection;
    }
    if (dto.offsetValue !== undefined || isStatusChangedTrigger(nextTrigger)) {
      data.offsetValue = nextOffsetValue;
    }
    if (dto.offsetUnit !== undefined || isStatusChangedTrigger(nextTrigger)) {
      data.offsetUnit = nextOffsetUnit;
    }
    if (dto.triggerOnStatus !== undefined || isStatusChangedTrigger(nextTrigger)) {
      data.triggerOnStatus = isStatusChangedTrigger(nextTrigger)
        ? nextTriggerOnStatus
        : null;
    }
    if (dto.serviceCategoryId !== undefined) {
      data.category = dto.serviceCategoryId
        ? { connect: { id: dto.serviceCategoryId } }
        : { disconnect: true };
    }
    if (dto.minLeadDays !== undefined) data.minLeadDays = dto.minLeadDays;
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
