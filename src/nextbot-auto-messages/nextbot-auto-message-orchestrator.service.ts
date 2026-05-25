import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AppointmentStatus,
  NextbotAutoMessageAnchor,
  NextbotAutoMessageDirection,
  NextbotAutoMessageLogStatus,
  NextbotAutoMessageTriggerType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateId, IdPrefix } from '../common/id-generator';
import { getDisabledCategoryIdsForStudio } from '../common/service-studio-offering';
import {
  computeScheduledAt,
  meetsMinLeadDays,
} from './nextbot-auto-message-schedule.util';
import {
  NextbotAutoMessageVariableKey,
  renderNextbotAutoMessageTemplate,
} from './nextbot-auto-message-variables';
import { NextbotOutboundService } from './nextbot-outbound.service';

import { isCustomScheduledAfterVisit } from './nextbot-auto-message-template-config';

const FOLLOWUP_TRIGGERS: NextbotAutoMessageTriggerType[] = [
  NextbotAutoMessageTriggerType.FOLLOWUP_AFTER_VISIT,
  NextbotAutoMessageTriggerType.FEEDBACK_REQUEST,
];

const appointmentInclude = {
  client: true,
  studio: { include: { organization: true } },
  staff: { include: { staffProfile: true } },
  service: { include: { category: true } },
  serviceItems: {
    include: { service: { include: { category: true } } },
    orderBy: { sortOrder: 'asc' as const },
  },
} satisfies Prisma.AppointmentInclude;

type AppointmentCtx = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

@Injectable()
export class NextbotAutoMessageOrchestratorService {
  private readonly logger = new Logger(NextbotAutoMessageOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: NextbotOutboundService,
  ) {}

