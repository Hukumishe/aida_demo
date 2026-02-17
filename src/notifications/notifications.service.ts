import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Создать уведомление для мастера о новой записи
   */
  async createNewAppointmentNotification(
    studioId: string,
    staffUserId: string,
    appointmentId: string,
    clientName: string,
    serviceName: string,
    startAt: Date,
  ) {
    const startAtFormatted = new Date(startAt).toLocaleString('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    return this.prisma.notification.create({
      data: {
        userId: staffUserId,
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

  /**
   * Создать уведомление для менеджеров об отмене записи
   */
  async createCancellationNotification(
    studioId: string,
    appointmentId: string,
    clientName: string,
    serviceName: string,
    staffName: string,
    startAt: Date,
  ) {
    // Найти всех менеджеров в студии
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

    // Создать уведомления для всех менеджеров
    const notifications = await Promise.all(
      managers.map((manager) =>
        this.prisma.notification.create({
          data: {
            userId: manager.id,
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

  /**
   * Получить все уведомления пользователя
   */
  async findAll(userId: string, isRead?: boolean) {
    const where: any = { userId };
    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Ограничение на количество уведомлений
    });
  }

  /**
   * Получить непрочитанные уведомления пользователя
   */
  async findUnread(userId: string) {
    return this.findAll(userId, false);
  }

  /**
   * Отметить уведомление как прочитанное
   */
  async markAsRead(notificationId: string, userId: string) {
    // Проверяем, что уведомление принадлежит пользователю
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

  /**
   * Отметить все уведомления пользователя как прочитанные
   */
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

  /**
   * Получить количество непрочитанных уведомлений
   */
  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  /**
   * Удалить уведомление
   */
  async remove(notificationId: string, userId: string) {
    // Проверяем, что уведомление принадлежит пользователю
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
}

