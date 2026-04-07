import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { getOrganizationIdForStudio } from '../common/organization-scope';
import { generateId, IdPrefix } from '../common/id-generator';
import { NotificationType } from '@prisma/client';
import { UserRole } from '../common/decorators/roles.decorator';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async createNewAppointmentNotification(
    studioId: string,
    staffUserId: string,
    appointmentId: string,
    clientName: string,
    serviceName: string,
    startAt: Date,
  ) {
    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);
    const startAtFormatted = new Date(startAt).toLocaleString('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    return this.prisma.notification.create({
      data: {
        id: generateId(IdPrefix.Notification),
        userId: staffUserId,
        organizationId,
        studioId,
        type: NotificationType.NEW_APPOINTMENT,
        title: 'Новая запись',
        message: `У вас новая запись: ${clientName} - ${serviceName} на ${startAtFormatted}`,
        data: JSON.stringify({
          appointmentId,
          clientName,
          serviceName,
          startAt: startAt.toISOString(),
        }),
      },
    });
  }

  async createCancellationNotification(
    studioId: string,
    appointmentId: string,
    clientName: string,
    serviceName: string,
    staffName: string,
    startAt: Date,
  ) {
    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);
    const managers = await this.prisma.user.findMany({
      where: {
        studioId,
        role: 'MANAGER',
        isActive: true,
      },
    });

    const startAtFormatted = new Date(startAt).toLocaleString('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    const notifications = await Promise.all(
      managers.map((manager) =>
        this.prisma.notification.create({
          data: {
            id: generateId(IdPrefix.Notification),
            userId: manager.id,
            organizationId,
            studioId,
            type: NotificationType.APPOINTMENT_CANCELLED,
            title: 'Отмена записи',
            message: `Запись отменена: ${clientName} - ${serviceName} у ${staffName} на ${startAtFormatted}`,
            data: JSON.stringify({
              appointmentId,
              clientName,
              serviceName,
              staffName,
              startAt: startAt.toISOString(),
            }),
          },
        }),
      ),
    );

    return notifications;
  }

  async findAll(userId: string, isRead?: boolean) {
    const where: Record<string, unknown> = { userId };
    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });
  }

  async findUnread(userId: string) {
    return this.findAll(userId, false);
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new Error('Notification not found or access denied');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  async remove(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new Error('Notification not found or access denied');
    }

    return this.prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  async createBlacklistRequestNotification(
    studioId: string,
    blacklistRequestId: string,
    clientName: string,
    requestedByName: string,
    reason?: string,
  ) {
    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);
    const owners = await this.prisma.user.findMany({
      where: {
        organizationId,
        role: {
          in: [UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.DEVELOPER],
        },
        isActive: true,
      },
    });

    const reasonText = reason ? ` Причина: ${reason}` : '';

    const notifications = await Promise.all(
      owners.map((owner) =>
        this.prisma.notification.create({
          data: {
            id: generateId(IdPrefix.Notification),
            userId: owner.id,
            organizationId,
            studioId,
            type: NotificationType.BLACKLIST_REQUEST,
            title: 'Запрос на добавление в черный список',
            message: `${requestedByName} запросил(а) добавление клиента "${clientName}" в черный список.${reasonText}`,
            data: JSON.stringify({
              blacklistRequestId,
              clientName,
              requestedByName,
              reason,
            }),
          },
        }),
      ),
    );

    return notifications;
  }

  async createNewTaskNotification(
    studioId: string,
    taskId: string,
    assigneeUserId: string,
    title: string,
    deadlineAt: Date,
  ) {
    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);
    const deadlineFormatted = new Date(deadlineAt).toLocaleString('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    return this.prisma.notification.create({
      data: {
        id: generateId(IdPrefix.Notification),
        userId: assigneeUserId,
        organizationId,
        studioId,
        type: NotificationType.NEW_TASK,
        title: 'Новая задача',
        message: `Вам назначена задача: «${title}». Срок: ${deadlineFormatted}`,
        data: JSON.stringify({ taskId, title, deadlineAt: deadlineAt.toISOString() }),
      },
    });
  }

  async createTaskDeadlineApproachingNotification(
    organizationId: string,
    userId: string,
    taskId: string,
    title: string,
    deadlineAt: Date,
  ) {
    const deadlineFormatted = new Date(deadlineAt).toLocaleString('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    return this.prisma.notification.create({
      data: {
        id: generateId(IdPrefix.Notification),
        userId,
        organizationId,
        studioId: null,
        type: NotificationType.TASK_DEADLINE_APPROACHING,
        title: 'Срок задачи',
        message: `Скоро дедлайн по задаче «${title}» (${deadlineFormatted})`,
        data: JSON.stringify({ taskId, title, deadlineAt: deadlineAt.toISOString() }),
      },
    });
  }

  async createTaskRejectedNotification(
    studioId: string,
    taskId: string,
    creatorUserId: string,
    title: string,
    rejectionComment: string,
  ) {
    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);
    return this.prisma.notification.create({
      data: {
        id: generateId(IdPrefix.Notification),
        userId: creatorUserId,
        organizationId,
        studioId,
        type: NotificationType.TASK_REJECTED,
        title: 'Отказ от задачи',
        message: `Мастер отказался от задачи «${title}». Причина: ${rejectionComment}`,
        data: JSON.stringify({ taskId, title, rejectionComment }),
      },
    });
  }
}
