import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { StudiosService } from '../studios/studios.service';
import { ClientsService } from '../clients/clients.service';
import { ServicesService } from '../services/services.service';
import { LandingService } from '../landing/landing.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { CreateClientDto } from '../clients/dto/create-client.dto';
import { CreateAppointmentDto } from '../appointments/dto/create-appointment.dto';
import { UpdateAppointmentDto } from '../appointments/dto/update-appointment.dto';
import { NextbotSurveyDto } from './dto/nextbot-survey.dto';
import { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import {
  AvailabilityService,
  NEXTBOT_CHECK_AVAILABILITY_PROMPT,
} from '../availability/availability.service';
import { UserRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';
import { PromptsService } from '../prompts/prompts.service';

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
    private readonly appointmentsService: AppointmentsService,
    private readonly availabilityService: AvailabilityService,
    private readonly promptsService: PromptsService,
  ) {}

  /**
   * Добавляет в ответ текст промпта с портала (таблица prompts) под ключом имени функции xmind.
   * Приоритет: промпт организации → глобальный (organizationId null) → fallback.
   */
  private async withNextbotPrompt<T extends Record<string, unknown>>(
    organizationId: string | undefined,
    functionKey: string,
    data: T,
    fallback?: string,
  ): Promise<T & Record<string, string>> {
    let text = fallback ?? '';
    if (organizationId?.trim()) {
      const custom = await this.promptsService.getDescriptionForOrganization(
        organizationId.trim(),
        functionKey,
      );
      if (custom != null && custom.trim() !== '') {
        text = custom;
      } else if (fallback !== undefined) {
        text = fallback;
      }
    } else if (fallback !== undefined) {
      text = fallback;
    }
    return { ...data, [functionKey]: text } as T & Record<string, string>;
  }

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

  /** get_company_context — явный слой организации + список филиалов (у каждой студии своё organizationId в полях Prisma). */
  async getCompanyContext(user: CurrentUserPayload) {
    const studios = await this.studiosService.findAll(
      user.role,
      user.studioId,
      user.organizationId,
    );
    return this.withNextbotPrompt(user.organizationId, 'get_company_context', {
      organizationId: user.organizationId,
      studios,
    });
  }

  /** Без промпта — общая логика для verify / loyalty / referral. */
  private async resolveClientProfile(q: string | undefined, user: CurrentUserPayload) {
    const list = await this.clientsService.findAll(
      q,
      user.role,
      user.organizationId,
    );
    if (!list.length) {
      return null;
    }
    return this.clientsService.findOne(
      list[0].id,
      user.role,
      user.studioId,
      user.organizationId,
    );
  }

  /** verify_client_status */
  async verifyClient(q: string | undefined, user: CurrentUserPayload) {
    const profile = await this.resolveClientProfile(q, user);
    if (!profile) {
      return this.withNextbotPrompt(user.organizationId, 'verify_client_status', {
        found: false,
        client: null as unknown as null,
      });
    }
    return this.withNextbotPrompt(user.organizationId, 'verify_client_status', {
      found: true,
      client: profile as unknown as Record<string, unknown>,
    });
  }

  /** check_loyalty_status */
  async loyaltySummary(q: string | undefined, user: CurrentUserPayload) {
    const profile = await this.resolveClientProfile(q, user);
    if (!profile) {
      return this.withNextbotPrompt(user.organizationId, 'check_loyalty_status', {
        found: false,
        clientId: null,
        level: null,
        bonuses: null,
        discount: null,
        rawClient: null,
      });
    }
    const c = profile as Record<string, unknown>;
    const ol = c['organizationLoyalty'] as { currentTier?: { name?: string } } | null | undefined;
    const slLegacy = c['studioLoyalty'] as { currentTier?: { name?: string } } | null | undefined;
    const loyaltyTierName = ol?.currentTier?.name ?? slLegacy?.currentTier?.name ?? null;
    return this.withNextbotPrompt(user.organizationId, 'check_loyalty_status', {
      found: true,
      clientId: c['id'],
      level: c['level'] ?? null,
      loyaltyTierName,
      bonuses: c['bonuses'] ?? null,
      discount: c['discount'] ?? null,
      rawClient: profile,
    });
  }

  /** get_referral_code */
  async referralSummary(q: string | undefined, user: CurrentUserPayload) {
    const profile = await this.resolveClientProfile(q, user);
    if (!profile) {
      return this.withNextbotPrompt(user.organizationId, 'get_referral_code', {
        found: false,
        clientId: null,
        referralCode: null,
        rawClient: null,
      });
    }
    const c = profile as Record<string, unknown>;
    return this.withNextbotPrompt(user.organizationId, 'get_referral_code', {
      found: true,
      clientId: c['id'],
      referralCode: c['referralCode'] ?? null,
      rawClient: profile,
    });
  }

  /** register_new_client */
  async registerClient(dto: CreateClientDto, user: CurrentUserPayload) {
    const created = await this.clientsService.create(
      dto,
      user.role,
      user.studioId,
      user.organizationId,
    );
    return this.withNextbotPrompt(
      user.organizationId,
      'register_new_client',
      created as unknown as Record<string, unknown>,
    );
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
        user.organizationId,
      );
      const old = ((existing as { notes?: string | null }).notes ?? '').trim();
      newNotes = old ? `${old}\n\n${block}`.trim() : block;
    }

    const updated = await this.clientsService.update(
      clientId,
      { notes: newNotes },
      user.role,
      user.studioId,
      user.organizationId,
    );
    return this.withNextbotPrompt(
      user.organizationId,
      'process_survey_answers',
      updated as unknown as Record<string, unknown>,
    );
  }

  /** get_services_and_prices */
  async getServices(studioId: string, user: CurrentUserPayload) {
    const data = await this.servicesService.findAll(
      user.role,
      user.studioId,
      user.organizationId,
      undefined,
      studioId,
    );
    return this.withNextbotPrompt(user.organizationId, 'get_services_and_prices', {
      data,
    });
  }

  /** get_active_promotions */
  async getPromotions(studioId: string, user: CurrentUserPayload) {
    const data = await this.landingService.getPromotions(
      studioId,
      user.organizationId,
      user.role,
    );
    return this.withNextbotPrompt(user.organizationId, 'get_active_promotions', { data });
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

    const slots = await this.availabilityService.computeNextbotFreeSlots(studioId, date, {
      staffUserId: effectiveStaffId ?? undefined,
      serviceId: options?.serviceId,
      durationMinutes: options?.durationMinutes,
      slotStepMinutes: options?.slotStepMinutes,
    });
    return this.withNextbotPrompt(
      user.organizationId,
      'check_availability',
      slots as unknown as Record<string, unknown>,
      NEXTBOT_CHECK_AVAILABILITY_PROMPT,
    );
  }

  /** create_booking_request */
  async createAppointment(
    studioId: string,
    dto: CreateAppointmentDto,
    user: CurrentUserPayload,
  ) {
    const created = await this.appointmentsService.create(
      studioId,
      dto,
      user.role,
      user.studioId,
      user.organizationId,
    );
    return this.withNextbotPrompt(
      user.organizationId,
      'create_booking_request',
      created as unknown as Record<string, unknown>,
    );
  }

  /**
   * modify_booking (в т.ч. перенос и отмена: `status: CANCELLED` в теле).
   * В xmind отмена/перенос не выделены отдельными функциями.
   */
  async modifyBooking(
    id: string,
    dto: UpdateAppointmentDto,
    user: CurrentUserPayload,
  ) {
    const updated = await this.appointmentsService.update(
      id,
      dto,
      user.role,
      user.studioId,
      user.userId,
      user.organizationId,
    );
    return this.withNextbotPrompt(
      user.organizationId,
      'modify_booking',
      updated as unknown as Record<string, unknown>,
    );
  }
}
