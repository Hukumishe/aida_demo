import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AppointmentHistoryAction } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { assertServiceBookableAtStudio } from '../common/service-studio-offering';
import { generateId, IdPrefix } from '../common/id-generator';
import { CreateUpsellDto } from './dto/create-upsell.dto';
import { UpdateUpsellDto } from './dto/update-upsell.dto';
import { UserRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';
import { AppointmentHistoryService } from './appointment-history.service';
import { formatMoneyTenge } from './appointment-history.util';

@Injectable()
export class UpsellsService {
  constructor(
    private prisma: PrismaService,
    private appointmentHistory: AppointmentHistoryService,
  ) {}

  async create(
    appointmentId: string,
    createUpsellDto: CreateUpsellDto,
    userRole?: string,
    userStudioId?: string,
    actorUserId?: string,
  ) {
    // Проверяем существование записи и доступ
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        service: true,
        studio: { select: { organizationId: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${appointmentId} not found`);
    }

    // Check access
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userStudioId !== appointment.studioId) {
        throw new ForbiddenException('Access denied to this appointment');
      }
    }

    await assertServiceBookableAtStudio(
      this.prisma,
      appointment.studioId,
      createUpsellDto.serviceId,
      appointment.studio.organizationId,
    );

    const quantity = createUpsellDto.quantity || 1;
    const totalAmount = quantity * createUpsellDto.price;

    const created = await this.prisma.appointmentUpsell.create({
      data: {
        id: generateId(IdPrefix.AppointmentUpsell),
        appointmentId,
        serviceId: createUpsellDto.serviceId,
        quantity,
        price: createUpsellDto.price,
        totalAmount,
        comment: createUpsellDto.comment,
      },
      include: {
        service: true,
      },
    });

    await this.appointmentHistory.record({
      appointmentId,
      studioId: appointment.studioId,
      action: AppointmentHistoryAction.UPSELL_ADDED,
      summary: `Допродажа: ${created.service.name}, ${quantity} × ${formatMoneyTenge(createUpsellDto.price)}`,
      payload: {
        appointmentId,
        upsellId: created.id,
        serviceName: created.service.name,
        quantity,
        price: createUpsellDto.price,
        totalAmount,
      },
      actorUserId,
    });

    return created;
  }

  async findAll(
    appointmentId: string,
    userRole?: string,
    userStudioId?: string,
  ) {
    // Проверяем существование записи и доступ
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${appointmentId} not found`);
    }

    // Check access
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userStudioId !== appointment.studioId) {
        throw new ForbiddenException('Access denied to this appointment');
      }
    }

    return this.prisma.appointmentUpsell.findMany({
      where: { appointmentId },
      include: {
        service: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async update(
    id: string,
    updateUpsellDto: UpdateUpsellDto,
    userRole?: string,
    userStudioId?: string,
    actorUserId?: string,
  ) {
    const upsell = await this.prisma.appointmentUpsell.findUnique({
      where: { id },
      include: {
        appointment: true,
        service: true,
      },
    });

    if (!upsell) {
      throw new NotFoundException(`Upsell with ID ${id} not found`);
    }

    // Check access
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userStudioId !== upsell.appointment.studioId) {
        throw new ForbiddenException('Access denied to this upsell');
      }
    }

    const quantity = updateUpsellDto.quantity ?? upsell.quantity;
    const price = updateUpsellDto.price ?? upsell.price;
    const totalAmount = quantity * price;

    const updated = await this.prisma.appointmentUpsell.update({
      where: { id },
      data: {
        quantity,
        price,
        totalAmount,
        comment: updateUpsellDto.comment,
      },
      include: {
        service: true,
      },
    });

    await this.appointmentHistory.record({
      appointmentId: upsell.appointmentId,
      studioId: upsell.appointment.studioId,
      action: AppointmentHistoryAction.UPSELL_UPDATED,
      summary: `Допродажа изменена: ${updated.service.name}, ${quantity} × ${formatMoneyTenge(price)}`,
      payload: {
        appointmentId: upsell.appointmentId,
        upsellId: id,
        serviceName: updated.service.name,
        quantity,
        price,
        totalAmount,
      },
      actorUserId,
    });

    return updated;
  }

  async remove(
    id: string,
    userRole?: string,
    userStudioId?: string,
    actorUserId?: string,
  ) {
    const upsell = await this.prisma.appointmentUpsell.findUnique({
      where: { id },
      include: {
        appointment: true,
        service: true,
      },
    });

    if (!upsell) {
      throw new NotFoundException(`Upsell with ID ${id} not found`);
    }

    // Check access
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userStudioId !== upsell.appointment.studioId) {
        throw new ForbiddenException('Access denied to this upsell');
      }
    }

    await this.appointmentHistory.record({
      appointmentId: upsell.appointmentId,
      studioId: upsell.appointment.studioId,
      action: AppointmentHistoryAction.UPSELL_REMOVED,
      summary: `Допродажа удалена: ${upsell.service.name}`,
      payload: {
        appointmentId: upsell.appointmentId,
        upsellId: id,
        serviceName: upsell.service.name,
      },
      actorUserId,
    });

    await this.prisma.appointmentUpsell.delete({
      where: { id },
    });

    return { success: true, message: 'Upsell deleted' };
  }
}
