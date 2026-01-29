import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService) {}

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private isTimeInRange(time: string, startTime: string, endTime: string): boolean {
    const timeMinutes = this.timeToMinutes(time);
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
  }

  private isTimeRangeOverlapping(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date,
  ): boolean {
    return start1 < end2 && start2 < end1;
  }

  async checkBusySlotAllowed(
    studioId: string,
    staffUserId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<void> {
    const date = new Date(startAt);
    date.setHours(0, 0, 0, 0);

    // Get work schedule for the date
    const schedule = await this.prisma.workScheduleDay.findUnique({
      where: {
        studioId_staffUserId_date: {
          studioId,
          staffUserId,
          date,
        },
      },
    });

    if (!schedule || schedule.isDayOff) {
      throw new ConflictException('No work schedule for this date or day is off', 'BUSY_SLOT_NO_SCHEDULE');
    }

    // Check if busy slot is within work hours
    const startTime = startAt.toTimeString().slice(0, 5); // HH:MM
    const endTime = endAt.toTimeString().slice(0, 5);

    if (
      !this.isTimeInRange(startTime, schedule.startTime, schedule.endTime) ||
      !this.isTimeInRange(endTime, schedule.startTime, schedule.endTime)
    ) {
      throw new ConflictException('Busy slot is outside work hours', 'BUSY_SLOT_OUTSIDE_HOURS');
    }

    // Check if busy slot overlaps with break
    if (schedule.breakStart && schedule.breakEnd) {
      if (
        this.isTimeRangeOverlapping(
          new Date(`${date.toISOString().split('T')[0]}T${schedule.breakStart}:00`),
          new Date(`${date.toISOString().split('T')[0]}T${schedule.breakEnd}:00`),
          startAt,
          endAt,
        )
      ) {
        throw new ConflictException('Busy slot overlaps with break time', 'BUSY_SLOT_IN_BREAK');
      }
    }
  }

  async checkAppointmentAvailability(
    studioId: string,
    staffUserId: string,
    startAt: Date,
    endAt: Date,
    appointmentId?: string,
  ): Promise<void> {
    const date = new Date(startAt);
    date.setHours(0, 0, 0, 0);

    // 1. Check work schedule
    const schedule = await this.prisma.workScheduleDay.findUnique({
      where: {
        studioId_staffUserId_date: {
          studioId,
          staffUserId,
          date,
        },
      },
    });

    if (!schedule || schedule.isDayOff) {
      throw new ConflictException('No work schedule for this date or day is off', 'APPOINTMENT_NO_SCHEDULE');
    }

    // 2. Check if appointment is within work hours
    const startTime = startAt.toTimeString().slice(0, 5); // HH:MM
    const endTime = endAt.toTimeString().slice(0, 5);

    if (
      !this.isTimeInRange(startTime, schedule.startTime, schedule.endTime) ||
      !this.isTimeInRange(endTime, schedule.startTime, schedule.endTime)
    ) {
      throw new ConflictException('Appointment is outside work hours', 'APPOINTMENT_OUTSIDE_HOURS');
    }

    // 3. Check if appointment overlaps with break
    if (schedule.breakStart && schedule.breakEnd) {
      const breakStart = new Date(`${date.toISOString().split('T')[0]}T${schedule.breakStart}:00`);
      const breakEnd = new Date(`${date.toISOString().split('T')[0]}T${schedule.breakEnd}:00`);

      if (this.isTimeRangeOverlapping(breakStart, breakEnd, startAt, endAt)) {
        throw new ConflictException('Appointment overlaps with break time', 'APPOINTMENT_IN_BREAK');
      }
    }

    // 4. Check if appointment overlaps with busy slots
    const conflictingBusySlot = await this.prisma.busySlot.findFirst({
      where: {
        studioId,
        staffUserId,
        OR: [
          {
            AND: [
              { startAt: { lte: startAt } },
              { endAt: { gt: startAt } },
            ],
          },
          {
            AND: [
              { startAt: { lt: endAt } },
              { endAt: { gte: endAt } },
            ],
          },
          {
            AND: [
              { startAt: { gte: startAt } },
              { endAt: { lte: endAt } },
            ],
          },
        ],
      },
    });

    if (conflictingBusySlot) {
      throw new ConflictException('Appointment overlaps with busy slot', 'APPOINTMENT_BUSY_SLOT_CONFLICT');
    }

    // 5. Check if appointment overlaps with other appointments (except CANCELLED)
    const conflictingAppointment = await this.prisma.appointment.findFirst({
      where: {
        studioId,
        staffUserId,
        id: appointmentId ? { not: appointmentId } : undefined,
        status: { not: 'CANCELLED' },
        OR: [
          {
            AND: [
              { startAt: { lte: startAt } },
              { endAt: { gt: startAt } },
            ],
          },
          {
            AND: [
              { startAt: { lt: endAt } },
              { endAt: { gte: endAt } },
            ],
          },
          {
            AND: [
              { startAt: { gte: startAt } },
              { endAt: { lte: endAt } },
            ],
          },
        ],
      },
    });

    if (conflictingAppointment) {
      throw new ConflictException('Appointment overlaps with another appointment', 'APPOINTMENT_APPOINTMENT_CONFLICT');
    }
  }
}

