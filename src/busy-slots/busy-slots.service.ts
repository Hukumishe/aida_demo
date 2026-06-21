import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateId, IdPrefix } from '../common/id-generator';
import { CreateBusySlotDto } from './dto/create-busy-slot.dto';
import { UpdateBusySlotDto } from './dto/update-busy-slot.dto';
import { UserRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';
import { AvailabilityService } from '../availability/availability.service';
import { assertStaffWorksAtStudio } from '../common/staff-studio-membership';
import { assertUserStudioAccessForResource } from '../common/studio-access.util';
import { enrichBusySlotsForSchedule } from './busy-slot-response.util';

@Injectable()
export class BusySlotsService {
  constructor(
    private prisma: PrismaService,
    private availabilityService: AvailabilityService,
  ) {}

  /** Личное / «серое» время: вне графика допустимо при указанной причине. */
  private allowsPersonalTimeOutsideSchedule(
    userRole: string | undefined,
    comment: string | null | undefined,
  ): boolean {
    if (!comment?.trim()) {
      return false;
    }
    return userRole === UserRole.MASTER || userRole === UserRole.ADMIN;
  }

  private async assertAdminPersonalTimeForMaster(
    staffUserId: string,
    comment: string | undefined,
    organizationId: string,
  ): Promise<void> {
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
      select: { role: true, organizationId: true, isActive: true },
    });
    if (!staff?.isActive || staff.organizationId !== organizationId) {
      throw new BadRequestException('Мастер не найден в этой организации');
    }
    if (staff.role !== UserRole.MASTER) {
      return;
    }
    if (!comment?.trim()) {
      throw new BadRequestException(
        'При брони личного времени мастера администратор должен указать причину (comment)',
      );
    }
  }

  async findAll(
    studioId: string,
    date?: string,
    userRole?: string,
    userStudioId?: string,
    userStaffId?: string,
    staffUserIdFilter?: string,
  ) {
    // Check access
    // OWNER, DEPUTY_OWNER and MANAGER have access to all studios
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      await assertUserStudioAccessForResource(this.prisma, {
        userRole,
        userId: userStaffId,
        userStudioId,
        studioId,
      });
    }

    const where: any = { studioId };

    if (userRole === UserRole.MASTER && userStaffId) {
      where.staffUserId = userStaffId;
    } else if (staffUserIdFilter?.trim()) {
      const staffId = staffUserIdFilter.trim();
      await assertStaffWorksAtStudio(this.prisma, staffId, studioId);
      where.staffUserId = staffId;
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

    const rows = await this.prisma.busySlot.findMany({
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
    return enrichBusySlotsForSchedule(rows);
  }

  async create(
    studioId: string,
    createBusySlotDto: CreateBusySlotDto,
    userRole?: string,
    userStudioId?: string,
    userStaffId?: string,
  ) {
    // Check access
    // OWNER, DEPUTY_OWNER and MANAGER have access to all studios
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      // ADMIN and MASTER can only access their own studio
      if (userStudioId !== studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }
    }

    // MASTER can only create busy slots for themselves
    if (userRole === UserRole.MASTER && userStaffId) {
      if (createBusySlotDto.staffUserId !== userStaffId) {
        throw new ForbiddenException('Мастер может бронировать время только для себя');
      }
      const reason = createBusySlotDto.comment?.trim();
      if (!reason) {
        throw new BadRequestException(
          'Укажите причину брони (поле comment) — обязательно для личного времени мастера',
        );
      }
    }

    // Verify studio exists
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
    });
    if (!studio) {
      throw new NotFoundException(`Studio with ID ${studioId} not found`);
    }

    if (userRole === UserRole.ADMIN) {
      await this.assertAdminPersonalTimeForMaster(
        createBusySlotDto.staffUserId,
        createBusySlotDto.comment,
        studio.organizationId,
      );
    }

    await assertStaffWorksAtStudio(
      this.prisma,
      createBusySlotDto.staffUserId,
      studioId,
    );

    const startAt = new Date(createBusySlotDto.startAt);
    const endAt = new Date(createBusySlotDto.endAt);

    if (endAt <= startAt) {
      throw new BadRequestException('endAt must be greater than startAt');
    }

    if (
      !this.allowsPersonalTimeOutsideSchedule(userRole, createBusySlotDto.comment)
    ) {
      await this.availabilityService.checkBusySlotAllowed(
        studioId,
        createBusySlotDto.staffUserId,
        startAt,
        endAt,
      );
    }

    const created = await this.prisma.busySlot.create({
      data: {
        id: generateId(IdPrefix.BusySlot),
        studioId,
        staffUserId: createBusySlotDto.staffUserId,
        startAt,
        endAt,
        comment: createBusySlotDto.comment?.trim() || null,
        forfeitedPrepaymentAmount: createBusySlotDto.forfeitedPrepaymentAmount,
      },
      include: {
        staff: { include: { staffProfile: true } },
      },
    });
    return enrichBusySlotsForSchedule([created])[0];
  }

  async update(
    id: string,
    updateBusySlotDto: UpdateBusySlotDto,
    userRole?: string,
    userStudioId?: string,
    userStaffId?: string,
  ) {
    const busySlot = await this.prisma.busySlot.findUnique({
      where: { id },
    });

    if (!busySlot) {
      throw new NotFoundException(`Busy slot with ID ${id} not found`);
    }

    // Check access
    if (!isOwnerLevelRole(userRole) && userStudioId !== busySlot.studioId) {
      throw new ForbiddenException('Access denied to this busy slot');
    }

    if (userRole === UserRole.MASTER && userStaffId && busySlot.staffUserId !== userStaffId) {
      throw new ForbiddenException('Мастер может изменять только свои блоки времени');
    }

    if (userRole === UserRole.ADMIN) {
      const studio = await this.prisma.studio.findUnique({
        where: { id: busySlot.studioId },
        select: { organizationId: true },
      });
      if (studio) {
        const nextComment =
          updateBusySlotDto.comment !== undefined
            ? updateBusySlotDto.comment
            : busySlot.comment ?? undefined;
        await this.assertAdminPersonalTimeForMaster(
          busySlot.staffUserId,
          nextComment,
          studio.organizationId,
        );
      }
    }

    if (
      (userRole === UserRole.MASTER || userRole === UserRole.ADMIN) &&
      updateBusySlotDto.comment !== undefined &&
      !updateBusySlotDto.comment?.trim()
    ) {
      throw new BadRequestException('Причина брони не может быть пустой');
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

    const effectiveComment =
      updateBusySlotDto.comment !== undefined
        ? updateBusySlotDto.comment
        : busySlot.comment;
    const personalOutsideSchedule = this.allowsPersonalTimeOutsideSchedule(
      userRole,
      effectiveComment,
    );

    if ((updateBusySlotDto.startAt || updateBusySlotDto.endAt) && !personalOutsideSchedule) {
      await this.availabilityService.checkBusySlotAllowed(
        busySlot.studioId,
        busySlot.staffUserId,
        startAt,
        endAt,
      );
    }

    const updated = await this.prisma.busySlot.update({
      where: { id },
      data: {
        startAt: updateBusySlotDto.startAt ? startAt : undefined,
        endAt: updateBusySlotDto.endAt ? endAt : undefined,
        comment:
          updateBusySlotDto.comment !== undefined
            ? updateBusySlotDto.comment.trim() || null
            : undefined,
        forfeitedPrepaymentAmount: updateBusySlotDto.forfeitedPrepaymentAmount,
      },
      include: {
        staff: { include: { staffProfile: true } },
      },
    });
    return enrichBusySlotsForSchedule([updated])[0];
  }

  async remove(id: string, userRole?: string, userStudioId?: string, userStaffId?: string) {
    const busySlot = await this.prisma.busySlot.findUnique({
      where: { id },
    });

    if (!busySlot) {
      throw new NotFoundException(`Busy slot with ID ${id} not found`);
    }

    // Check access
    if (!isOwnerLevelRole(userRole) && userStudioId !== busySlot.studioId) {
      throw new ForbiddenException('Access denied to this busy slot');
    }

    if (userRole === UserRole.MASTER && userStaffId && busySlot.staffUserId !== userStaffId) {
      throw new ForbiddenException('Мастер может удалять только свои блоки времени');
    }

    return this.prisma.busySlot.delete({
      where: { id },
    });
  }
}




