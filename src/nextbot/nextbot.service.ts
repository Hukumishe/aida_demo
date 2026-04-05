import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { StudiosService } from '../studios/studios.service';
import { ClientsService } from '../clients/clients.service';
import { ServicesService } from '../services/services.service';
import { LandingService } from '../landing/landing.service';
import { ScheduleService } from '../schedule/schedule.service';
import { BusySlotsService } from '../busy-slots/busy-slots.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { CreateClientDto } from '../clients/dto/create-client.dto';
import { CreateAppointmentDto } from '../appointments/dto/create-appointment.dto';
import { UpdateAppointmentDto } from '../appointments/dto/update-appointment.dto';
import { NextbotSurveyDto } from './dto/nextbot-survey.dto';
import { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { AvailabilityService } from '../availability/availability.service';
import { UserRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';

/** Имена функций из системного промпта xmind (aida_xmind.pdf). */
export type NextbotXmindFunction =
  | 'add_to_waitlist'
  | 'request_manager_invoice'
  | 'generate_payment_link'
  | 'verify_receipt_nighttime'
  | 'purchase_certificate'
  | 'validate_certificate_code'
  | 'create_escalation_ticket'
  | 'dev_error_report'
  | 'process_survey_answers_failed';

@Injectable()
export class NextbotService {
  constructor(
    private readonly studiosService: StudiosService,
    private readonly clientsService: ClientsService,
    private readonly servicesService: ServicesService,
    private readonly landingService: LandingService,
    private readonly scheduleService: ScheduleService,
    private readonly busySlotsService: BusySlotsService,
    private readonly appointmentsService: AppointmentsService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  /** Заглушка: функция из xmind, в CRM ещё нет реализации. */
  notImplemented(fn: NextbotXmindFunction): never {
    throw new HttpException(
      {
        function: fn,
        code: 'NOT_IMPLEMENTED',
        message:
          'Эндпоинт зарезервирован под сценарий xmind; логика в backend ещё не реализована.',
      },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  /** get_company_context */
  getCompanyContext(user: CurrentUserPayload) {
    return this.studiosService.findAll(user.role, user.studioId, user.organizationId);
  }

  /** verify_client_status */
  async verifyClient(studioId: string, q: string | undefined, user: CurrentUserPayload) {
    const list = await this.clientsService.findAll(
      studioId,
      q,
      user.role,
      user.studioId,
    );
    if (!list.length) {
      return { found: false, client: null as null };
    }
    const profile = await this.clientsService.findOne(list[0].id, user.role, user.studioId);
    return { found: true, client: profile };
  }

  /** check_loyalty_status */
  async loyaltySummary(studioId: string, q: string | undefined, user: CurrentUserPayload) {
    const status = await this.verifyClient(studioId, q, user);
    if (!status.found || !status.client) {
      return {
        found: false,
        clientId: null,
        level: null,
        bonuses: null,
        discount: null,
        rawClient: null,
      };
    }
    const c = status.client as Record<string, unknown>;
    const ol = c['organizationLoyalty'] as { currentTier?: { name?: string } } | null | undefined;
    const slLegacy = c['studioLoyalty'] as { currentTier?: { name?: string } } | null | undefined;
    const loyaltyTierName = ol?.currentTier?.name ?? slLegacy?.currentTier?.name ?? null;
    return {
      found: true,
      clientId: c['id'],
      level: c['level'] ?? null,
      loyaltyTierName,
      bonuses: c['bonuses'] ?? null,
      discount: c['discount'] ?? null,
      rawClient: status.client,
    };
  }

  /** get_referral_code */
  async referralSummary(studioId: string, q: string | undefined, user: CurrentUserPayload) {
    const status = await this.verifyClient(studioId, q, user);
    if (!status.found || !status.client) {
      return { found: false, clientId: null, referralCode: null, rawClient: null };
    }
    const c = status.client as Record<string, unknown>;
    return {
      found: true,
      clientId: c['id'],
      referralCode: c['referralCode'] ?? null,
      rawClient: status.client,
    };
  }

  /** register_new_client */
  registerClient(
    studioId: string,
    dto: CreateClientDto,
    user: CurrentUserPayload,
  ) {
    return this.clientsService.create(studioId, dto, user.role, user.studioId);
  }

  /** process_survey_answers */
  async processSurvey(
    clientId: string,
    dto: NextbotSurveyDto,
    user: CurrentUserPayload,
  ) {
    const prefix = dto.surveyPrefix ?? '[NEXTBOT_SURVEY]';
    const block = `${prefix} ${JSON.stringify(dto.answers)}`;
    let newNotes = block;

    if (dto.mergeIntoNotes !== false) {
      const existing = await this.clientsService.findOne(
        clientId,
        user.role,
        user.studioId,
      );
      const old = ((existing as { notes?: string | null }).notes ?? '').trim();
      newNotes = old ? `${old}\n\n${block}`.trim() : block;
    }

    return this.clientsService.update(
      clientId,
      { notes: newNotes },
      user.role,
      user.studioId,
    );
  }

  /** get_services_and_prices */
  getServices(studioId: string, user: CurrentUserPayload) {
    return this.servicesService.findAll(studioId, user.role, user.studioId);
  }

  /** get_active_promotions */
  getPromotions(studioId: string) {
    return this.landingService.getPromotions(studioId);
  }

  /**
   * check_availability — только свободные слоты + текст промпта для ИИ (`check_availability`).
   * Сырые расписания/записи не отдаются.
   */
  async availabilityRaw(
    studioId: string,
    date: string,
    staffUserId: string | undefined,
    user: CurrentUserPayload,
    options?: {
      serviceId?: string;
      durationMinutes?: number;
      slotStepMinutes?: number;
    },
  ) {
    if (
      !isOwnerLevelRole(user.role) &&
      user.role !== UserRole.MANAGER &&
      user.studioId !== studioId
    ) {
      throw new HttpException('Access denied to this studio', HttpStatus.FORBIDDEN);
    }
    if (user.role === UserRole.MASTER && staffUserId && staffUserId !== user.userId) {
      throw new HttpException('MASTER can only query own availability', HttpStatus.FORBIDDEN);
    }
    const effectiveStaffId =
      user.role === UserRole.MASTER ? user.userId : staffUserId;

    return this.availabilityService.computeNextbotFreeSlots(studioId, date, {
      staffUserId: effectiveStaffId ?? undefined,
      serviceId: options?.serviceId,
      durationMinutes: options?.durationMinutes,
      slotStepMinutes: options?.slotStepMinutes,
    });
  }

  /** create_booking_request */
  createAppointment(
    studioId: string,
    dto: CreateAppointmentDto,
    user: CurrentUserPayload,
  ) {
    return this.appointmentsService.create(
      studioId,
      dto,
      user.role,
      user.studioId,
    );
  }

  /**
   * modify_booking (в т.ч. перенос и отмена: `status: CANCELLED` в теле).
   * В xmind отмена/перенос не выделены отдельными функциями.
   */
  modifyBooking(
    id: string,
    dto: UpdateAppointmentDto,
    user: CurrentUserPayload,
  ) {
    return this.appointmentsService.update(
      id,
      dto,
      user.role,
      user.studioId,
      user.userId,
    );
  }
}
