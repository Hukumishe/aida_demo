import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { assertServiceBookableAtStudio } from '../common/service-studio-offering';

/** Промпт для ИИ: возвращается в теле ответа Nextbot под ключом `check_availability`. */
export const NEXTBOT_CHECK_AVAILABILITY_PROMPT =
  'Используй только массив freeSlots: startAt, endAt (ISO), priority — exact | high | normal | low. exact — щель ≈ длительности услуги (±5 мин). high — окно строго между двумя подряд записями. normal — только первое свободное окно сразу после последней записи мастера в этот день (хвост дня). low — всё остальное. При услуге < 30 мин часто сетка 30 мин. durationMinutes — длительность услуги из CRM. Не выдумывай слоты вне freeSlots.';

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

  private padHhMmToIsoTime(raw: string): string {
    const p = raw.trim().split(':');
    const h = parseInt(p[0], 10);
    const m = parseInt(p[1] ?? '0', 10);
    if (Number.isNaN(h) || Number.isNaN(m)) {
      throw new BadRequestException(`Invalid time format: ${raw}`);
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  }

  /** Момент времени по «настенным» часам филиала (Asia/Almaty +06:00) для календарной даты dateStr (YYYY-MM-DD). */
  private almatyWallInstant(dateStr: string, hhMm: string): Date {
    const time = this.padHhMmToIsoTime(hhMm);
    return new Date(`${dateStr}T${time}+06:00`);
  }

  private subtractIntervals(
    segments: Array<{ start: number; end: number }>,
    cut: { start: number; end: number },
  ): Array<{ start: number; end: number }> {
    const out: Array<{ start: number; end: number }> = [];
    for (const seg of segments) {
      if (cut.end <= seg.start || cut.start >= seg.end) {
        out.push(seg);
        continue;
      }
      if (cut.start > seg.start) {
        out.push({ start: seg.start, end: Math.min(cut.start, seg.end) });
      }
      if (cut.end < seg.end) {
        out.push({ start: Math.max(cut.end, seg.start), end: seg.end });
      }
    }
    return out.filter((s) => s.end > s.start);
  }

  /**
   * Окно целиком в промежутке между двумя подряд записями (не «хвост» после последней).
   */
  private isSlotBetweenTwoAppointments(
    slotStartMs: number,
    slotEndMs: number,
    sortedAppts: { start: number; end: number }[],
  ): boolean {
    for (let i = 0; i < sortedAppts.length - 1; i++) {
      const prevEnd = sortedAppts[i].end;
      const nextStart = sortedAppts[i + 1].start;
      if (slotStartMs >= prevEnd && slotEndMs <= nextStart) {
        return true;
      }
    }
    return false;
  }

  /**
   * Свободные слоты для Nextbot check_availability (только доступные окна, без сырых расписаний).
   */
  async computeNextbotFreeSlots(
    studioId: string,
    dateInput: string,
    options: {
      staffUserId?: string;
      serviceId?: string;
      durationMinutes?: number;
      slotStepMinutes?: number;
    },
  ): Promise<{
    date: string;
    studioId: string;
    durationMinutes: number;
    slotStepMinutes: number;
    freeSlots: Array<{
      staffUserId: string;
      staffName: string | null;
      startAt: string;
      endAt: string;
      priority: 'exact' | 'high' | 'normal' | 'low';
    }>;
  }> {
    const dateStr = dateInput.includes('T') ? dateInput.split('T')[0] : dateInput;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }

    const slotStep = Math.min(Math.max(options.slotStepMinutes ?? 15, 5), 120);
    const dateObj = new Date(`${dateStr}T00:00:00.000Z`);

    const studioRow = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { organizationId: true },
    });
    if (!studioRow) {
      throw new NotFoundException('Studio not found');
    }

    let durationMinutes: number;
    if (options.serviceId?.trim()) {
      const service = await assertServiceBookableAtStudio(
        this.prisma,
        studioId,
        options.serviceId.trim(),
        studioRow.organizationId,
      );
      durationMinutes = service.defaultDurationMin;
      if (options.staffUserId) {
        const ov = await this.prisma.staffServiceOverride.findUnique({
          where: {
            studioId_staffUserId_serviceId: {
              studioId,
              staffUserId: options.staffUserId,
              serviceId: options.serviceId.trim(),
            },
          },
        });
        if (ov?.isActive && ov.durationMin) {
          durationMinutes = ov.durationMin;
        }
      }
    } else if (
      options.durationMinutes != null &&
      !Number.isNaN(options.durationMinutes) &&
      options.durationMinutes > 0
    ) {
      durationMinutes = options.durationMinutes;
    } else {
      throw new BadRequestException(
        'Укажите serviceId (длительность из карточки услуги и при необходимости override мастера) или durationMinutes.',
      );
    }
    durationMinutes = Math.min(Math.max(durationMinutes, 5), 8 * 60);

    const dateStart = new Date(`${dateStr}T00:00:00+06:00`);
    const dateEnd = new Date(`${dateStr}T23:59:59.999+06:00`);

    const busyWhere: Record<string, unknown> = {
      studioId,
      startAt: { gte: dateStart, lte: dateEnd },
    };
    if (options.staffUserId) {
      busyWhere.staffUserId = options.staffUserId;
    }

    const busySlots = await this.prisma.busySlot.findMany({
      where: busyWhere,
      select: { staffUserId: true, startAt: true, endAt: true },
    });

    const apptWhere: Record<string, unknown> = {
      studioId,
      status: { not: 'CANCELLED' },
      startAt: { gte: dateStart, lte: dateEnd },
    };
    if (options.staffUserId) {
      apptWhere.staffUserId = options.staffUserId;
    }

    const appointments = await this.prisma.appointment.findMany({
      where: apptWhere,
      select: { staffUserId: true, startAt: true, endAt: true },
    });

    const schedules = await this.prisma.workScheduleDay.findMany({
      where: {
        studioId,
        date: dateObj,
        ...(options.staffUserId ? { staffUserId: options.staffUserId } : {}),
      },
      include: {
        staff: { include: { staffProfile: true } },
      },
    });

    const durationMs = durationMinutes * 60 * 1000;
    const stepMs = slotStep * 60 * 1000;
    /** Услуги < 30 мин: в ответе сетка окон по 30 мин; щель ≈ длительности услуги (±5 мин) — отдельный слот exact. */
    const shortServiceUsesHalfHourGrid = durationMinutes < 30;
    const displayBlockMs = 30 * 60 * 1000;
    const exactLengthToleranceMs = 5 * 60 * 1000;

    const freeSlots: Array<{
      staffUserId: string;
      staffName: string | null;
      startAt: string;
      endAt: string;
      exactFit?: boolean;
    }> = [];

    const apptsByStaff = new Map<string, { start: number; end: number }[]>();
    for (const a of appointments) {
      const list = apptsByStaff.get(a.staffUserId) ?? [];
      list.push({ start: a.startAt.getTime(), end: a.endAt.getTime() });
      apptsByStaff.set(a.staffUserId, list);
    }
    for (const list of apptsByStaff.values()) {
      list.sort((x, y) => x.start - y.start);
    }

    const appointmentCountByStaff = new Map<string, number>();
    for (const a of appointments) {
      appointmentCountByStaff.set(
        a.staffUserId,
        (appointmentCountByStaff.get(a.staffUserId) ?? 0) + 1,
      );
    }

    for (const schedule of schedules) {
      if (schedule.isDayOff) continue;

      const staffUserId = schedule.staffUserId;
      const sp = schedule.staff?.staffProfile;
      let staffName: string | null = null;
      if (sp) {
        const parts = [sp.firstName, sp.lastName].filter(Boolean);
        staffName = parts.join(' ').trim() || sp.title?.trim() || null;
      }
      if (!staffName) {
        staffName = schedule.staff?.phone || null;
      }

      const workOpen = this.almatyWallInstant(dateStr, schedule.startTime).getTime();
      const workClose = this.almatyWallInstant(dateStr, schedule.endTime).getTime();
      if (workClose <= workOpen) continue;

      let segments = [{ start: workOpen, end: workClose }];

      if (schedule.breakStart && schedule.breakEnd) {
        const b0 = this.almatyWallInstant(dateStr, schedule.breakStart).getTime();
        const b1 = this.almatyWallInstant(dateStr, schedule.breakEnd).getTime();
        if (b1 > b0) {
          segments = this.subtractIntervals(segments, { start: b0, end: b1 });
        }
      }

      const staffBusy = busySlots
        .filter((b) => b.staffUserId === staffUserId)
        .map((b) => ({ start: b.startAt.getTime(), end: b.endAt.getTime() }));
      const staffAppt = appointments
        .filter((a) => a.staffUserId === staffUserId)
        .map((a) => ({ start: a.startAt.getTime(), end: a.endAt.getTime() }));

      for (const bl of [...staffBusy, ...staffAppt]) {
        segments = this.subtractIntervals(segments, bl);
      }

      for (const seg of segments) {
        const segLen = seg.end - seg.start;

        if (shortServiceUsesHalfHourGrid) {
          const snugExact =
            segLen >= durationMs &&
            Math.abs(segLen - durationMs) <= exactLengthToleranceMs;
          if (snugExact) {
            freeSlots.push({
              staffUserId,
              staffName,
              startAt: new Date(seg.start).toISOString(),
              endAt: new Date(seg.start + durationMs).toISOString(),
              exactFit: true,
            });
            continue;
          }
          for (let t = seg.start; t + displayBlockMs <= seg.end; t += displayBlockMs) {
            freeSlots.push({
              staffUserId,
              staffName,
              startAt: new Date(t).toISOString(),
              endAt: new Date(t + displayBlockMs).toISOString(),
            });
          }
          continue;
        }

        // Длительность услуги ≥ 30 мин: окна длиной duration, шаг slotStep.
        for (let t = seg.start; t + durationMs < seg.end; t += stepMs) {
          freeSlots.push({
            staffUserId,
            staffName,
            startAt: new Date(t).toISOString(),
            endAt: new Date(t + durationMs).toISOString(),
          });
        }
      }
    }

    /** Первое по времени начало слота в «хвосте» дня после последней записи мастера — единственный normal (на мастера). */
    const minTailStartByStaff = new Map<string, number>();
    for (const slot of freeSlots) {
      if (slot.exactFit) {
        continue;
      }
      const sid = slot.staffUserId;
      const sorted = apptsByStaff.get(sid) ?? [];
      if (sorted.length === 0) {
        continue;
      }
      const lastEnd = sorted[sorted.length - 1].end;
      const t = new Date(slot.startAt).getTime();
      if (t < lastEnd) {
        continue;
      }
      const cur = minTailStartByStaff.get(sid);
      if (cur === undefined || t < cur) {
        minTailStartByStaff.set(sid, t);
      }
    }

    const PRI: Record<'exact' | 'high' | 'normal' | 'low', number> = {
      exact: 0,
      high: 1,
      normal: 2,
      low: 3,
    };
    const freeSlotsWithPriority = freeSlots.map((slot) => {
      const s = new Date(slot.startAt).getTime();
      const e = new Date(slot.endAt).getTime();
      const sorted = apptsByStaff.get(slot.staffUserId) ?? [];
      if (slot.exactFit) {
        return {
          staffUserId: slot.staffUserId,
          staffName: slot.staffName,
          startAt: slot.startAt,
          endAt: slot.endAt,
          priority: 'exact' as const,
        };
      }
      if (this.isSlotBetweenTwoAppointments(s, e, sorted)) {
        return {
          staffUserId: slot.staffUserId,
          staffName: slot.staffName,
          startAt: slot.startAt,
          endAt: slot.endAt,
          priority: 'high' as const,
        };
      }
      const lastEnd = sorted.length > 0 ? sorted[sorted.length - 1].end : null;
      const minTail = minTailStartByStaff.get(slot.staffUserId);
      if (
        lastEnd != null &&
        minTail !== undefined &&
        s === minTail &&
        s >= lastEnd
      ) {
        return {
          staffUserId: slot.staffUserId,
          staffName: slot.staffName,
          startAt: slot.startAt,
          endAt: slot.endAt,
          priority: 'normal' as const,
        };
      }
      return {
        staffUserId: slot.staffUserId,
        staffName: slot.staffName,
        startAt: slot.startAt,
        endAt: slot.endAt,
        priority: 'low' as const,
      };
    });

    freeSlotsWithPriority.sort((a, b) => {
      const d = PRI[a.priority] - PRI[b.priority];
      if (d !== 0) {
        return d;
      }
      if (!options.staffUserId) {
        const ca = appointmentCountByStaff.get(a.staffUserId) ?? 0;
        const cb = appointmentCountByStaff.get(b.staffUserId) ?? 0;
        if (ca !== cb) {
          return ca - cb;
        }
      }
      return a.startAt.localeCompare(b.startAt) || a.staffUserId.localeCompare(b.staffUserId);
    });

    const effectiveSlotStepForResponse = shortServiceUsesHalfHourGrid ? 30 : slotStep;

    return {
      date: dateStr,
      studioId,
      durationMinutes,
      slotStepMinutes: effectiveSlotStepForResponse,
      freeSlots: freeSlotsWithPriority,
    };
  }
}

