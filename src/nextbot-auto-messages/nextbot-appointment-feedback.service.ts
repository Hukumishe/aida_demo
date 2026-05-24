import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, TaskStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateId, IdPrefix } from '../common/id-generator';
import { renderNextbotAutoMessageTemplate } from './nextbot-auto-message-variables';
import { NextbotOutboundService } from './nextbot-outbound.service';

@Injectable()
export class NextbotAppointmentFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: NextbotOutboundService,
  ) {}

  async submitRating(params: {
    appointmentId: string;
    rating: number;
    organizationId: string;
    positiveFollowUpText?: string;
  }) {
    const rating = Math.trunc(params.rating);
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('rating must be 1..5');
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: params.appointmentId },
      include: {
        client: true,
        studio: { include: { organization: true } },
        service: true,
        serviceItems: { include: { service: true } },
      },
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    if (appointment.studio.organizationId !== params.organizationId) {
      throw new BadRequestException('Appointment not in organization');
    }
    if (appointment.status !== AppointmentStatus.DONE) {
      throw new BadRequestException('Feedback only for DONE appointments');
    }
    if (appointment.client.isBlacklisted) {
      throw new BadRequestException('Client is blacklisted');
    }

    const existing = await this.prisma.appointmentFeedback.findUnique({
      where: { appointmentId: appointment.id },
    });
    if (existing) {
      return {
        alreadySubmitted: true,
        rating: existing.rating,
        appointmentId: appointment.id,
      };
    }

    await this.prisma.appointmentFeedback.create({
      data: {
        id: generateId(IdPrefix.AppointmentFeedback),
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        rating,
      },
    });

    const dialogId = appointment.client.nextbotDialogId;
    let outboundSent = false;

    if (rating >= 4) {
      const twoGis = appointment.studio.feedbackTwoGisUrl?.trim();
      const templateText =
        params.positiveFollowUpText?.trim() ||
        (twoGis
          ? `Спасибо за высокую оценку! Будем благодарны за отзыв: ${twoGis}`
          : 'Спасибо за высокую оценку!');
      if (dialogId) {
        await this.outbound.trySend(appointment.studio.organizationId, {
          dialogId,
          text: renderNextbotAutoMessageTemplate(templateText, {
            name: appointment.client.firstName,
          }),
          appointmentId: appointment.id,
          clientId: appointment.clientId,
        });
        outboundSent = true;
      }
    } else {
      await this.createLowRatingTask(appointment);
    }

    return {
      alreadySubmitted: false,
      rating,
      appointmentId: appointment.id,
      outboundSent,
      managerTaskCreated: rating <= 3,
    };
  }

  private async createLowRatingTask(appointment: {
    id: string;
    clientId: string;
    studio: { organizationId: string; id: string };
    client: { firstName: string; lastName: string | null };
    service: { name: string };
  }) {
    const org = await this.prisma.organization.findUnique({
      where: { id: appointment.studio.organizationId },
      select: { feedbackLowRatingTaskTitle: true },
    });
    const managers = await this.prisma.user.findMany({
      where: {
        organizationId: appointment.studio.organizationId,
        role: UserRole.MANAGER,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 1,
    });
    if (!managers.length) return;

    const assignee = managers[0]!;
    const clientName = [appointment.client.firstName, appointment.client.lastName]
      .filter(Boolean)
      .join(' ');
    const title =
      org?.feedbackLowRatingTaskTitle?.trim() || 'Отработка негативной оценки';
    const deadlineAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.studioTask.create({
      data: {
        id: generateId(IdPrefix.StudioTask),
        organizationId: appointment.studio.organizationId,
        title,
        description: `Низкая оценка визита. Клиент: ${clientName}. Услуга: ${appointment.service.name}. Запись: ${appointment.id}`,
        assigneeUserId: assignee.id,
        createdByUserId: assignee.id,
        deadlineAt,
        status: TaskStatus.OPEN,
        appointmentId: appointment.id,
        clientId: appointment.clientId,
      },
    });
  }
}
