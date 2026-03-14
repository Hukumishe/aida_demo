import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
import { AvailabilityService } from '../availability/availability.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppointmentStatus, ClientLevel } from '@prisma/client';

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
      // Normalize date: interpret the date string as a date in Asia/Almaty timezone
      // Date should come in YYYY-MM-DD format
      const dateStr = date.includes('T') ? date.split('T')[0] : date;
      const dateStart = new Date(dateStr + 'T00:00:00+06:00'); // Start of day in Almaty
      const dateEnd = new Date(dateStr + 'T23:59:59.999+06:00'); // End of day in Almaty

      where.startAt = {
        gte: dateStart,
        lte: dateEnd,
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

    if (!client) {
      throw new NotFoundException('Client not found');
    }
    if (client.isBlacklisted) {
      throw new BadRequestException('Cannot create appointment for a blacklisted client');
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

      const appointment = await tx.appointment.create({
        data: {
          id: generateId(IdPrefix.Appointment),
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
          appointment.service.name,
          startAt,
        );
      } catch (error) {
        // Логируем ошибку, но не прерываем создание записи
        console.error('Failed to create notification:', error);
      }

      return appointment;
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

      const updated = await tx.appointment.update({
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
        const amountToAdd = appointment.prepaymentAmount ?? appointment.service.defaultPrice ?? 0;
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
      include: { service: true, client: true, staff: { include: { staffProfile: true } } },
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

    const amount = appointment.prepaymentAmount ?? appointment.service.defaultPrice ?? 0;
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
        studio: true,
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

    const { client, service, studio, upsells } = existingAppointment;
    const prepayment = existingAppointment.prepaymentAmount ?? 0;
    const baseAmount = service.defaultPrice ?? 0;
    const upsellsSum = upsells.reduce((s, u) => s + u.totalAmount, 0);
    const total = baseAmount + upsellsSum;

    const limitPercent = studio.globalBonusPaymentLimitPercent ?? 30;
    const maxBonusesAllowed = Math.floor((total * limitPercent) / 100);
    const requestedBonus = Math.max(0, dto?.bonusesUsed ?? 0);
    const bonusesUsed = Math.min(
      requestedBonus,
      Math.max(0, client.bonuses),
      maxBonusesAllowed,
    );

    // Общая сумма, которую клиент оплачивает деньгами за визит (включая предоплату)
    const totalMoneyPaid = total - bonusesUsed;
    // Сколько клиент доплачивает при расчёте (на кассе сейчас)
    const moneyPaidNow = Math.max(0, totalMoneyPaid - prepayment);

    const cashbackPercent = getCashbackPercent(client.level);
    const cashback =
      service.bonusAccrualEnabled && totalMoneyPaid > 0
        ? Math.round((totalMoneyPaid * cashbackPercent) / 100)
        : 0;
    let newBonuses = Math.max(0, client.bonuses - bonusesUsed + cashback);
    const newTotalPaidForLevel = client.totalPaidForLevel + totalMoneyPaid;
    const newLevel = client.levelSetManually
      ? client.level
      : getLevelFromTotalPaid(newTotalPaidForLevel);

    // Реферальная программа: только на первую запись в системе; 10% пригласившему, 20% новому клиенту
    let referrer: { id: string; bonuses: number } | null = null;
    let referrerBonus = 0;
    let newClientReferralBonus = 0;
    const referralCodeRaw = dto?.referralCode?.trim();
    if (referralCodeRaw && totalMoneyPaid > 0) {
      const clientAppointmentsCount = await this.prisma.appointment.count({
        where: { clientId: client.id },
      });
      if (clientAppointmentsCount > 1) {
        throw new BadRequestException(
          'Реферальный код можно использовать только при первой записи в системе',
        );
      }
      if (!(client as any).referralFirstVisitBonusCredited) {
      const ref = await this.prisma.client.findUnique({
        where: { referralCode: referralCodeRaw.toUpperCase() },
        select: { id: true, bonuses: true },
      });
        if (ref && ref.id !== client.id) {
          referrer = ref;
          referrerBonus = Math.round((totalMoneyPaid * 10) / 100);
          newClientReferralBonus = Math.round((totalMoneyPaid * 20) / 100);
          newBonuses += newClientReferralBonus;
        } else {
          throw new BadRequestException(
            'Неверный реферальный код или нельзя использовать свой код',
          );
        }
      }
    }

    console.log('[markDone] Расчёт бонусов и кэшбэка', {
      appointmentId: id,
      clientId: client.id,
      serviceName: service.name,
      bonusAccrualEnabled: service.bonusAccrualEnabled,
      math: {
        baseAmount: `${baseAmount} ₸`,
        upsellsSum: `${upsellsSum} ₸`,
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

      const updateData: {
        bonuses: number;
        totalPaidForLevel: number;
        level?: ClientLevel;
        referredByClientId?: string;
        referralFirstVisitBonusCredited?: boolean;
      } = {
        bonuses: newBonuses,
        totalPaidForLevel: newTotalPaidForLevel,
      };
      if (!client.levelSetManually) {
        updateData.level = newLevel as ClientLevel;
      }
      if (referrer) {
        updateData.referredByClientId = referrer.id;
        updateData.referralFirstVisitBonusCredited = true;
      }
      await tx.client.update({
        where: { id: client.id },
        data: updateData,
      });

      if (referrer) {
        await tx.client.update({
          where: { id: referrer.id },
          data: { bonuses: referrer.bonuses + referrerBonus },
        });
        await tx.bonusHistoryEntry.create({
          data: {
            id: generateId(IdPrefix.BonusHistoryEntry),
            clientId: referrer.id,
            studioId: studio.id,
            amount: referrerBonus,
            type: 'REFERRAL_REFERRER',
            appointmentId: id,
            comment: '10% от чека приведённой подруги',
          },
        });
        await tx.bonusHistoryEntry.create({
          data: {
            id: generateId(IdPrefix.BonusHistoryEntry),
            clientId: client.id,
            studioId: studio.id,
            amount: newClientReferralBonus,
            type: 'REFERRAL_NEW_CLIENT',
            appointmentId: id,
            comment: '20% за первый визит по реферальному коду',
          },
        });
      }

      if (bonusesUsed > 0) {
        await tx.bonusHistoryEntry.create({
          data: {
            id: generateId(IdPrefix.BonusHistoryEntry),
            clientId: client.id,
            studioId: studio.id,
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
            studioId: studio.id,
            amount: cashback,
            type: 'CASHBACK',
            appointmentId: id,
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




