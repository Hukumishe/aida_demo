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

  /**
   * Extract time in HH:MM format from a Date object in Asia/Almaty timezone.
   * Date object is stored in UTC, so we add 6 hours (Almaty offset) to get local time.
   * This is more reliable than using toLocaleTimeString which may have timezone data issues.
   */
  private extractTime(date: Date): string {
    // Date object is in UTC, add 6 hours for Asia/Almaty (UTC+6)
    const almatyDate = new Date(date.getTime() + 6 * 60 * 60 * 1000);
    
    // Extract hours and minutes from UTC time (which now represents Almaty time)
    const hours = String(almatyDate.getUTCHours()).padStart(2, '0');
    const minutes = String(almatyDate.getUTCMinutes()).padStart(2, '0');
    
    return `${hours}:${minutes}`;
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
    // Normalize date: get the date in Almaty timezone from startAt, then convert to UTC midnight
    const almatyDateStr = startAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' }); // Returns YYYY-MM-DD
    const date = new Date(almatyDateStr + 'T00:00:00.000Z'); // UTC midnight for that date

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
    const startTime = this.extractTime(startAt); // HH:MM
    const endTime = this.extractTime(endAt);

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
    // Normalize date: get the date in Almaty timezone from startAt, then convert to UTC midnight
    // This ensures we match the date as stored in PostgreSQL (@db.Date)
    const almatyDateStr = startAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' }); // Returns YYYY-MM-DD
    const date = new Date(almatyDateStr + 'T00:00:00.000Z'); // UTC midnight for that date

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
    const startTime = this.extractTime(startAt); // HH:MM
    const endTime = this.extractTime(endAt);

    // Debug logging
    console.log('[AvailabilityService] Checking appointment time:', {
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      extractedStartTime: startTime,
      extractedEndTime: endTime,
      scheduleStartTime: schedule.startTime,
      scheduleEndTime: schedule.endTime,
      startInRange: this.isTimeInRange(startTime, schedule.startTime, schedule.endTime),
      endInRange: this.isTimeInRange(endTime, schedule.startTime, schedule.endTime),
    });

    if (
      !this.isTimeInRange(startTime, schedule.startTime, schedule.endTime) ||
      !this.isTimeInRange(endTime, schedule.startTime, schedule.endTime)
    ) {
      throw new ConflictException(
        `Appointment is outside work hours. Start: ${startTime}, End: ${endTime}, Schedule: ${schedule.startTime}-${schedule.endTime}`,
        'APPOINTMENT_OUTSIDE_HOURS'
      );
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

