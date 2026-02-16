import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateUpsellDto } from './dto/create-upsell.dto';
import { UpdateUpsellDto } from './dto/update-upsell.dto';
import { UserRole } from '../common/decorators/roles.decorator';

@Injectable()
export class UpsellsService {
  constructor(private prisma: PrismaService) {}

  async create(
    appointmentId: string,
    createUpsellDto: CreateUpsellDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    // Проверяем существование записи и доступ
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        service: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${appointmentId} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userRole !== UserRole.MANAGER) {
      if (userStudioId !== appointment.studioId) {
        throw new ForbiddenException('Access denied to this appointment');
      }
    }

    // Проверяем, что услуга существует и принадлежит тому же салону
    const service = await this.prisma.service.findUnique({
      where: { id: createUpsellDto.serviceId },
    });

    if (!service || service.studioId !== appointment.studioId) {
      throw new NotFoundException('Service not found or does not belong to this studio');
    }

    if (!service.isActive) {
      throw new BadRequestException('Service is not active');
    }

    const quantity = createUpsellDto.quantity || 1;
    const totalAmount = quantity * createUpsellDto.price;

    return this.prisma.appointmentUpsell.create({
      data: {
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
    if (userRole !== UserRole.OWNER && userRole !== UserRole.MANAGER) {
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
  ) {
    const upsell = await this.prisma.appointmentUpsell.findUnique({
      where: { id },
      include: {
        appointment: true,
      },
    });

    if (!upsell) {
      throw new NotFoundException(`Upsell with ID ${id} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userRole !== UserRole.MANAGER) {
      if (userStudioId !== upsell.appointment.studioId) {
        throw new ForbiddenException('Access denied to this upsell');
      }
    }

    const quantity = updateUpsellDto.quantity ?? upsell.quantity;
    const price = updateUpsellDto.price ?? upsell.price;
    const totalAmount = quantity * price;

    return this.prisma.appointmentUpsell.update({
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
  }

  async remove(id: string, userRole?: string, userStudioId?: string) {
    const upsell = await this.prisma.appointmentUpsell.findUnique({
      where: { id },
      include: {
        appointment: true,
      },
    });

    if (!upsell) {
      throw new NotFoundException(`Upsell with ID ${id} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userRole !== UserRole.MANAGER) {
      if (userStudioId !== upsell.appointment.studioId) {
        throw new ForbiddenException('Access denied to this upsell');
      }
    }

    await this.prisma.appointmentUpsell.delete({
      where: { id },
    });

    return { success: true, message: 'Upsell deleted' };
  }
}

