import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateId, IdPrefix } from '../common/id-generator';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { MarkAppointmentDoneDto } from './dto/mark-appointment-done.dto';
import { UserRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';
import {
  getCashbackPercent,
  getLevelFromTotalPaid,
} from '../clients/constants/levels.constants';
import { resolveAutoTierForTotalPaid } from '../common/loyalty/studio-loyalty.util';
import { AvailabilityService } from '../availability/availability.service';
import {
  DEFAULT_IANA_TIMEZONE,
  studioWallClockTimezone,
} from '../common/effective-timezone';
import {
  normalizeCalendarDateStr,
  zonedDayRangeUtc,
} from '../common/iana-wall-time';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AppointmentStatus,
  ClientLevel,
  WaitlistEntrySource,
  WaitlistEntryStatus,
} from '@prisma/client';
import {
  assertReferralCodeIsNotLandingPromo,
  findReferrerByClientReferralCode,
  normalizeReferralCodeInput,
} from '../common/referral-code.util';
import {
  assertUserOrganizationMatchesStudio,
  assertUserOrganizationMatchesStudioOrganizationId,
} from '../common/organization-scope';
import { assertStaffWorksAtStudio } from '../common/staff-studio-membership';
import { assertServiceBookableAtStudio } from '../common/service-studio-offering';

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private availabilityService: AvailabilityService,
    private notificationsService: NotificationsService,
  ) {}

  private calculateEndAt(startAt: Date, durationMinutes: number): Date {
    const endAt = new Date(startAt);
    endAt.setMinutes(endAt.getMinutes() + durationMinutes);
    return endAt;
  }

  /** Основная услуга + доп. основные услуги (без дублей, с сохранением порядка). */
  private buildAppointmentServiceIds(dto: CreateAppointmentDto): string[] {
    const ids: string[] = [];
    const legacyPrimary = String(dto.serviceId ?? '').trim();
    if (legacyPrimary) {
      ids.push(legacyPrimary);
    }
    for (const raw of dto.serviceIds ?? []) {
      const id = String(raw ?? '').trim();
      if (id && !ids.includes(id)) {
        ids.push(id);
      }
    }
    if (ids.length === 0) {
      throw new BadRequestException('serviceIds (or legacy serviceId) is required');
    }
    return ids;
  }

  /**
   * Разрешить услуги для записи с учетом доступности в филиале и override мастера.
   * duration/price считаются как для "основных" услуг записи.
   */
  private async resolveAppointmentServices(
    studioId: string,
    organizationId: string,
    staffUserId: string,
    serviceIds: string[],
  ) {
    const resolved: Array<{
      serviceId: string;
      durationMin: number;
      price: number | null;
      service: { id: string; name: string; bonusAccrualEnabled: boolean };
    }> = [];

    for (const serviceId of serviceIds) {
      const service = await assertServiceBookableAtStudio(
        this.prisma,
        studioId,
        serviceId,
        organizationId,
      );
      const staffOverride = await this.prisma.staffServiceOverride.findUnique({
        where: {
          studioId_staffUserId_serviceId: {
            studioId,
            staffUserId,
            serviceId,
          },
        },
      });
      const durationMin =
        staffOverride?.durationMin && staffOverride.isActive
          ? staffOverride.durationMin
          : service.defaultDurationMin;
      const price =
        staffOverride?.price != null && staffOverride.isActive
          ? staffOverride.price
          : service.defaultPrice ?? null;

      resolved.push({
        serviceId,
        durationMin,
        price,
        service: {
          id: service.id,
          name: service.name,
          bonusAccrualEnabled: service.bonusAccrualEnabled,
        },
      });
    }
    return resolved;
  }

  async findAll(
    studioId: string,
    date?: string,
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

    const where: any = { studioId };

    // MASTER can only see their own appointments
    if (userRole === UserRole.MASTER && userStaffId) {
      where.staffUserId = userStaffId;
    }

    if (date) {
      const dateStr = date.includes('T') ? date.split('T')[0] : date;
      const studio = await this.prisma.studio.findUnique({
        where: { id: studioId },
        include: { organization: true },
      });
      const tz = studio
        ? studioWallClockTimezone(studio, studio.organization)
        : DEFAULT_IANA_TIMEZONE;
      const { dayStart, nextDayStart } = zonedDayRangeUtc(dateStr, tz);
      where.startAt = {
        gte: dayStart,
        lt: nextDayStart,
      };
    }

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: {
        staff: {
          include: {
            staffProfile: true,
          },
        },
        client: true,
        service: true,
        serviceItems: {
          include: { service: true },
          orderBy: { sortOrder: 'asc' },
        },
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

    // Hide client phone for MASTER role
    if (userRole === UserRole.MASTER) {
      return appointments.map((appointment) => ({
        ...appointment,
        client: {
          ...appointment.client,
          phone: undefined, // Hide phone number
        },
      }));
    }

    return appointments;
  }

  async create(
    studioId: string,
    createAppointmentDto: CreateAppointmentDto,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
  ) {
    // Check access
    // OWNER, DEPUTY_OWNER and MANAGER have access to all studios
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      // ADMIN and MASTER can only access their own studio
      if (userStudioId !== studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }
    }

    // Verify studio exists
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      include: { organization: true },
    });
    if (!studio) {
      throw new NotFoundException(`Studio with ID ${studioId} not found`);
    }
    assertUserOrganizationMatchesStudioOrganizationId(
      studio.organizationId,
      userOrganizationId,
      userRole,
    );
    const org = studio.organization;

    await assertStaffWorksAtStudio(
      this.prisma,
      createAppointmentDto.staffUserId,
      studioId,
    );

    // Verify client exists and belongs to studio
    const client = await this.prisma.client.findUnique({
      where: { id: createAppointmentDto.clientId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }
    if (client.organizationId !== studio.organizationId) {
      throw new NotFoundException('Client does not belong to this organization');
    }
    if (client.isBlacklisted) {
      throw new BadRequestException('Cannot create appointment for a blacklisted client');
    }

    const appointmentServiceIds = this.buildAppointmentServiceIds(createAppointmentDto);
    const resolvedServices = await this.resolveAppointmentServices(
      studioId,
      studio.organizationId,
      createAppointmentDto.staffUserId,
      appointmentServiceIds,
    );
    const durationMinutes = resolvedServices.reduce((sum, s) => sum + s.durationMin, 0);

    const startAt = new Date(createAppointmentDto.startAt);
    const endAt = this.calculateEndAt(startAt, durationMinutes);

    const preferWaitlist = !!createAppointmentDto.preferWaitlist;
    const waitlistSource =
      createAppointmentDto.waitlistSource ?? WaitlistEntrySource.CRM;

    // Проверка доступности слота: пересечение по полному [startAt, endAt] с записями, busy, перерывом (см. AvailabilityService).
    if (preferWaitlist) {
      try {
        await this.availabilityService.checkAppointmentAvailability(
          studioId,
          createAppointmentDto.staffUserId,
          startAt,
          endAt,
        );
      } catch (e) {
        if (e instanceof ConflictException) {
          const entry = await this.createWaitlistEntry(
            studioId,
            org.id,
            createAppointmentDto,
            appointmentServiceIds[0],
            startAt,
            endAt,
            waitlistSource,
          );
          return { outcome: 'waitlist' as const, waitlistEntry: entry };
        }
        throw e;
      }
    } else {
      await this.availabilityService.checkAppointmentAvailability(
        studioId,
        createAppointmentDto.staffUserId,
        startAt,
        endAt,
      );
    }

    // Create appointment in transaction
    return this.prisma.$transaction(async (tx) => {
      const clientRow = await tx.client.findUnique({
        where: { id: createAppointmentDto.clientId },
      });
      if (!clientRow) {
        throw new NotFoundException('Client not found');
      }
      if (clientRow.isBlacklisted) {
        throw new BadRequestException('Cannot create appointment for a blacklisted client');
      }

      const normalizedReferral = normalizeReferralCodeInput(createAppointmentDto.referralCode);
      if (normalizedReferral && !clientRow.referredByClientId) {
        const apptCount = await tx.appointment.count({
          where: { clientId: clientRow.id },
        });
        if (apptCount > 0) {
          throw new BadRequestException(
            'Реферальный код можно указать только при первой записи клиента',
          );
        }
        await assertReferralCodeIsNotLandingPromo(tx, normalizedReferral);
        const referrer = await findReferrerByClientReferralCode(
          tx,
          normalizedReferral,
          clientRow.organizationId,
        );
        if (!referrer || referrer.id === clientRow.id) {
          throw new BadRequestException(
            'Неверный реферальный код или нельзя использовать свой код',
          );
        }
        await tx.client.update({
          where: { id: clientRow.id },
          data: { referredByClientId: referrer.id },
        });
      }

      // Double-check availability within transaction
      await this.availabilityService.checkAppointmentAvailability(
        studioId,
        createAppointmentDto.staffUserId,
        startAt,
        endAt,
      );

      const initialStatus = createAppointmentDto.tentative
        ? AppointmentStatus.TENTATIVE
        : AppointmentStatus.BOOKED;

      const appointment = await tx.appointment.create({
        data: {
          id: generateId(IdPrefix.Appointment),
          studioId,
          staffUserId: createAppointmentDto.staffUserId,
          clientId: createAppointmentDto.clientId,
          serviceId: appointmentServiceIds[0],
          startAt,
          endAt,
          prepaymentAmount: createAppointmentDto.prepaymentAmount,
          status: initialStatus,
        },
        include: {
          staff: {
            include: {
              staffProfile: true,
            },
          },
          client: true,
          service: true,
          serviceItems: {
            include: {
              service: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      if (resolvedServices.length > 0) {
        await tx.appointmentServiceItem.createMany({
          data: resolvedServices.map((s, idx) => ({
            id: generateId(IdPrefix.AppointmentServiceItem),
            appointmentId: appointment.id,
            serviceId: s.serviceId,
            sortOrder: idx,
            durationMin: s.durationMin,
            price: s.price,
          })),
        });
      }

      const appointmentWithItems = await tx.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
        include: {
          staff: {
            include: {
              staffProfile: true,
            },
          },
          client: true,
          service: true,
          serviceItems: {
            include: {
              service: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      // Создать уведомление для мастера о новой записи
      try {
        const clientName = `${appointment.client.firstName} ${appointment.client.lastName || ''}`.trim();
        const staffName = appointment.staff.staffProfile
          ? `${appointment.staff.staffProfile.firstName} ${appointment.staff.staffProfile.lastName || ''}`.trim()
          : 'Мастер';
        
        await this.notificationsService.createNewAppointmentNotification(
          studioId,
          createAppointmentDto.staffUserId,
          appointment.id,
          clientName,
          appointmentWithItems.service.name,
          startAt,
        );
      } catch (error) {
        // Логируем ошибку, но не прерываем создание записи
        console.error('Failed to create notification:', error);
      }

      if (preferWaitlist) {
        return { outcome: 'booked' as const, appointment: appointmentWithItems };
      }
      return appointmentWithItems;
    });
  }

  private async createWaitlistEntry(
    studioId: string,
    organizationId: string,
    dto: CreateAppointmentDto,
    primaryServiceId: string,
    requestedStartAt: Date,
    requestedEndAt: Date,
    source: WaitlistEntrySource,
  ) {
    return this.prisma.waitlistEntry.create({
      data: {
        id: generateId(IdPrefix.WaitlistEntry),
        studioId,
        organizationId,
        staffUserId: dto.staffUserId,
        clientId: dto.clientId,
        serviceId: primaryServiceId,
        requestedStartAt,
        requestedEndAt,
        status: WaitlistEntryStatus.PENDING,
        source,
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
  }

  /**
   * Лист ожидания по филиалу (журнал записей — отдельная вкладка на фронте).
   */
  async findWaitlistEntries(
    studioId: string,
    userRole?: string,
    userStudioId?: string,
    userStaffId?: string,
    options?: { date?: string; status?: WaitlistEntryStatus | 'all' },
  ) {
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userStudioId !== studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }
    }

    const where: Record<string, unknown> = { studioId };
    if (options?.status === 'all') {
      // без фильтра по статусу
    } else if (options?.status) {
      where.status = options.status;
    } else {
      where.status = WaitlistEntryStatus.PENDING;
    }

    if (options?.date) {
      const raw = options.date.includes('T')
        ? options.date.split('T')[0]
        : options.date;
      const dateStr = normalizeCalendarDateStr(raw);
      const studio = await this.prisma.studio.findUnique({
        where: { id: studioId },
        include: { organization: true },
      });
      const tz = studio
        ? studioWallClockTimezone(studio, studio.organization)
        : DEFAULT_IANA_TIMEZONE;
      const { dayStart, nextDayStart } = zonedDayRangeUtc(dateStr, tz);
      where.requestedStartAt = { gte: dayStart, lt: nextDayStart };
    }

    if (userRole === UserRole.MASTER && userStaffId) {
      where.staffUserId = userStaffId;
    }

    const rows = await this.prisma.waitlistEntry.findMany({
      where,
      include: {
        staff: { include: { staffProfile: true } },
        client: true,
        service: true,
      },
      orderBy: { requestedStartAt: 'asc' },
    });

    if (userRole === UserRole.MASTER) {
      return rows.map((r) => ({
        ...r,
        client: { ...r.client, phone: undefined },
      }));
    }
    return rows;
  }

  async cancelWaitlistEntry(
    studioId: string,
    entryId: string,
    userRole?: string,
    userStudioId?: string,
    userStaffId?: string,
  ) {
    const entry = await this.prisma.waitlistEntry.findFirst({
      where: { id: entryId, studioId },
    });
    if (!entry) {
      throw new NotFoundException('Waitlist entry not found');
    }
    if (entry.status !== WaitlistEntryStatus.PENDING) {
      throw new BadRequestException('Only PENDING waitlist entries can be cancelled');
    }

    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userStudioId !== studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }
      if (userRole === UserRole.MASTER && userStaffId && entry.staffUserId !== userStaffId) {
        throw new ForbiddenException('Masters can only cancel own waitlist entries');
      }
    }

    return this.prisma.waitlistEntry.update({
      where: { id: entryId },
      data: { status: WaitlistEntryStatus.CANCELLED },
      include: {
        staff: { include: { staffProfile: true } },
        client: true,
        service: true,
      },
    });
  }

  /**
   * Попытка перенести заявку из листа ожидания в реальную запись (тот же слот/услуга/мастер).
   */
  async convertWaitlistEntryToAppointment(
    studioId: string,
    entryId: string,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
  ) {
    const entry = await this.prisma.waitlistEntry.findFirst({
      where: { id: entryId, studioId },
    });
    if (!entry) {
      throw new NotFoundException('Waitlist entry not found');
    }
    if (entry.status !== WaitlistEntryStatus.PENDING) {
      throw new BadRequestException('Only PENDING waitlist entries can be converted');
    }

    const dto: CreateAppointmentDto = {
      staffUserId: entry.staffUserId,
      clientId: entry.clientId,
      serviceId: entry.serviceId,
      startAt: entry.requestedStartAt.toISOString(),
      preferWaitlist: false,
    };

    try {
      const created = await this.create(
        studioId,
        dto,
        userRole,
        userStudioId,
        userOrganizationId,
      );

      if (created && typeof created === 'object' && 'outcome' in created) {
        const wrapped = created as { outcome: 'booked' | 'waitlist'; appointment?: { id: string } };
        if (wrapped.outcome === 'waitlist') {
          throw new ConflictException(
            'Slot is still unavailable; waitlist entry remains pending',
            'WAITLIST_CONVERT_CONFLICT',
          );
        }
        const appt = wrapped.appointment;
        if (!appt?.id) {
          throw new BadRequestException('Unexpected create response');
        }
        await this.prisma.waitlistEntry.update({
          where: { id: entryId },
          data: {
            status: WaitlistEntryStatus.FULFILLED,
            fulfilledAppointmentId: appt.id,
          },
        });
        return wrapped.appointment;
      }

      const appt = created as { id: string };
      await this.prisma.waitlistEntry.update({
        where: { id: entryId },
        data: {
          status: WaitlistEntryStatus.FULFILLED,
          fulfilledAppointmentId: appt.id,
        },
      });
      return created;
    } catch (e) {
      if (e instanceof ConflictException) {
        throw new ConflictException(
          'Slot is still unavailable; waitlist entry remains pending',
          'WAITLIST_CONVERT_CONFLICT',
        );
      }
      throw e;
    }
  }

  async update(
    id: string,
    updateAppointmentDto: UpdateAppointmentDto,
    userRole?: string,
    userStudioId?: string,
    userStaffId?: string,
    userOrganizationId?: string,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        service: true,
        serviceItems: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    await assertUserOrganizationMatchesStudio(
      this.prisma,
      appointment.studioId,
      userOrganizationId,
      userRole,
    );

    // Check access
    // OWNER, DEPUTY_OWNER and MANAGER have access to all studios
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      // ADMIN and MASTER can only access their own studio
      if (userStudioId !== appointment.studioId) {
        throw new ForbiddenException('Access denied to this appointment');
      }
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

      const serviceIds =
        appointment.serviceItems.length > 0
          ? appointment.serviceItems
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((x) => x.serviceId)
          : [appointment.serviceId];
      const resolved = await this.resolveAppointmentServices(
        appointment.studioId,
        appointment.service.organizationId,
        appointment.staffUserId,
        serviceIds,
      );
      const durationMinutes = resolved.reduce((sum, s) => sum + s.durationMin, 0);

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

      /** Поздняя отмена (< 4 ч до начала): сгоревшая предоплата на записи → дашборд (forfeitedPrepaymentAmount). Без NoShowIncome — иначе двойной учёт в revenue. */
      let forfeitedToSet: number | undefined;
      const effectiveStart = updateAppointmentDto.startAt ? startAt : appointment.startAt;
      if (updateAppointmentDto.status === AppointmentStatus.CANCELLED) {
        if (appointment.status === AppointmentStatus.DONE) {
          throw new BadRequestException('Cannot cancel a completed appointment');
        }
        if (appointment.status === AppointmentStatus.CANCELLED) {
          throw new BadRequestException('Appointment is already cancelled');
        }
        const now = new Date();
        const hoursUntilStart =
          (new Date(effectiveStart).getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntilStart < 4) {
          const alreadyForfeited = (appointment.forfeitedPrepaymentAmount ?? 0) > 0;
          const appointmentServicesTotal =
            appointment.serviceItems.length > 0
              ? appointment.serviceItems.reduce((sum, item) => sum + (item.price ?? 0), 0)
              : (appointment.service.defaultPrice ?? 0);
          const amountToForfeit =
            appointment.prepaymentAmount ?? appointmentServicesTotal;
          if (amountToForfeit > 0 && !alreadyForfeited) {
            forfeitedToSet = amountToForfeit;
          }
        }
      }

      /**
       * Таймер удержания предварительной брони (holdExpiresAt) очищаем при переходе в любой стабильный
       * статус (PENDING_CONFIRMATION, BOOKED, DONE) или при финальной отмене — чтобы крон авто-освобождения
       * слотов не трогал запись после явного подтверждения/отмены менеджером или агентом.
       */
      const clearHoldStatuses: AppointmentStatus[] = [
        AppointmentStatus.PENDING_CONFIRMATION,
        AppointmentStatus.BOOKED,
        AppointmentStatus.DONE,
        AppointmentStatus.ARRIVED,
        AppointmentStatus.CANCELLED,
      ];
      const shouldClearHold =
        updateAppointmentDto.status !== undefined &&
        clearHoldStatuses.includes(updateAppointmentDto.status);

      const updated = await tx.appointment.update({
        where: { id },
        data: {
          startAt: updateAppointmentDto.startAt ? startAt : undefined,
          endAt: updateAppointmentDto.startAt ? endAt : undefined,
          prepaymentAmount: updateAppointmentDto.prepaymentAmount,
          status: updateAppointmentDto.status,
          ...(shouldClearHold ? { holdExpiresAt: null } : {}),
          ...(forfeitedToSet !== undefined ? { forfeitedPrepaymentAmount: forfeitedToSet } : {}),
        },
        include: {
          staff: {
            include: {
              staffProfile: true,
            },
          },
          client: true,
          service: true,
          serviceItems: {
            include: { service: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      // Hide client phone for MASTER role
      if (userRole === UserRole.MASTER) {
        return {
          ...updated,
          client: {
            ...updated.client,
            phone: undefined,
          },
        };
      }

      return updated;
    });
  }

  async markNoShow(id: string, userRole?: string, userStudioId?: string, userStaffId?: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        service: true,
        serviceItems: true,
        client: true,
        staff: {
          include: {
            staffProfile: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    // Check access
    // OWNER, DEPUTY_OWNER and MANAGER have access to all studios
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      // ADMIN and MASTER can only access their own studio
      if (userStudioId !== appointment.studioId) {
        throw new ForbiddenException('Access denied to this appointment');
      }
    }

    // MASTER can only mark their own appointments as no-show
    if (userRole === UserRole.MASTER && userStaffId !== appointment.staffUserId) {
      throw new ForbiddenException('Access denied to this appointment');
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Appointment is already cancelled');
    }

    if (appointment.status === AppointmentStatus.DONE) {
      throw new BadRequestException('Cannot mark completed appointment as no-show');
    }

    // Check if cancellation is late (less than 4 hours before start)
    // Если отмена происходит за менее чем 4 часа до начала (или запись уже началась/прошла),
    // то предоплата добавляется в доход
    const now = new Date();
    const startAt = new Date(appointment.startAt);
    const hoursUntilStart = (startAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isLateCancellation = hoursUntilStart < 4;

    // Use transaction to ensure data consistency
    return this.prisma.$transaction(async (tx) => {
      // If late cancellation (< 4 hours), add prepayment to income only if not already added (e.g. by "Опоздал")
      if (isLateCancellation) {
        const appointmentServicesTotal =
          appointment.serviceItems.length > 0
            ? appointment.serviceItems.reduce((sum, item) => sum + (item.price ?? 0), 0)
            : (appointment.service.defaultPrice ?? 0);
        const amountToAdd = appointment.prepaymentAmount ?? appointmentServicesTotal;
        const alreadyForfeited = (appointment.forfeitedPrepaymentAmount ?? 0) > 0;
        if (amountToAdd > 0 && !alreadyForfeited) {
          await tx.noShowIncome.create({
            data: {
              id: generateId(IdPrefix.NoShowIncome),
              studioId: appointment.studioId,
              staffUserId: appointment.staffUserId,
              clientId: appointment.clientId,
              serviceId: appointment.serviceId,
              amount: amountToAdd,
              originalStartAt: appointment.startAt,
              originalEndAt: appointment.endAt,
            },
          });
        }
      }

      // Delete the appointment
      await tx.appointment.delete({
        where: { id },
      });

      // Создать уведомление для менеджеров об отмене записи
      try {
        const clientName = `${appointment.client.firstName} ${appointment.client.lastName || ''}`.trim();
        const staffName = appointment.staff.staffProfile
          ? `${appointment.staff.staffProfile.firstName} ${appointment.staff.staffProfile.lastName || ''}`.trim()
          : 'Мастер';
        
        await this.notificationsService.createCancellationNotification(
          appointment.studioId,
          id,
          clientName,
          appointment.service.name,
          staffName,
          appointment.startAt,
        );
      } catch (error) {
        // Логируем ошибку, но не прерываем процесс отмены
        console.error('Failed to create cancellation notification:', error);
      }

      return { success: true, message: 'Appointment marked as no-show and deleted' };
    });
  }

  /**
   * Mark appointment as "late" (Опоздал): prepayment is added to income, appointment is kept.
   * Available only 15+ minutes after start if "Пришёл" was not pressed.
   * If "Не пришёл" is pressed later, prepayment is not added again.
   */
  async markLate(id: string, userRole?: string, userStudioId?: string, userStaffId?: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { service: true, serviceItems: true, client: true, staff: { include: { staffProfile: true } } },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userStudioId !== appointment.studioId) {
        throw new ForbiddenException('Access denied to this appointment');
      }
    }
    if (userRole === UserRole.MASTER && userStaffId !== appointment.staffUserId) {
      throw new ForbiddenException('Access denied to this appointment');
    }

    if (appointment.status !== AppointmentStatus.BOOKED) {
      throw new BadRequestException(
        'Can only mark as late an appointment that is still booked (not arrived, done, or cancelled)',
      );
    }

    const now = new Date();
    const startAt = new Date(appointment.startAt);
    const fifteenMinutesAfterStart = new Date(startAt.getTime() + 15 * 60 * 1000);
    if (now < fifteenMinutesAfterStart) {
      throw new BadRequestException(
        '"Опоздал" can only be used 15 minutes after the appointment start time',
      );
    }

    const appointmentServicesTotal =
      appointment.serviceItems.length > 0
        ? appointment.serviceItems.reduce((sum, item) => sum + (item.price ?? 0), 0)
        : (appointment.service.defaultPrice ?? 0);
    const amount = appointment.prepaymentAmount ?? appointmentServicesTotal;
    if (amount <= 0) {
      throw new BadRequestException('No prepayment to forfeit for this appointment');
    }

    if ((appointment.forfeitedPrepaymentAmount ?? 0) > 0) {
      throw new BadRequestException('Prepayment for this appointment was already forfeited (e.g. already marked as late)');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.noShowIncome.create({
        data: {
          id: generateId(IdPrefix.NoShowIncome),
          studioId: appointment.studioId,
          staffUserId: appointment.staffUserId,
          clientId: appointment.clientId,
          serviceId: appointment.serviceId,
          amount,
          originalStartAt: appointment.startAt,
          originalEndAt: appointment.endAt,
        },
      });
      await tx.appointment.update({
        where: { id },
        data: { forfeitedPrepaymentAmount: amount },
      });
    });

    return {
      success: true,
      message: 'Appointment marked as late; prepayment added to income, appointment kept',
    };
  }

  async markArrived(id: string, userId: string, userRole?: string, userStudioId?: string) {
    const existingAppointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!existingAppointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    // Check access
    // OWNER, DEPUTY_OWNER and MANAGER have access to all studios
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      // ADMIN and MASTER can only access their own studio
      if (userStudioId !== existingAppointment.studioId) {
        throw new ForbiddenException('Access denied to this appointment');
      }
    }

    if (existingAppointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Cannot mark cancelled appointment as arrived');
    }

    if (existingAppointment.status === AppointmentStatus.ARRIVED) {
      throw new BadRequestException('Appointment is already marked as arrived');
    }

    const appointment = await this.prisma.appointment.update({
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
        serviceItems: {
          include: { service: true },
          orderBy: { sortOrder: 'asc' },
        },
        arrivedByUser: {
          select: {
            id: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    // Hide client phone for MASTER role
    if (userRole === UserRole.MASTER) {
      return {
        ...appointment,
        client: {
          ...appointment.client,
          phone: undefined,
        },
      };
    }

    return appointment;
  }

  async markDone(
    id: string,
    userId: string,
    userRole?: string,
    userStudioId?: string,
    dto?: MarkAppointmentDoneDto,
  ) {
    const existingAppointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        client: true,
        service: true,
        serviceItems: {
          include: { service: true },
          orderBy: { sortOrder: 'asc' },
        },
        studio: { include: { organization: true } },
        upsells: true,
      },
    });

    if (!existingAppointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    // Check access
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userStudioId !== existingAppointment.studioId) {
        throw new ForbiddenException('Access denied to this appointment');
      }
    }

    if (existingAppointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Cannot mark cancelled appointment as done');
    }

    if (existingAppointment.status === AppointmentStatus.DONE) {
      throw new BadRequestException('Appointment is already marked as done');
    }

    const { client, service, serviceItems, studio, upsells } = existingAppointment;
    const org = studio.organization;
    const loyaltyEnabled = client.loyaltyEnabled !== false;
    const prepayment = existingAppointment.prepaymentAmount ?? 0;
    const primaryServices =
      serviceItems.length > 0
        ? serviceItems
        : [
            {
              serviceId: service.id,
              price: service.defaultPrice,
              service,
            } as any,
          ];
    const baseAmount = primaryServices.reduce((sum, item) => sum + (item.price ?? 0), 0);
    const hasAccrualEnabledPrimaryService = primaryServices.some(
      (item) => item.service?.bonusAccrualEnabled !== false,
    );
    const upsellsSum = upsells.reduce((s, u) => s + u.totalAmount, 0);
    const grossTotal = baseAmount + upsellsSum;

    const doneBefore = await this.prisma.appointment.count({
      where: { clientId: client.id, status: AppointmentStatus.DONE },
    });
    const referProgramOn = org.referFriendEnabled === true;
    const eligibleFirstVisitReferral =
      !!client.referredByClientId &&
      doneBefore === 0 &&
      !client.referralFirstVisitBonusCredited;
    const applyReferFriendRewards = loyaltyEnabled && referProgramOn && eligibleFirstVisitReferral;

    let total = grossTotal;
    if (
      applyReferFriendRewards &&
      org.referFriendInviteeRewardType === 'DISCOUNT_PERCENT' &&
      org.referFriendInviteeValue != null
    ) {
      const p = Math.min(100, Math.max(0, org.referFriendInviteeValue));
      total = Math.round((grossTotal * (100 - p)) / 100);
    }

    const limitPercent = org.globalBonusPaymentLimitPercent ?? 30;
    const maxBonusesAllowed = Math.floor((total * limitPercent) / 100);
    const requestedBonus = Math.max(0, dto?.bonusesUsed ?? 0);
    const bonusesUsed = loyaltyEnabled
      ? Math.min(
          requestedBonus,
          Math.max(0, client.bonuses),
          maxBonusesAllowed,
        )
      : 0;

    // Общая сумма, которую клиент оплачивает деньгами за визит (включая предоплату)
    const totalMoneyPaid = total - bonusesUsed;
    // Сколько клиент доплачивает при расчёте (на кассе сейчас)
    const moneyPaidNow = Math.max(0, totalMoneyPaid - prepayment);

    const useCustomLoyalty = org.loyaltyMode === 'CUSTOM';

    let cashbackPercent: number;
    let cashback: number;
    let newTotalPaidForLevel: number;
    let newLevel: string;
    let customLoyaltyUpsert: {
      newCslTotalPaid: number;
      newCurrentTierId: string | null;
      cslLevelSetManually: boolean;
    } | null = null;

    if (!loyaltyEnabled) {
      cashbackPercent = 0;
      cashback = 0;
      newTotalPaidForLevel = client.totalPaidForLevel;
      newLevel = client.level;
      customLoyaltyUpsert = null;
    } else if (useCustomLoyalty) {
      const [loyaltyTiers, loyaltyMilestones] = await Promise.all([
        this.prisma.studioLoyaltyTier.findMany({
          where: { organizationId: org.id },
          orderBy: { sortOrder: 'asc' },
        }),
        this.prisma.studioLoyaltyMilestone.findMany({
          where: { organizationId: org.id },
        }),
      ]);
      if (loyaltyTiers.length === 0 || loyaltyMilestones.length === 0) {
        throw new BadRequestException(
          'Студия в режиме CUSTOM-лояльности, но уровни не заданы. Настройте PUT /studios/:studioId/loyalty',
        );
      }
      const tierLikes = loyaltyTiers.map((ct) => ({
        id: ct.id,
        sortOrder: ct.sortOrder,
        name: ct.name,
        cashbackPercent: ct.cashbackPercent,
        manualOnly: ct.manualOnly,
      }));
      const milestoneLikes = loyaltyMilestones.map((m) => ({
        minTotalPaid: m.minTotalPaid,
        targetSortOrder: m.targetSortOrder,
      }));

      const cslRow = await this.prisma.clientStudioLoyalty.findUnique({
        where: {
          clientId_organizationId: { clientId: client.id, organizationId: org.id },
        },
        include: { currentTier: true },
      });
      const paidBefore = cslRow?.totalPaid ?? 0;
      const tierForCashback =
        cslRow?.levelSetManually && cslRow.currentTier
          ? cslRow.currentTier
          : resolveAutoTierForTotalPaid(tierLikes, milestoneLikes, paidBefore) ??
            resolveAutoTierForTotalPaid(tierLikes, milestoneLikes, 0);

      cashbackPercent = tierForCashback?.cashbackPercent ?? 0;
      cashback =
        hasAccrualEnabledPrimaryService && totalMoneyPaid > 0
          ? Math.round((totalMoneyPaid * cashbackPercent) / 100)
          : 0;
      newTotalPaidForLevel = client.totalPaidForLevel;
      newLevel = client.level;
      const newCslTotalPaid = paidBefore + totalMoneyPaid;
      const newAutoTier = cslRow?.levelSetManually
        ? null
        : resolveAutoTierForTotalPaid(tierLikes, milestoneLikes, newCslTotalPaid);
      const newCurrentTierId = cslRow?.levelSetManually
        ? cslRow.currentTierId
        : newAutoTier?.id ?? null;
      customLoyaltyUpsert = {
        newCslTotalPaid,
        newCurrentTierId,
        cslLevelSetManually: !!cslRow?.levelSetManually,
      };
    } else {
      cashbackPercent = getCashbackPercent(client.level);
      cashback =
        hasAccrualEnabledPrimaryService && totalMoneyPaid > 0
          ? Math.round((totalMoneyPaid * cashbackPercent) / 100)
          : 0;
      newTotalPaidForLevel = client.totalPaidForLevel + totalMoneyPaid;
      newLevel = client.levelSetManually
        ? client.level
        : getLevelFromTotalPaid(newTotalPaidForLevel);
    }

    let newBonuses = Math.max(0, client.bonuses - bonusesUsed + cashback);

    let inviteeReferralBonus = 0;
    if (
      loyaltyEnabled &&
      applyReferFriendRewards &&
      org.referFriendInviteeRewardType === 'BONUS_PERCENT' &&
      org.referFriendInviteeValue != null &&
      totalMoneyPaid > 0
    ) {
      const p = Math.min(100, Math.max(0, org.referFriendInviteeValue));
      inviteeReferralBonus = Math.round((totalMoneyPaid * p) / 100);
      newBonuses += inviteeReferralBonus;
    }

    let referralLinkCashback = 0;
    let referralLinkRowId: string | null = null;
    const marketingLinkId = client.studioReferralLinkId;
    if (loyaltyEnabled && marketingLinkId && totalMoneyPaid > 0 && hasAccrualEnabledPrimaryService) {
      const mLink = await this.prisma.studioReferralLink.findFirst({
        where: {
          id: marketingLinkId,
          organizationId: org.id,
          isActive: true,
          cashbackEnabled: true,
        },
      });
      if (mLink?.cashbackPercent != null && mLink.cashbackPercent > 0) {
        const p = Math.min(100, Math.max(0, mLink.cashbackPercent));
        referralLinkCashback = Math.round((totalMoneyPaid * p) / 100);
        if (referralLinkCashback > 0) {
          referralLinkRowId = mLink.id;
          newBonuses += referralLinkCashback;
        }
      }
    }

    // Пригласивший: из настроек студии (процент от оплаты или фикс)
    let referrer: { id: string; bonuses: number } | null = null;
    let referrerBonus = 0;
    if (loyaltyEnabled && applyReferFriendRewards && totalMoneyPaid > 0 && client.referredByClientId) {
      const ref = await this.prisma.client.findUnique({
        where: { id: client.referredByClientId },
        select: { id: true, bonuses: true },
      });
      if (ref && ref.id !== client.id) {
        referrer = ref;
        if (
          org.referFriendReferrerRewardType === 'PERCENT_OF_PAYMENT' &&
          org.referFriendReferrerValue != null
        ) {
          const p = Math.min(100, Math.max(0, org.referFriendReferrerValue));
          referrerBonus = Math.round((totalMoneyPaid * p) / 100);
        } else if (
          org.referFriendReferrerRewardType === 'FIXED_AMOUNT' &&
          org.referFriendReferrerValue != null
        ) {
          referrerBonus = Math.max(0, org.referFriendReferrerValue);
        }
      }
    }

    console.log('[markDone] Расчёт бонусов и кэшбэка', {
      appointmentId: id,
      clientId: client.id,
      serviceName: service.name,
      bonusAccrualEnabled: hasAccrualEnabledPrimaryService,
      math: {
        baseAmount: `${baseAmount} ₸`,
        upsellsSum: `${upsellsSum} ₸`,
        grossTotal: `${grossTotal} ₸`,
        referFriendProgramOn: referProgramOn,
        referralFirstVisitDiscount:
          applyReferFriendRewards && org.referFriendInviteeRewardType === 'DISCOUNT_PERCENT'
            ? `${org.referFriendInviteeValue}%`
            : '—',
        total: `${total} ₸`,
        prepayment: `${prepayment} ₸`,
        limitPercent: `${limitPercent}%`,
        maxBonusesAllowed,
        requestedBonus,
        clientBonusesBefore: client.bonuses,
        bonusesUsed,
        totalMoneyPaid: `${totalMoneyPaid} ₸`,
        moneyPaidNow: `${moneyPaidNow} ₸`,
        clientLevel: client.level,
        cashbackPercent: `${cashbackPercent}%`,
        cashbackFormula: `${totalMoneyPaid} × ${cashbackPercent}% = ${cashback} бонусов`,
        cashback,
        totalPaidForLevelBefore: client.totalPaidForLevel,
        totalPaidForLevelAdd: totalMoneyPaid,
        newTotalPaidForLevel,
        levelSetManually: client.levelSetManually,
        newLevel,
        loyaltyMode: org.loyaltyMode,
        loyaltyEnabled,
        customLoyalty: customLoyaltyUpsert,
        bonusesAfter: `${client.bonuses} - ${bonusesUsed} + ${cashback} = ${newBonuses}`,
      },
    });

    const appointment = await this.prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id },
        data: {
          status: AppointmentStatus.DONE,
          completedBonusesUsed: bonusesUsed,
          completedMoneyPaid: totalMoneyPaid,
        },
      });

      if (useCustomLoyalty && customLoyaltyUpsert) {
        await tx.clientStudioLoyalty.upsert({
          where: {
            clientId_organizationId: { clientId: client.id, organizationId: org.id },
          },
          create: {
            id: generateId(IdPrefix.ClientStudioLoyalty),
            clientId: client.id,
            organizationId: org.id,
            totalPaid: customLoyaltyUpsert.newCslTotalPaid,
            levelSetManually: customLoyaltyUpsert.cslLevelSetManually,
            currentTierId: customLoyaltyUpsert.newCurrentTierId,
          },
          update: {
            totalPaid: customLoyaltyUpsert.newCslTotalPaid,
            ...(customLoyaltyUpsert.cslLevelSetManually
              ? {}
              : { currentTierId: customLoyaltyUpsert.newCurrentTierId }),
          },
        });
        const presetData: {
          bonuses: number;
          referralFirstVisitBonusCredited?: boolean;
        } = { bonuses: newBonuses };
        if (eligibleFirstVisitReferral) {
          presetData.referralFirstVisitBonusCredited = true;
        }
        await tx.client.update({
          where: { id: client.id },
          data: presetData,
        });
      } else {
        const updateData: {
          bonuses: number;
          totalPaidForLevel: number;
          level?: ClientLevel;
          referralFirstVisitBonusCredited?: boolean;
        } = {
          bonuses: newBonuses,
          totalPaidForLevel: newTotalPaidForLevel,
        };
        if (!client.levelSetManually) {
          updateData.level = newLevel as ClientLevel;
        }
        if (eligibleFirstVisitReferral) {
          updateData.referralFirstVisitBonusCredited = true;
        }
        await tx.client.update({
          where: { id: client.id },
          data: updateData,
        });
      }

      if (referrer && referrerBonus > 0) {
        await tx.client.update({
          where: { id: referrer.id },
          data: { bonuses: referrer.bonuses + referrerBonus },
        });
        await tx.bonusHistoryEntry.create({
          data: {
            id: generateId(IdPrefix.BonusHistoryEntry),
            clientId: referrer.id,
            organizationId: org.id,
            amount: referrerBonus,
            type: 'REFERRAL_REFERRER',
            appointmentId: id,
            comment:
              org.referFriendReferrerRewardType === 'PERCENT_OF_PAYMENT'
                ? `Вознаграждение «приведи друга»: ${org.referFriendReferrerValue}% от оплаты деньгами приглашённого`
                : `Вознаграждение «приведи друга»: фикс ${org.referFriendReferrerValue} (после завершения записи)`,
          },
        });
      }

      if (inviteeReferralBonus > 0) {
        await tx.bonusHistoryEntry.create({
          data: {
            id: generateId(IdPrefix.BonusHistoryEntry),
            clientId: client.id,
            organizationId: org.id,
            amount: inviteeReferralBonus,
            type: 'REFERRAL_NEW_CLIENT',
            appointmentId: id,
            comment: `Бонус «приведи друга» приглашённому: ${org.referFriendInviteeValue}% от оплаты деньгами`,
          },
        });
      }

      if (bonusesUsed > 0) {
        await tx.bonusHistoryEntry.create({
          data: {
            id: generateId(IdPrefix.BonusHistoryEntry),
            clientId: client.id,
            organizationId: org.id,
            amount: -bonusesUsed,
            type: 'PAYMENT_USE',
            appointmentId: id,
          },
        });
      }
      if (cashback > 0) {
        await tx.bonusHistoryEntry.create({
          data: {
            id: generateId(IdPrefix.BonusHistoryEntry),
            clientId: client.id,
            organizationId: org.id,
            amount: cashback,
            type: 'CASHBACK',
            appointmentId: id,
          },
        });
      }

      if (referralLinkCashback > 0 && referralLinkRowId) {
        await tx.studioReferralLink.update({
          where: { id: referralLinkRowId },
          data: {
            totalCashbackAccumulated: { increment: referralLinkCashback },
          },
        });
        await tx.bonusHistoryEntry.create({
          data: {
            id: generateId(IdPrefix.BonusHistoryEntry),
            clientId: client.id,
            organizationId: org.id,
            amount: referralLinkCashback,
            type: 'REFERRAL_LINK_CASHBACK',
            appointmentId: id,
            comment: 'Кэшбэк по маркетинговой реферальной ссылке',
          },
        });
      }

      return tx.appointment.findUniqueOrThrow({
        where: { id },
        include: {
          staff: {
            include: {
              staffProfile: true,
            },
          },
          client: true,
          service: true,
          serviceItems: {
            include: { service: true },
            orderBy: { sortOrder: 'asc' },
          },
          arrivedByUser: {
            select: {
              id: true,
              email: true,
              phone: true,
            },
          },
        },
      });
    });

    if (userRole === UserRole.MASTER) {
      return {
        ...appointment,
        client: {
          ...appointment.client,
          phone: undefined,
        },
      };
    }

    return appointment;
  }
}




