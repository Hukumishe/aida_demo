import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Appointment,
  AppointmentCreatedSource,
  AppointmentHistoryAction,
  AppointmentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateId, IdPrefix } from '../common/id-generator';
import { UserRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';
import { assertUserOrganizationMatchesStudio } from '../common/organization-scope';
import { resolveHistoryActorUserId } from './appointment-author.util';
import { APPOINTMENT_HISTORY_ACTION_LABELS } from './appointment-history.constants';
import {
  formatCreatedSource,
  formatDateTime,
  formatMoneyTenge,
  formatStatus,
  formatUserDisplayName,
  HistoryChangeRow,
} from './appointment-history.util';
type Tx = Prisma.TransactionClient;

export type RecordHistoryInput = {
  appointmentId: string;
  studioId: string;
  action: AppointmentHistoryAction;
  summary: string;
  payload?: Prisma.InputJsonValue;
  actorUserId?: string | null;
  actorLabel?: string | null;
  tx?: Tx;
};

@Injectable()
export class AppointmentHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Tx) {
    return tx ?? this.prisma;
  }

  async record(input: RecordHistoryInput): Promise<void> {
    const client = this.db(input.tx);
    await client.appointmentHistoryEntry.create({
      data: {
        id: generateId(IdPrefix.AppointmentHistory),
        appointmentId: input.appointmentId,
        studioId: input.studioId,
        action: input.action,
        summary: input.summary,
        payload: input.payload ?? undefined,
        actorUserId: resolveHistoryActorUserId(input.actorUserId),
        actorLabel: input.actorLabel ?? null,
      },
    });
  }

  async recordCreated(
    appointment: Appointment & {
      client?: { firstName: string; lastName: string | null };
      service?: { name: string };
    },
    actorUserId?: string | null,
    actorLabel?: string | null,
    tx?: Tx,
  ) {
    const clientName = appointment.client
      ? `${appointment.client.firstName} ${appointment.client.lastName ?? ''}`.trim()
      : 'Клиент';
    const serviceName = appointment.service?.name ?? 'Услуга';
    await this.record({
      appointmentId: appointment.id,
      studioId: appointment.studioId,
      action: AppointmentHistoryAction.CREATED,
      summary: `Создана запись: ${clientName}, ${serviceName}, ${formatDateTime(appointment.startAt)}, статус «${formatStatus(appointment.status)}»`,
      payload: {
        appointmentId: appointment.id,
        status: appointment.status,
        startAt: appointment.startAt.toISOString(),
        endAt: appointment.endAt.toISOString(),
        createdSource: appointment.createdSource,
        prepaymentAmount: appointment.prepaymentAmount,
      },
      actorUserId: resolveHistoryActorUserId(actorUserId, appointment.createdByUserId),
      actorLabel:
        actorLabel ??
        (appointment.createdSource !== AppointmentCreatedSource.CRM
          ? formatCreatedSource(appointment.createdSource)
          : null),
      tx,
    });
  }

  async recordFromUpdate(
    before: Appointment,
    after: Appointment,
    dto: {
      startAt?: string;
      endAt?: string;
      staffUserId?: string;
      prepaymentAmount?: number;
      comment?: string | null;
      status?: AppointmentStatus;
    },
    actorUserId?: string | null,
    previousStatus?: AppointmentStatus,
  ) {
    const changes: HistoryChangeRow[] = [];

    const timeChanged =
      after.startAt.getTime() !== before.startAt.getTime() ||
      after.endAt.getTime() !== before.endAt.getTime();
    const staffChanged = after.staffUserId !== before.staffUserId;

    if (timeChanged || staffChanged) {
      if (timeChanged) {
        changes.push({
          field: 'Время',
          from: formatDateTime(before.startAt),
          to: formatDateTime(after.startAt),
        });
      }
      if (staffChanged) {
        changes.push({
          field: 'Мастер',
          from: before.staffUserId,
          to: after.staffUserId,
        });
      }
      const parts: string[] = [];
      if (timeChanged) {
        parts.push(
          `${formatDateTime(before.startAt)} → ${formatDateTime(after.startAt)}`,
        );
      }
      if (staffChanged) {
        parts.push(`мастер ${before.staffUserId} → ${after.staffUserId}`);
      }
      await this.record({
        appointmentId: after.id,
        studioId: after.studioId,
        action: AppointmentHistoryAction.RESCHEDULED,
        summary: `Перенос: ${parts.join('; ')}`,
        payload: {
          appointmentId: after.id,
          changes,
          fromStaffUserId: before.staffUserId,
          toStaffUserId: after.staffUserId,
          fromStartAt: before.startAt.toISOString(),
          toStartAt: after.startAt.toISOString(),
        },
        actorUserId,
      });
    }

    if (
      dto.prepaymentAmount !== undefined &&
      dto.prepaymentAmount !== before.prepaymentAmount
    ) {
      changes.push({
        field: 'Предоплата',
        from: formatMoneyTenge(before.prepaymentAmount),
        to: formatMoneyTenge(dto.prepaymentAmount),
      });
      await this.record({
        appointmentId: after.id,
        studioId: after.studioId,
        action: AppointmentHistoryAction.PREPAYMENT_CHANGED,
        summary: `Предоплата: ${formatMoneyTenge(before.prepaymentAmount)} → ${formatMoneyTenge(dto.prepaymentAmount)}`,
        payload: { appointmentId: after.id, changes },
        actorUserId,
      });
    }

    if (dto.comment !== undefined && dto.comment !== before.comment) {
      changes.push({
        field: 'Комментарий',
        from: before.comment ?? '—',
        to: dto.comment ?? '—',
      });
      await this.record({
        appointmentId: after.id,
        studioId: after.studioId,
        action: AppointmentHistoryAction.COMMENT_CHANGED,
        summary: 'Изменён комментарий к записи',
        payload: { appointmentId: after.id, changes },
        actorUserId,
      });
    }

    if (dto.status !== undefined && dto.status !== (previousStatus ?? before.status)) {
      const fromStatus = previousStatus ?? before.status;
      await this.record({
        appointmentId: after.id,
        studioId: after.studioId,
        action: AppointmentHistoryAction.STATUS_CHANGED,
        summary: `Статус: «${formatStatus(fromStatus)}» → «${formatStatus(dto.status)}»`,
        payload: {
          appointmentId: after.id,
          from: fromStatus,
          to: dto.status,
        },
        actorUserId,
      });
      if (dto.status === AppointmentStatus.CANCELLED) {
        await this.record({
          appointmentId: after.id,
          studioId: after.studioId,
          action: AppointmentHistoryAction.CANCELLED,
          summary: 'Запись отменена',
          payload: { appointmentId: after.id },
          actorUserId,
        });
      }
    }
  }

  async listForAppointment(
    appointmentId: string,
    userRole?: string,
    userStudioId?: string,
    userStaffId?: string,
    userOrganizationId?: string,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new NotFoundException('Запись не найдена');
    }

    await assertUserOrganizationMatchesStudio(
      this.prisma,
      appointment.studioId,
      userOrganizationId,
      userRole,
    );

    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userStudioId !== appointment.studioId) {
        throw new ForbiddenException('Нет доступа к этой записи');
      }
    }
    if (userRole === UserRole.MASTER && userStaffId && appointment.staffUserId !== userStaffId) {
      throw new ForbiddenException('Нет доступа к этой записи');
    }

    const rows = await this.prisma.appointmentHistoryEntry.findMany({
      where: {
        OR: [
          { appointmentId },
          {
            payload: {
              path: ['appointmentId'],
              equals: appointmentId,
            },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        actor: {
          select: {
            id: true,
            role: true,
            email: true,
            staffProfile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    return {
      appointmentId,
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        actionLabel: APPOINTMENT_HISTORY_ACTION_LABELS[row.action],
        summary: row.summary,
        payload: row.payload,
        actor: row.actor
          ? {
              id: row.actor.id,
              role: row.actor.role,
              displayName: formatUserDisplayName(row.actor),
            }
          : null,
        actorLabel: row.actorLabel,
        createdAt: row.createdAt,
      })),
    };
  }
}
