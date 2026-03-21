import { Injectable } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { StudiosService } from '../studios/studios.service';
import { ClientsService } from '../clients/clients.service';
import { ServicesService } from '../services/services.service';
import { LandingService } from '../landing/landing.service';
import { ScheduleService } from '../schedule/schedule.service';
import { BusySlotsService } from '../busy-slots/busy-slots.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { PromptsService } from '../prompts/prompts.service';
import { CreateClientDto } from '../clients/dto/create-client.dto';
import { CreateAppointmentDto } from '../appointments/dto/create-appointment.dto';
import { UpdateAppointmentDto } from '../appointments/dto/update-appointment.dto';
import { NextbotSurveyDto } from './dto/nextbot-survey.dto';
import { CurrentUserPayload } from '../common/decorators/current-user.decorator';

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
    private readonly promptsService: PromptsService,
  ) {}

  getCompanyContext(user: CurrentUserPayload) {
    return this.studiosService.findAll(user.role, user.studioId);
  }

  getStudioDetails(studioId: string, user: CurrentUserPayload) {
    return this.studiosService.findOne(studioId, user.role, user.studioId);
  }

  /**
   * Поиск клиента по q + полный профиль (как verify_client_status в nextbot/).
   */
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
    const profile = await this.clientsService.findOne(
      list[0].id,
      user.role,
      user.studioId,
    );
    return { found: true, client: profile };
  }

  /** Обёртка как в check_loyalty_status.py */
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
    return {
      found: true,
      clientId: c['id'],
      level: c['level'] ?? null,
      bonuses: c['bonuses'] ?? null,
      discount: c['discount'] ?? null,
      rawClient: status.client,
    };
  }

  /** Обёртка как в get_referral_code.py */
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

  registerClient(
    studioId: string,
    dto: CreateClientDto,
    user: CurrentUserPayload,
  ) {
    return this.clientsService.create(studioId, dto, user.role, user.studioId);
  }

  /**
   * Сохранение анкеты в notes (как process_survey_answers.py).
   */
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

  getClientProfile(clientId: string, user: CurrentUserPayload) {
    return this.clientsService.findOne(clientId, user.role, user.studioId);
  }

  listClientAppointments(
    clientId: string,
    upcoming: boolean,
    user: CurrentUserPayload,
  ) {
    return this.clientsService.getClientAppointments(
      clientId,
      upcoming,
      user.role,
      user.studioId,
    );
  }

  getServices(studioId: string, user: CurrentUserPayload) {
    return this.servicesService.findAll(studioId, user.role, user.studioId);
  }

  getPromotions(studioId: string) {
    return this.landingService.getPromotions(studioId);
  }

  /**
   * Сырые данные для слотов (как check_availability.py): schedule + busy + appointments.
   */
  async availabilityRaw(
    studioId: string,
    date: string,
    staffUserId: string | undefined,
    user: CurrentUserPayload,
  ) {
    const [scheduleDays, busySlots, appointments] = await Promise.all([
      this.scheduleService.findAll(studioId, date, user.role, user.studioId),
      this.busySlotsService.findAll(
        studioId,
        date,
        user.role,
        user.studioId,
        user.userId,
      ),
      this.appointmentsService.findAll(
        studioId,
        date,
        user.role,
        user.studioId,
        user.userId,
      ),
    ]);

    return {
      scheduleDays,
      busySlots,
      appointments,
      staffUserIdHint: staffUserId ?? null,
    };
  }

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

  updateAppointment(
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

  cancelAppointment(id: string, user: CurrentUserPayload) {
    return this.appointmentsService.update(
      id,
      { status: AppointmentStatus.CANCELLED },
      user.role,
      user.studioId,
      user.userId,
    );
  }

  listPrompts() {
    return this.promptsService.findAll();
  }

  getPrompt(id: string) {
    return this.promptsService.findOne(id);
  }
}
