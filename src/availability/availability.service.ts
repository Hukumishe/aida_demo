import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { assertServiceBookableAtStudio } from '../common/service-studio-offering';
import { studioWallClockTimezone } from '../common/effective-timezone';
import {
  extractLocalTimeHHMM,
  utcAtWallClockInTimeZone,
  zonedDayRangeUtc,
} from '../common/iana-wall-time';

/** Промпт для ИИ: возвращается в теле ответа Nextbot под ключом `check_availability`. */
export const NEXTBOT_CHECK_AVAILABILITY_PROMPT =
  'Используй только массив freeSlots: startAt, endAt (ISO), priority — exact | high | normal | low. ' +
  'exact — щель ≈ длительности услуги (±5 мин). ' +
  'high — слот полностью внутри «плотного» окна между двумя подряд записями одного мастера, длина которого ≤ highPriorityGapMinutes (настройка организации). Если настройка null, high не выдаётся вовсе. ' +
  'normal — слот прилегает к записи мастера: его end не дальше normalPriorityToleranceMinutes от старта записи или его start не дальше того же допуска от конца записи (по умолчанию 0 — впритык); при этом НЕ внутри «плотного» окна. ' +
  'low — всё остальное. ' +
  'При услуге < 30 мин часто сетка 30 мин. durationMinutes — длительность услуги из CRM. Не выдумывай слоты вне freeSlots.';

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService) {}

  private async resolveStudioTimeZone(studioId: string): Promise<string> {
    const row = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: {
        timezone: true,
        organization: { select: { ianaTimezone: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Studio not found');
    }
    return studioWallClockTimezone(row, row.organization);
  }

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
    const tz = await this.resolveStudioTimeZone(studioId);
    const dateStr = startAt.toLocaleDateString('en-CA', { timeZone: tz });
    const date = new Date(dateStr + 'T00:00:00.000Z');

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

    const startTime = extractLocalTimeHHMM(startAt, tz);
    const endTime = extractLocalTimeHHMM(endAt, tz);

    if (
      !this.isTimeInRange(startTime, schedule.startTime, schedule.endTime) ||
      !this.isTimeInRange(endTime, schedule.startTime, schedule.endTime)
    ) {
      throw new ConflictException('Busy slot is outside work hours', 'BUSY_SLOT_OUTSIDE_HOURS');
    }

    if (schedule.breakStart && schedule.breakEnd) {
      if (
        this.isTimeRangeOverlapping(
          utcAtWallClockInTimeZone(dateStr, schedule.breakStart, tz),
          utcAtWallClockInTimeZone(dateStr, schedule.breakEnd, tz),
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
    const tz = await this.resolveStudioTimeZone(studioId);
    const dateStr = startAt.toLocaleDateString('en-CA', { timeZone: tz });
    const date = new Date(dateStr + 'T00:00:00.000Z');

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
      throw new ConflictException({
        message: 'No work schedule for this date or day is off',
        error: 'APPOINTMENT_NO_SCHEDULE',
      });
    }

    const startTime = extractLocalTimeHHMM(startAt, tz);
    const endTime = extractLocalTimeHHMM(endAt, tz);

    if (
      !this.isTimeInRange(startTime, schedule.startTime, schedule.endTime) ||
      !this.isTimeInRange(endTime, schedule.startTime, schedule.endTime)
    ) {
      throw new ConflictException({
        message: `Appointment is outside work hours. Start: ${startTime}, End: ${endTime}, Schedule: ${schedule.startTime}-${schedule.endTime}`,
        error: 'APPOINTMENT_OUTSIDE_HOURS',
      });
    }

    if (schedule.breakStart && schedule.breakEnd) {
      const breakStart = utcAtWallClockInTimeZone(dateStr, schedule.breakStart, tz);
      const breakEnd = utcAtWallClockInTimeZone(dateStr, schedule.breakEnd, tz);

      if (this.isTimeRangeOverlapping(breakStart, breakEnd, startAt, endAt)) {
        throw new ConflictException({
          message: 'Appointment overlaps with break time',
          error: 'APPOINTMENT_IN_BREAK',
        });
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
      throw new ConflictException({
        message: 'Appointment overlaps with busy slot',
        error: 'APPOINTMENT_BUSY_SLOT_CONFLICT',
        conflictingBusySlotId: conflictingBusySlot.id,
      });
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
      throw new ConflictException({
        message: 'Appointment overlaps with another appointment',
        error: 'APPOINTMENT_APPOINTMENT_CONFLICT',
        conflictingAppointmentId: conflictingAppointment.id,
      });
    }
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
   * Слот полностью внутри «плотного» окна: между двумя соседними записями мастера,
   * у которых длина окна (next.start − prev.end) ≤ gapLimitMs. Используется для high-приоритета.
   * Если gapLimitMs === null — high никогда не выдаётся (фича выключена).
   */
  private isSlotInsideTightGap(
    slotStartMs: number,
    slotEndMs: number,
    sortedAppts: { start: number; end: number }[],
    gapLimitMs: number | null,
  ): boolean {
    if (gapLimitMs == null) return false;
    for (let i = 0; i < sortedAppts.length - 1; i++) {
      const prevEnd = sortedAppts[i].end;
      const nextStart = sortedAppts[i + 1].start;
      if (nextStart - prevEnd > gapLimitMs) continue;
      if (slotStartMs >= prevEnd && slotEndMs <= nextStart) {
        return true;
      }
    }
    return false;
  }

  /**
   * Слот прилегает к какой-либо записи мастера:
   *   • слот СВЕРХУ записи: slotEnd ≤ appt.start И (appt.start − slotEnd) ≤ tolMs;
   *   • слот СНИЗУ записи: slotStart ≥ appt.end И (slotStart − appt.end) ≤ tolMs.
   * Допуск НЕ даёт слоту «залезть» внутрь записи — только расширяет гэп со стороны
   * свободного времени. tolMs = max(userTolerance, 60 сек) — пол 60 сек на
   * округления шага сетки. userToleranceMs = 0 → поведение «только впритык».
   */
  private isSlotAdjacentToAppointment(
    slotStartMs: number,
    slotEndMs: number,
    sortedAppts: { start: number; end: number }[],
    userToleranceMs: number,
  ): boolean {
    const tolMs = Math.max(userToleranceMs, 60 * 1000);
    for (const a of sortedAppts) {
      // слот сверху: ни одной миллисекунды оверлапа с записью
      if (slotEndMs <= a.start + 60 * 1000 && a.start - slotEndMs <= tolMs) {
        return true;
      }
      // слот снизу
      if (slotStartMs + 60 * 1000 >= a.end && slotStartMs - a.end <= tolMs) {
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
      /** Legacy: одна услуга, если `serviceIds` не передан */
      serviceId?: string;
      /** Одна или несколько услуг; мастера — пересечение, длительность — сумма */
      serviceIds?: string[];
      durationMinutes?: number;
      slotStepMinutes?: number;
    },
  ): Promise<{
    date: string;
    studioId: string;
    serviceIds: string[];
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
      select: {
        organizationId: true,
        timezone: true,
        organization: {
          select: {
            ianaTimezone: true,
            highPriorityGapMinutes: true,
            normalPriorityToleranceMinutes: true,
          },
        },
      },
    });
    if (!studioRow) {
      throw new NotFoundException('Studio not found');
    }
    const wallTz = studioWallClockTimezone(studioRow, studioRow.organization);
    const rawGap = studioRow.organization?.highPriorityGapMinutes ?? null;
    const highPriorityGapMs =
      rawGap != null && rawGap > 0 ? rawGap * 60 * 1000 : null;
    const rawTol = studioRow.organization?.normalPriorityToleranceMinutes ?? 0;
    const normalToleranceMs = rawTol > 0 ? rawTol * 60 * 1000 : 0;

    const resolvedServiceIds: string[] = (() => {
      const fromOpt = (options.serviceIds ?? [])
        .map((s) => String(s).trim())
        .filter((s) => s !== '');
      if (fromOpt.length > 0) {
        const seen = new Set<string>();
        return fromOpt.filter((id) => (seen.has(id) ? false : !!seen.add(id)));
      }
      if (options.serviceId?.trim()) {
        return [options.serviceId.trim()];
      }
      return [];
    })();

    let durationMinutes: number;
    let eligibleStaffUserIds: string[] | null = null;
    if (resolvedServiceIds.length > 0) {
      durationMinutes = 0;
      for (let i = 0; i < resolvedServiceIds.length; i++) {
        const serviceId = resolvedServiceIds[i]!;
        const service = await assertServiceBookableAtStudio(
          this.prisma,
          studioId,
          serviceId,
          studioRow.organizationId,
        );

        const baseLinks = await this.prisma.staffService.findMany({
          where: { studioId, serviceId },
          select: { staffUserId: true },
        });
        const disabledOverrides = await this.prisma.staffServiceOverride.findMany({
          where: { studioId, serviceId, isActive: false },
          select: { staffUserId: true },
        });
        const disabledSet = new Set(disabledOverrides.map((x) => x.staffUserId));
        const forThis = baseLinks
          .map((x) => x.staffUserId)
          .filter((id) => !disabledSet.has(id));

        if (i === 0) {
          eligibleStaffUserIds = forThis;
        } else {
          const set = new Set(forThis);
          eligibleStaffUserIds = eligibleStaffUserIds!.filter((id) => set.has(id));
        }

        let partDuration = service.defaultDurationMin;
        if (options.staffUserId) {
          const ov = await this.prisma.staffServiceOverride.findUnique({
            where: {
              studioId_staffUserId_serviceId: {
                studioId,
                staffUserId: options.staffUserId,
                serviceId,
              },
            },
          });
          if (ov?.isActive && ov.durationMin) {
            partDuration = ov.durationMin;
          }
        }
        durationMinutes += partDuration;
      }

      if (
        options.staffUserId &&
        eligibleStaffUserIds &&
        !eligibleStaffUserIds.includes(options.staffUserId)
      ) {
        throw new BadRequestException(
          'Выбранный мастер не оказывает все указанные услуги в этом филиале.',
        );
      }
    } else if (
      options.durationMinutes != null &&
      !Number.isNaN(options.durationMinutes) &&
      options.durationMinutes > 0
    ) {
      durationMinutes = options.durationMinutes;
    } else {
      throw new BadRequestException(
        'Укажите serviceIds (длительности суммируются, мастера — пересечение по всем) или serviceId, либо durationMinutes.',
      );
    }
    durationMinutes = Math.min(Math.max(durationMinutes, 5), 8 * 60);

    const { dayStart: dateStart, nextDayStart: dayAfter } = zonedDayRangeUtc(
      dateStr,
      wallTz,
    );

    const busyWhere: Record<string, unknown> = {
      studioId,
      startAt: { gte: dateStart, lt: dayAfter },
    };
    if (options.staffUserId) {
      busyWhere.staffUserId = options.staffUserId;
    } else if (eligibleStaffUserIds) {
      if (eligibleStaffUserIds.length === 0) {
        return {
          date: dateStr,
          studioId,
          serviceIds: resolvedServiceIds,
          durationMinutes,
          slotStepMinutes: slotStep,
          freeSlots: [],
        };
      }
      busyWhere.staffUserId = { in: eligibleStaffUserIds };
    }

    const busySlots = await this.prisma.busySlot.findMany({
      where: busyWhere,
      select: { staffUserId: true, startAt: true, endAt: true },
    });

    const apptWhere: Record<string, unknown> = {
      studioId,
      status: { not: 'CANCELLED' },
      startAt: { gte: dateStart, lt: dayAfter },
    };
    if (options.staffUserId) {
      apptWhere.staffUserId = options.staffUserId;
    } else if (eligibleStaffUserIds) {
      apptWhere.staffUserId = { in: eligibleStaffUserIds };
    }

    const appointments = await this.prisma.appointment.findMany({
      where: apptWhere,
      select: { staffUserId: true, startAt: true, endAt: true },
    });

    const schedules = await this.prisma.workScheduleDay.findMany({
      where: {
        studioId,
        date: dateObj,
        ...(options.staffUserId
          ? { staffUserId: options.staffUserId }
          : eligibleStaffUserIds
            ? { staffUserId: { in: eligibleStaffUserIds } }
            : {}),
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

      const workOpen = utcAtWallClockInTimeZone(
        dateStr,
        schedule.startTime,
        wallTz,
      ).getTime();
      const workClose = utcAtWallClockInTimeZone(
        dateStr,
        schedule.endTime,
        wallTz,
      ).getTime();
      if (workClose <= workOpen) continue;

      let segments = [{ start: workOpen, end: workClose }];

      if (schedule.breakStart && schedule.breakEnd) {
        const b0 = utcAtWallClockInTimeZone(
          dateStr,
          schedule.breakStart,
          wallTz,
        ).getTime();
        const b1 = utcAtWallClockInTimeZone(
          dateStr,
          schedule.breakEnd,
          wallTz,
        ).getTime();
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

    const PRI: Record<'exact' | 'high' | 'normal' | 'low', number> = {
      exact: 0,
      high: 1,
      normal: 2,
      low: 3,
    };
    let freeSlotsWithPriority = freeSlots.map((slot) => {
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
      // high: слот полностью внутри «плотного» окна (≤ highPriorityGapMinutes)
      // между двумя подряд записями мастера. Если настройка null — high выключен.
      if (this.isSlotInsideTightGap(s, e, sorted, highPriorityGapMs)) {
        return {
          staffUserId: slot.staffUserId,
          staffName: slot.staffName,
          startAt: slot.startAt,
          endAt: slot.endAt,
          priority: 'high' as const,
        };
      }
      // normal: слот вплотную прилегает к какой-то записи мастера (сверху или снизу),
      // но НЕ попал в high (либо окно шире порога, либо окна нет — «одинокая» запись
      // в начале/конце дня).
      if (this.isSlotAdjacentToAppointment(s, e, sorted, normalToleranceMs)) {
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

    if (eligibleStaffUserIds && eligibleStaffUserIds.length > 0) {
      const allowed = new Set(eligibleStaffUserIds);
      freeSlotsWithPriority = freeSlotsWithPriority.filter((s) =>
        allowed.has(s.staffUserId),
      );
    }

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
      serviceIds: resolvedServiceIds,
      durationMinutes,
      slotStepMinutes: effectiveSlotStepForResponse,
      freeSlots: freeSlotsWithPriority,
    };
  }
}

