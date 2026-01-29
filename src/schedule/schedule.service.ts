import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateScheduleDayDto } from './dto/create-schedule-day.dto';
import { UpdateScheduleDayDto } from './dto/update-schedule-day.dto';
import { GenerateScheduleDto, SchedulePattern } from './dto/generate-schedule.dto';
import { UserRole } from '../common/decorators/roles.decorator';

@Injectable()
export class ScheduleService {
  constructor(private prisma: PrismaService) {}

  private validateTimeRange(startTime: string, endTime: string): void {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (endMinutes <= startMinutes) {
      throw new BadRequestException('endTime must be greater than startTime');
    }
  }

  private validateBreak(
    startTime: string,
    endTime: string,
    breakStart?: string,
    breakEnd?: string,
  ): void {
    if (!breakStart || !breakEnd) {
      return;
    }

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const [breakStartH, breakStartM] = breakStart.split(':').map(Number);
    const [breakEndH, breakEndM] = breakEnd.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const breakStartMinutes = breakStartH * 60 + breakStartM;
    const breakEndMinutes = breakEndH * 60 + breakEndM;

    if (breakEndMinutes <= breakStartMinutes) {
      throw new BadRequestException('breakEnd must be greater than breakStart');
    }

    if (breakStartMinutes < startMinutes || breakEndMinutes > endMinutes) {
      throw new BadRequestException('Break must be within work hours');
    }
  }

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
      where.date = dateObj;
    }

    return this.prisma.workScheduleDay.findMany({
      where,
      include: {
        staff: {
          include: {
            staffProfile: true,
          },
        },
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' },
      ],
    });
  }

  async create(
    studioId: string,
    createScheduleDayDto: CreateScheduleDayDto,
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
      where: { id: createScheduleDayDto.staffUserId },
    });

    if (!staff || staff.studioId !== studioId) {
      throw new NotFoundException('Staff member not found or does not belong to this studio');
    }

    const date = new Date(createScheduleDayDto.date);

    // Validate time range
    if (!createScheduleDayDto.isDayOff) {
      this.validateTimeRange(createScheduleDayDto.startTime, createScheduleDayDto.endTime);
      this.validateBreak(
        createScheduleDayDto.startTime,
        createScheduleDayDto.endTime,
        createScheduleDayDto.breakStart,
        createScheduleDayDto.breakEnd,
      );
    }

    return this.prisma.workScheduleDay.upsert({
      where: {
        studioId_staffUserId_date: {
          studioId,
          staffUserId: createScheduleDayDto.staffUserId,
          date,
        },
      },
      update: {
        startTime: createScheduleDayDto.startTime,
        endTime: createScheduleDayDto.endTime,
        breakStart: createScheduleDayDto.breakStart,
        breakEnd: createScheduleDayDto.breakEnd,
        isDayOff: createScheduleDayDto.isDayOff ?? false,
      },
      create: {
        studioId,
        staffUserId: createScheduleDayDto.staffUserId,
        date,
        startTime: createScheduleDayDto.startTime,
        endTime: createScheduleDayDto.endTime,
        breakStart: createScheduleDayDto.breakStart,
        breakEnd: createScheduleDayDto.breakEnd,
        isDayOff: createScheduleDayDto.isDayOff ?? false,
      },
    });
  }

  async generate(
    studioId: string,
    generateScheduleDto: GenerateScheduleDto,
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
      where: { id: generateScheduleDto.staffUserId },
    });

    if (!staff || staff.studioId !== studioId) {
      throw new NotFoundException('Staff member not found or does not belong to this studio');
    }

    // Validate time range
    this.validateTimeRange(generateScheduleDto.startTime, generateScheduleDto.endTime);
    this.validateBreak(
      generateScheduleDto.startTime,
      generateScheduleDto.endTime,
      generateScheduleDto.breakStart,
      generateScheduleDto.breakEnd,
    );

    const dateFrom = new Date(generateScheduleDto.dateFrom);
    const dateTo = new Date(generateScheduleDto.dateTo);

    if (dateTo < dateFrom) {
      throw new BadRequestException('dateTo must be greater than or equal to dateFrom');
    }

    const schedules: any[] = [];
    const currentDate = new Date(dateFrom);

    while (currentDate <= dateTo) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
      let isWorkDay = false;

      if (generateScheduleDto.pattern === SchedulePattern.FIVE_TWO) {
        // 5/2: Monday-Friday work, Saturday-Sunday off
        isWorkDay = dayOfWeek >= 1 && dayOfWeek <= 5;
      } else if (generateScheduleDto.pattern === SchedulePattern.SIX_ONE) {
        // 6/1: Monday-Saturday work, Sunday off
        isWorkDay = dayOfWeek >= 1 && dayOfWeek <= 6;
      }

      if (isWorkDay) {
        schedules.push({
          studioId,
          staffUserId: generateScheduleDto.staffUserId,
          date: new Date(currentDate),
          startTime: generateScheduleDto.startTime,
          endTime: generateScheduleDto.endTime,
          breakStart: generateScheduleDto.breakStart,
          breakEnd: generateScheduleDto.breakEnd,
          isDayOff: false,
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Use transaction to create all schedules
    const result = await this.prisma.$transaction(
      schedules.map((schedule) =>
        this.prisma.workScheduleDay.upsert({
          where: {
            studioId_staffUserId_date: {
              studioId: schedule.studioId,
              staffUserId: schedule.staffUserId,
              date: schedule.date,
            },
          },
          update: {
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            breakStart: schedule.breakStart,
            breakEnd: schedule.breakEnd,
            isDayOff: schedule.isDayOff,
          },
          create: schedule,
        }),
      ),
    );

    return {
      count: result.length,
      schedules: result,
    };
  }

  async update(
    id: string,
    updateScheduleDayDto: UpdateScheduleDayDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    const scheduleDay = await this.prisma.workScheduleDay.findUnique({
      where: { id },
    });

    if (!scheduleDay) {
      throw new NotFoundException(`Schedule day with ID ${id} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== scheduleDay.studioId) {
      throw new ForbiddenException('Access denied to this schedule');
    }

    // Get current values or use updated ones
    const startTime = updateScheduleDayDto.startTime ?? scheduleDay.startTime;
    const endTime = updateScheduleDayDto.endTime ?? scheduleDay.endTime;
    const breakStart = updateScheduleDayDto.breakStart ?? scheduleDay.breakStart;
    const breakEnd = updateScheduleDayDto.breakEnd ?? scheduleDay.breakEnd;
    const isDayOff = updateScheduleDayDto.isDayOff ?? scheduleDay.isDayOff;

    // Validate if not day off
    if (!isDayOff) {
      this.validateTimeRange(startTime, endTime);
      this.validateBreak(startTime, endTime, breakStart || undefined, breakEnd || undefined);
    }

    return this.prisma.workScheduleDay.update({
      where: { id },
      data: updateScheduleDayDto,
    });
  }
}

