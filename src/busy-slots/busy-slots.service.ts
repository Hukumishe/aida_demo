import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateBusySlotDto } from './dto/create-busy-slot.dto';
import { UpdateBusySlotDto } from './dto/update-busy-slot.dto';
import { UserRole } from '../common/decorators/roles.decorator';
import { AvailabilityService } from '../availability/availability.service';

@Injectable()
export class BusySlotsService {
  constructor(
    private prisma: PrismaService,
    private availabilityService: AvailabilityService,
  ) {}

  async findAll(
    studioId: string,
    date?: string,
    userRole?: string,
    userStudioId?: string,
  ) {
    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
    }

    const where: any = { studioId };

    if (date) {
      const dateObj = new Date(date);
      const nextDay = new Date(dateObj);
      nextDay.setDate(nextDay.getDate() + 1);

      where.startAt = {
        gte: dateObj,
        lt: nextDay,
      };
    }

    return this.prisma.busySlot.findMany({
      where,
      include: {
        staff: {
          include: {
            staffProfile: true,
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
    createBusySlotDto: CreateBusySlotDto,
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
      where: { id: createBusySlotDto.staffUserId },
    });

    if (!staff || staff.studioId !== studioId) {
      throw new NotFoundException('Staff member not found or does not belong to this studio');
    }

    const startAt = new Date(createBusySlotDto.startAt);
    const endAt = new Date(createBusySlotDto.endAt);

    if (endAt <= startAt) {
      throw new BadRequestException('endAt must be greater than startAt');
    }

    // Check if busy slot is allowed (must be within work schedule)
    await this.availabilityService.checkBusySlotAllowed(
      studioId,
      createBusySlotDto.staffUserId,
      startAt,
      endAt,
    );

    return this.prisma.busySlot.create({
      data: {
        studioId,
        staffUserId: createBusySlotDto.staffUserId,
        startAt,
        endAt,
        comment: createBusySlotDto.comment,
        forfeitedPrepaymentAmount: createBusySlotDto.forfeitedPrepaymentAmount,
      },
    });
  }

  async update(
    id: string,
    updateBusySlotDto: UpdateBusySlotDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    const busySlot = await this.prisma.busySlot.findUnique({
      where: { id },
    });

    if (!busySlot) {
      throw new NotFoundException(`Busy slot with ID ${id} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== busySlot.studioId) {
      throw new ForbiddenException('Access denied to this busy slot');
    }

    const startAt = updateBusySlotDto.startAt
      ? new Date(updateBusySlotDto.startAt)
      : busySlot.startAt;
    const endAt = updateBusySlotDto.endAt
      ? new Date(updateBusySlotDto.endAt)
      : busySlot.endAt;

    if (endAt <= startAt) {
      throw new BadRequestException('endAt must be greater than startAt');
    }

    // Check if busy slot is allowed (must be within work schedule)
    if (updateBusySlotDto.startAt || updateBusySlotDto.endAt) {
      await this.availabilityService.checkBusySlotAllowed(
        busySlot.studioId,
        busySlot.staffUserId,
        startAt,
        endAt,
      );
    }

    return this.prisma.busySlot.update({
      where: { id },
      data: {
        startAt: updateBusySlotDto.startAt ? startAt : undefined,
        endAt: updateBusySlotDto.endAt ? endAt : undefined,
        comment: updateBusySlotDto.comment,
        forfeitedPrepaymentAmount: updateBusySlotDto.forfeitedPrepaymentAmount,
      },
    });
  }

  async remove(id: string, userRole?: string, userStudioId?: string) {
    const busySlot = await this.prisma.busySlot.findUnique({
      where: { id },
    });

    if (!busySlot) {
      throw new NotFoundException(`Busy slot with ID ${id} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== busySlot.studioId) {
      throw new ForbiddenException('Access denied to this busy slot');
    }

    return this.prisma.busySlot.delete({
      where: { id },
    });
  }
}