  /** Пересчитать очередь сообщений для записи (статус, перенос, BOOKED, DONE, холд). */
  async syncAppointment(appointmentId: string, visitDoneAt?: Date): Promise<void> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: appointmentInclude,
    });
    if (!appointment) return;

    if (appointment.status === AppointmentStatus.CANCELLED) {
      await this.cancelPendingForAppointment(appointmentId, 'appointment_cancelled');
      return;
    }

    const templates = await this.prisma.nextbotAutoMessageTemplate.findMany({
      where: { studioId: appointment.studioId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const disabledCategories = await getDisabledCategoryIdsForStudio(
      this.prisma,
      appointment.studioId,
    );
    const categoryIds = this.getAppointmentCategoryIds(appointment);

    if (appointment.status === AppointmentStatus.BOOKED) {
      await this.cancelPendingByTrigger(
        appointmentId,
        [NextbotAutoMessageTriggerType.HOLD_EXPIRY_WARNING],
        'booking_confirmed',
      );
      for (const categoryId of categoryIds) {
        await this.cancelClientCategoryFollowups(
          appointment.clientId,
          categoryId,
          'new_booking_same_category',
        );
      }
    }

    const doneAt =
      appointment.status === AppointmentStatus.DONE
        ? visitDoneAt ?? appointment.updatedAt
        : null;

    for (const template of templates) {
      if (!template.isActive) continue;
      if (
        template.serviceCategoryId &&
        disabledCategories.has(template.serviceCategoryId)
      ) {
        continue;
      }

      const applies = this.templateApplies(template, appointment, categoryIds);
      if (!applies) {
        await this.cancelPendingForTemplate(appointmentId, template.id, 'template_not_applicable');
        continue;
      }

      const scheduledAt = this.resolveScheduledAt(template, appointment, doneAt);
      if (!scheduledAt) {
        await this.cancelPendingForTemplate(appointmentId, template.id, 'no_schedule_anchor');
        continue;
      }

      const usesMinLeadDays =
        template.triggerType === NextbotAutoMessageTriggerType.REMINDER_BEFORE_VISIT ||
        (template.triggerType === NextbotAutoMessageTriggerType.CUSTOM_SCHEDULED &&
          template.anchor === NextbotAutoMessageAnchor.APPOINTMENT_START &&
          template.direction === NextbotAutoMessageDirection.BEFORE);
      if (
        usesMinLeadDays &&
        !meetsMinLeadDays(appointment.bookedAt, appointment.startAt, template.minLeadDays)
      ) {
        await this.cancelPendingForTemplate(appointmentId, template.id, 'min_lead_days');
        continue;
      }

      if (
        template.triggerType !== NextbotAutoMessageTriggerType.BOOKING_CONFIRMED &&
        scheduledAt.getTime() <= Date.now() - 60_000
      ) {
        await this.cancelPendingForTemplate(appointmentId, template.id, 'scheduled_in_past');
        continue;
      }

      await this.upsertPendingLog(appointment, template.id, scheduledAt);
    }
  }

  /** Отправить все PENDING с scheduledAt <= now для организации (или все). */
  async dispatchDueMessages(limit = 50): Promise<number> {
    const now = new Date();
    const due = await this.prisma.nextbotAutoMessageLog.findMany({
      where: { status: NextbotAutoMessageLogStatus.PENDING, scheduledAt: { lte: now } },
      take: limit,
      orderBy: { scheduledAt: 'asc' },
      include: {
        template: true,
        appointment: { include: appointmentInclude },
        client: true,
      },
    });

    let sent = 0;
    for (const row of due) {
      const ok = await this.dispatchLog(row.id);
      if (ok) sent += 1;
    }
    return sent;
  }

  async dispatchLog(logId: string): Promise<boolean> {
    const row = await this.prisma.nextbotAutoMessageLog.findUnique({
      where: { id: logId },
      include: {
        template: true,
        appointment: { include: appointmentInclude },
        client: true,
      },
    });
    if (!row || row.status !== NextbotAutoMessageLogStatus.PENDING) return false;

    const appointment = row.appointment;
    if (appointment.status === AppointmentStatus.CANCELLED) {
      await this.markLog(row.id, NextbotAutoMessageLogStatus.CANCELLED, null, 'appointment_cancelled');
      return false;
    }

    if (row.client.isBlacklisted) {
      await this.markLog(row.id, NextbotAutoMessageLogStatus.SKIPPED, null, 'client_blacklisted');
      return false;
    }

    const dialogId = row.client.nextbotDialogId;
    if (!dialogId) {
      await this.markLog(row.id, NextbotAutoMessageLogStatus.SKIPPED, null, 'no_nextbot_dialog_id');
      return false;
    }

    if (!row.template.isActive) {
      await this.markLog(row.id, NextbotAutoMessageLogStatus.SKIPPED, null, 'template_inactive');
      return false;
    }

    if (
      row.template.triggerType === NextbotAutoMessageTriggerType.STATUS_CHANGED &&
      row.template.triggerOnStatus &&
      appointment.status !== row.template.triggerOnStatus
    ) {
      await this.markLog(row.id, NextbotAutoMessageLogStatus.SKIPPED, null, 'status_no_longer_matches');
      return false;
    }

    const text = renderNextbotAutoMessageTemplate(
      row.template.messageText,
      this.buildVariableMap(appointment),
    );

    const orgId = appointment.studio.organizationId;
    try {
      await this.outbound.send(orgId, {
        dialogId,
        text,
        appointmentId: appointment.id,
        clientId: row.clientId,
        templateId: row.templateId,
      });
      await this.markLog(row.id, NextbotAutoMessageLogStatus.SENT, text, null);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.markLog(row.id, NextbotAutoMessageLogStatus.FAILED, text, msg);
      return false;
    }
  }

  private templateApplies(
    template: {
      triggerType: NextbotAutoMessageTriggerType;
      serviceCategoryId: string | null;
      anchor: NextbotAutoMessageAnchor;
      direction: NextbotAutoMessageDirection;
      triggerOnStatus?: AppointmentStatus | null;
    },
    appointment: AppointmentCtx,
    categoryIds: Set<string>,
  ): boolean {
    if (
      template.serviceCategoryId &&
      !categoryIds.has(template.serviceCategoryId)
    ) {
      return false;
    }

    switch (template.triggerType) {
      case NextbotAutoMessageTriggerType.BOOKING_CONFIRMED:
        return appointment.status === AppointmentStatus.BOOKED;
      case NextbotAutoMessageTriggerType.REMINDER_BEFORE_VISIT:
        return (
          appointment.status === AppointmentStatus.BOOKED &&
          appointment.startAt.getTime() > Date.now()
        );
      case NextbotAutoMessageTriggerType.HOLD_EXPIRY_WARNING:
        return (
          appointment.status === AppointmentStatus.TENTATIVE &&
          appointment.holdExpiresAt != null
        );
      case NextbotAutoMessageTriggerType.FOLLOWUP_AFTER_VISIT:
      case NextbotAutoMessageTriggerType.FEEDBACK_REQUEST:
        return appointment.status === AppointmentStatus.DONE;
      case NextbotAutoMessageTriggerType.CUSTOM_SCHEDULED:
        if (
          template.anchor === NextbotAutoMessageAnchor.APPOINTMENT_START &&
          template.direction === NextbotAutoMessageDirection.BEFORE
        ) {
          return (
            appointment.status === AppointmentStatus.BOOKED &&
            appointment.startAt.getTime() > Date.now()
          );
        }
        if (
          template.anchor === NextbotAutoMessageAnchor.VISIT_DONE_AT &&
          template.direction === NextbotAutoMessageDirection.AFTER
        ) {
          return appointment.status === AppointmentStatus.DONE;
        }
        return false;
      case NextbotAutoMessageTriggerType.STATUS_CHANGED:
        return false;
      default:
        return false;
    }
  }

  /**
   * Отправка шаблонов STATUS_CHANGED при переходе записи в новый статус.
   * Вызывается из appointments.update (не из syncAppointment).
   */
  async handleAppointmentStatusChanged(
    appointmentId: string,
    previousStatus: AppointmentStatus | null,
    newStatus: AppointmentStatus,
  ): Promise<void> {
    if (previousStatus === newStatus) {
      return;
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: appointmentInclude,
    });
    if (!appointment || appointment.status === AppointmentStatus.CANCELLED) {
      return;
    }

    const templates = await this.prisma.nextbotAutoMessageTemplate.findMany({
      where: {
        studioId: appointment.studioId,
        triggerType: NextbotAutoMessageTriggerType.STATUS_CHANGED,
        triggerOnStatus: newStatus,
        isActive: true,
      },
    });
    if (templates.length === 0) {
      return;
    }

    const disabledCategories = await getDisabledCategoryIdsForStudio(
      this.prisma,
      appointment.studioId,
    );
    const categoryIds = this.getAppointmentCategoryIds(appointment);
    const now = new Date();

    for (const template of templates) {
      if (
        template.serviceCategoryId &&
        (disabledCategories.has(template.serviceCategoryId) ||
          !categoryIds.has(template.serviceCategoryId))
      ) {
        continue;
      }
      await this.upsertPendingLog(appointment, template.id, now);
    }
  }

  private resolveScheduledAt(
    template: {
      triggerType: NextbotAutoMessageTriggerType;
      anchor: NextbotAutoMessageAnchor;
      direction: NextbotAutoMessageDirection;
      offsetValue: number;
      offsetUnit: import('@prisma/client').NextbotAutoMessageOffsetUnit;
    },
    appointment: AppointmentCtx,
    visitDoneAt: Date | null,
  ): Date | null {
    if (
      template.triggerType === NextbotAutoMessageTriggerType.BOOKING_CONFIRMED ||
      template.triggerType === NextbotAutoMessageTriggerType.STATUS_CHANGED
    ) {
      return new Date();
    }
    return computeScheduledAt({
      anchor: template.anchor,
      direction: template.direction,
      offsetValue: template.offsetValue,
      offsetUnit: template.offsetUnit,
      startAt: appointment.startAt,
      holdExpiresAt: appointment.holdExpiresAt,
      visitDoneAt,
    });
  }

  private getAppointmentCategoryIds(appointment: AppointmentCtx): Set<string> {
    const ids = new Set<string>();
    if (appointment.service?.categoryId) ids.add(appointment.service.categoryId);
    for (const item of appointment.serviceItems) {
      if (item.service?.categoryId) ids.add(item.service.categoryId);
    }
    return ids;
  }

  /** Переменные для подстановки в текст (тестовая и боевая отправка). */
  async getVariablesForAppointment(
    appointmentId: string,
    studioId: string,
  ): Promise<Partial<Record<NextbotAutoMessageVariableKey, string>>> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, studioId },
      include: appointmentInclude,
    });
    if (!appointment) {
      throw new NotFoundException('Запись не найдена в этом филиале');
    }
    return this.buildVariableMap(appointment);
  }

  private buildVariableMap(
    appointment: AppointmentCtx,
  ): Partial<Record<NextbotAutoMessageVariableKey, string>> {
    const services = this.formatServices(appointment);
    const category =
      appointment.serviceItems[0]?.service?.category?.name ??
      appointment.service?.category?.name ??
      '';
    const staff = appointment.staff;
    const masterName = staff?.staffProfile?.firstName ?? staff?.email ?? '';
    const studioTz = appointment.studio.timezone || 'Asia/Almaty';
    const startLocal = appointment.startAt.toLocaleString('ru-RU', {
      timeZone: studioTz,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const [datePart, timePart] = startLocal.split(', ');

    return {
      name: appointment.client.firstName ?? '',
      patronymic: appointment.client.patronymic ?? '',
      lastName: appointment.client.lastName ?? '',
      phone: appointment.client.phone ?? '',
      service: services.split(',')[0]?.trim() ?? '',
      services,
      category,
      studio: appointment.studio.name,
      appointmentDate: datePart ?? '',
      appointmentTime: timePart ?? '',
      master: masterName,
      comment: appointment.comment ?? '',
      prepayment:
        appointment.prepaymentAmount != null
          ? String(appointment.prepaymentAmount)
          : '',
    };
  }

  private formatServices(appointment: AppointmentCtx): string {
    if (appointment.serviceItems.length > 0) {
      return appointment.serviceItems.map((i) => i.service.name).join(', ');
    }
    return appointment.service?.name ?? '';
  }

  private async upsertPendingLog(
    appointment: AppointmentCtx,
    templateId: string,
    scheduledAt: Date,
  ): Promise<void> {
    const existing = await this.prisma.nextbotAutoMessageLog.findUnique({
      where: {
        appointmentId_templateId: { appointmentId: appointment.id, templateId },
      },
    });
    if (existing?.status === NextbotAutoMessageLogStatus.SENT) {
      return;
    }
    if (existing?.status === NextbotAutoMessageLogStatus.PENDING) {
      await this.prisma.nextbotAutoMessageLog.update({
        where: { id: existing.id },
        data: { scheduledAt },
      });
      return;
    }
    if (
      existing &&
      (existing.status === NextbotAutoMessageLogStatus.CANCELLED ||
        existing.status === NextbotAutoMessageLogStatus.SKIPPED ||
        existing.status === NextbotAutoMessageLogStatus.FAILED)
    ) {
      return;
    }
    await this.prisma.nextbotAutoMessageLog.create({
      data: {
        id: generateId(IdPrefix.NextbotAutoMessageLog),
        templateId,
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        scheduledAt,
        status: NextbotAutoMessageLogStatus.PENDING,
      },
    });
  }

  private async cancelPendingForAppointment(appointmentId: string, reason: string) {
    await this.prisma.nextbotAutoMessageLog.updateMany({
      where: {
        appointmentId,
        status: NextbotAutoMessageLogStatus.PENDING,
      },
      data: { status: NextbotAutoMessageLogStatus.CANCELLED, skipReason: reason },
    });
  }

  private async cancelPendingForTemplate(
    appointmentId: string,
    templateId: string,
    reason: string,
  ) {
    await this.prisma.nextbotAutoMessageLog.updateMany({
      where: {
        appointmentId,
        templateId,
        status: NextbotAutoMessageLogStatus.PENDING,
      },
      data: { status: NextbotAutoMessageLogStatus.CANCELLED, skipReason: reason },
    });
  }

  private async cancelPendingByTrigger(
    appointmentId: string,
    triggers: NextbotAutoMessageTriggerType[],
    reason: string,
  ) {
    await this.prisma.nextbotAutoMessageLog.updateMany({
      where: {
        appointmentId,
        status: NextbotAutoMessageLogStatus.PENDING,
        template: { triggerType: { in: triggers } },
      },
      data: { status: NextbotAutoMessageLogStatus.CANCELLED, skipReason: reason },
    });
  }

  private async cancelClientCategoryFollowups(
    clientId: string,
    categoryId: string,
    reason: string,
  ) {
    const pending = await this.prisma.nextbotAutoMessageLog.findMany({
      where: {
        clientId,
        status: NextbotAutoMessageLogStatus.PENDING,
        template: { serviceCategoryId: categoryId },
      },
      include: { template: true },
    });
    const toCancel = pending.filter(
      (row) =>
        FOLLOWUP_TRIGGERS.includes(row.template.triggerType) ||
        isCustomScheduledAfterVisit(row.template),
    );
    if (toCancel.length === 0) return;
    await this.prisma.nextbotAutoMessageLog.updateMany({
      where: { id: { in: toCancel.map((r) => r.id) } },
      data: { status: NextbotAutoMessageLogStatus.CANCELLED, skipReason: reason },
    });
  }

  private async markLog(
    id: string,
    status: NextbotAutoMessageLogStatus,
    renderedText: string | null,
    skipOrError: string | null,
  ) {
    await this.prisma.nextbotAutoMessageLog.update({
      where: { id },
      data: {
        status,
        sentAt: status === NextbotAutoMessageLogStatus.SENT ? new Date() : undefined,
        renderedText: renderedText ?? undefined,
        skipReason:
          status === NextbotAutoMessageLogStatus.SKIPPED ? skipOrError ?? undefined : undefined,
        error:
          status === NextbotAutoMessageLogStatus.FAILED ? skipOrError ?? undefined : undefined,
      },
    });
  }
}
