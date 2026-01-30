import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { UserRole } from '../common/decorators/roles.decorator';
import { AvailabilityService } from '../availability/availability.service';
import { AppointmentStatus } from '@prisma/client';

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private availabilityService: AvailabilityService,
  ) {}

  private calculateEndAt(startAt: Date, durationMinutes: number): Date {
    const endAt = new Date(startAt);
    endAt.setMinutes(endAt.getMinutes() + durationMinutes);
    return endAt;
  }

  async findAll(
    studioId: string,
    date?: string,
    userRole?: string,
    userStudioId?: string,
    userStaffId?: string,
  ) {
    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
    }

    const where: any = { studioId };

    // MASTER can only see their own appointments
    if (userRole === UserRole.MASTER && userStaffId) {
      where.staffUserId = userStaffId;
    }

    if (date) {
      const dateObj = new Date(date);
      const nextDay = new Date(dateObj);
      nextDay.setDate(nextDay.getDate() + 1);

      where.startAt = {
        gte: dateObj,
        lt: nextDay,
      };
    }

    return this.prisma.appointment.findMany({
      where,
      include: {
        staff: {
          include: {
            staffProfile: true,
          },
        },
        client: true,
        service: true,
        arrivedByUser: {
          select: {
            id: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        startAt: 'asc',
      },
    });
  }

  async create(
    studioId: string,
    createAppointmentDto: CreateAppointmentDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
    }

    // Verify studio exists
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
    });
    if (!studio) {
      throw new NotFoundException(`Studio with ID ${studioId} not found`);
    }

    // Verify staff user exists and belongs to studio
    const staff = await this.prisma.user.findUnique({
      where: { id: createAppointmentDto.staffUserId },
    });

    if (!staff || staff.studioId !== studioId) {
      throw new NotFoundException('Staff member not found or does not belong to this studio');
    }

    // Verify client exists and belongs to studio
    const client = await this.prisma.client.findUnique({
      where: { id: createAppointmentDto.clientId },
    });

    if (!client || client.studioId !== studioId) {
      throw new NotFoundException('Client not found or does not belong to this studio');
    }

    // Verify service exists and belongs to studio
    const service = await this.prisma.service.findUnique({
      where: { id: createAppointmentDto.serviceId },
    });

    if (!service || service.studioId !== studioId || !service.isActive) {
      throw new NotFoundException('Service not found, does not belong to this studio, or is inactive');
    }

    // Get duration (override if exists, otherwise default)
    const staffOverride = await this.prisma.staffServiceOverride.findUnique({
      where: {
        studioId_staffUserId_serviceId: {
          studioId,
          staffUserId: createAppointmentDto.staffUserId,
          serviceId: createAppointmentDto.serviceId,
        },
      },
    });

    const durationMinutes =
      staffOverride?.durationMin && staffOverride.isActive
        ? staffOverride.durationMin
        : service.defaultDurationMin;

    const startAt = new Date(createAppointmentDto.startAt);
    const endAt = this.calculateEndAt(startAt, durationMinutes);

    // Check availability
    await this.availabilityService.checkAppointmentAvailability(
      studioId,
      createAppointmentDto.staffUserId,
      startAt,
      endAt,
    );

    // Create appointment in transaction
    return this.prisma.$transaction(async (tx) => {
      // Double-check availability within transaction
      await this.availabilityService.checkAppointmentAvailability(
        studioId,
        createAppointmentDto.staffUserId,
        startAt,
        endAt,
      );

      return tx.appointment.create({
        data: {
          studioId,
          staffUserId: createAppointmentDto.staffUserId,
          clientId: createAppointmentDto.clientId,
          serviceId: createAppointmentDto.serviceId,
          startAt,
          endAt,
          prepaymentAmount: createAppointmentDto.prepaymentAmount,
          status: AppointmentStatus.BOOKED,
        },
        include: {
          staff: {
            include: {
              staffProfile: true,
            },
          },
          client: true,
          service: true,
        },
      });
    });
  }

  async update(
    id: string,
    updateAppointmentDto: UpdateAppointmentDto,
    userRole?: string,
    userStudioId?: string,
    userStaffId?: string,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        service: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== appointment.studioId) {
      throw new ForbiddenException('Access denied to this appointment');
    }

    // MASTER can only update their own appointments
    if (userRole === UserRole.MASTER && userStaffId !== appointment.staffUserId) {
      throw new ForbiddenException('Access denied to this appointment');
    }

    // If startAt is being updated, recalculate endAt and check availability
    let startAt = appointment.startAt;
    let endAt = appointment.endAt;

    if (updateAppointmentDto.startAt) {
      startAt = new Date(updateAppointmentDto.startAt);

      // Get duration
      const staffOverride = await this.prisma.staffServiceOverride.findUnique({
        where: {
          studioId_staffUserId_serviceId: {
            studioId: appointment.studioId,
            staffUserId: appointment.staffUserId,
            serviceId: appointment.serviceId,
          },
        },
      });

      const durationMinutes =
        staffOverride?.durationMin && staffOverride.isActive
          ? staffOverride.durationMin
          : appointment.service.defaultDurationMin;

      endAt = this.calculateEndAt(startAt, durationMinutes);

      // Check availability (excluding current appointment)
      await this.availabilityService.checkAppointmentAvailability(
        appointment.studioId,
        appointment.staffUserId,
        startAt,
        endAt,
        id,
      );
    }

    // Use transaction for update
    return this.prisma.$transaction(async (tx) => {
      if (updateAppointmentDto.startAt) {
        // Double-check availability within transaction
        await this.availabilityService.checkAppointmentAvailability(
          appointment.studioId,
          appointment.staffUserId,
          startAt,
          endAt,
          id,
        );
      }

      return tx.appointment.update({
        where: { id },
        data: {
          startAt: updateAppointmentDto.startAt ? startAt : undefined,
          endAt: updateAppointmentDto.startAt ? endAt : undefined,
          prepaymentAmount: updateAppointmentDto.prepaymentAmount,
          status: updateAppointmentDto.status,
        },
        include: {
          staff: {
            include: {
              staffProfile: true,
            },
          },
          client: true,
          service: true,
        },
      });
    });
  }

  async cancel(id: string, userRole?: string, userStudioId?: string, userStaffId?: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== appointment.studioId) {
      throw new ForbiddenException('Access denied to this appointment');
    }

    // MASTER can only cancel their own appointments
    if (userRole === UserRole.MASTER && userStaffId !== appointment.staffUserId) {
      throw new ForbiddenException('Access denied to this appointment');
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Appointment is already cancelled');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
      },
    });
  }

  async markArrived(id: string, userId: string, userRole?: string, userStudioId?: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== appointment.studioId) {
      throw new ForbiddenException('Access denied to this appointment');
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Cannot mark cancelled appointment as arrived');
    }

    if (appointment.status === AppointmentStatus.ARRIVED) {
      throw new BadRequestException('Appointment is already marked as arrived');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.ARRIVED,
        arrivedAt: new Date(),
        arrivedByUserId: userId,
      },
      include: {
        staff: {
          include: {
            staffProfile: true,
          },
        },
        client: true,
        service: true,
        arrivedByUser: {
          select: {
            id: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }
}


