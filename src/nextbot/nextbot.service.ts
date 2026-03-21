import { Injectable, BadRequestException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { StudiosService } from '../studios/studios.service';
import { ClientsService } from '../clients/clients.service';
import { ServicesService } from '../services/services.service';
import { ScheduleService } from '../schedule/schedule.service';
import { BusySlotsService } from '../busy-slots/busy-slots.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { LandingService } from '../landing/landing.service';
import { CreateClientDto } from '../clients/dto/create-client.dto';
import { UpdateClientDto } from '../clients/dto/update-client.dto';
import { CreateAppointmentDto } from '../appointments/dto/create-appointment.dto';
import { UpdateAppointmentDto } from '../appointments/dto/update-appointment.dto';
import { NextbotSurveyDto } from './dto/nextbot-survey.dto';

@Injectable()
export class NextbotService {
  constructor(
    private readonly studiosService: StudiosService,
    private readonly clientsService: ClientsService,
    private readonly servicesService: ServicesService,
    private readonly scheduleService: ScheduleService,
    private readonly busySlotsService: BusySlotsService,
    private readonly appointmentsService: AppointmentsService,
    private readonly landingService: LandingService,
  ) {}

  async getContext(user: any, currentStudioId?: string) {
    const studios = await this.studiosService.findAll(user.role, user.studioId);
    const currentStudio =
      currentStudioId && studios.length
        ? studios.find((s: { id: string }) => s.id === currentStudioId) ?? null
        : null;
    return { studios, currentStudio };
  }

  getStudio(studioId: string, user: any) {
    return this.studiosService.findOne(studioId, user.role, user.studioId);
  }

  async lookupClient(studioId: string, q: string | undefined, user: any) {
    if (!q?.trim()) {
      throw new BadRequestException('Query parameter q is required');
    }
    const list = await this.clientsService.findAll(studioId, q, user.role, user.studioId);
    if (!list.length) {
      return { found: false, client: null as null };
    }
    const full = await this.clientsService.findOne(list[0].id, user.role, user.studioId);
    return { found: true, client: full };
  }

  async loyaltyStatus(studioId: string, q: string | undefined, user: any) {
    const res = await this.lookupClient(studioId, q, user);
    if (!res.found || !res.client) {
      return {
        found: false,
        clientId: null,
        level: null,
        bonuses: null,
        discount: null,
        rawClient: null,
      };
    }
    const c = res.client as Record<string, unknown>;
    return {
      found: true,
      clientId: c.id,
      level: c.level ?? null,
      bonuses: c.bonuses ?? null,
      discount: c.discount ?? null,
      rawClient: c,
    };
  }

  async referralInfo(studioId: string, q: string | undefined, user: any) {
    const res = await this.lookupClient(studioId, q, user);
    if (!res.found || !res.client) {
      return { found: false, clientId: null, referralCode: null, rawClient: null };
    }
    const c = res.client as Record<string, unknown>;
    return {
      found: true,
      clientId: c.id,
      referralCode: c.referralCode ?? null,
      rawClient: c,
    };
  }

  registerClient(
    studioId: string,
    dto: CreateClientDto,
    user: any,
  ) {
    return this.clientsService.create(studioId, dto, user.role, user.studioId);
  }

  getClientProfile(clientId: string, user: any) {
    return this.clientsService.findOne(clientId, user.role, user.studioId);
  }

  updateClient(clientId: string, dto: UpdateClientDto, user: any) {
    return this.clientsService.update(clientId, dto, user.role, user.studioId);
  }

  async submitSurvey(clientId: string, dto: NextbotSurveyDto, user: any) {
    const profile = (await this.clientsService.findOne(
      clientId,
      user.role,
      user.studioId,
    )) as { notes?: string | null };
    const label = dto.label ?? 'nextbot_survey';
    const block = JSON.stringify({ label, answers: dto.answers });
    let newNotes: string;
    if (dto.merge) {
      const existing = profile.notes ?? '';
      const sep = existing && !String(existing).endsWith('\n') ? '\n' : '';
      newNotes = `${existing}${sep}[${label}]\n${block}\n`;
    } else {
      newNotes = block;
    }
    return this.clientsService.update(
      clientId,
      { notes: newNotes },
      user.role,
      user.studioId,
    );
  }

  getClientAppointments(
    clientId: string,
    upcomingOnly: boolean,
    user: any,
  ) {
    return this.clientsService.getClientAppointments(
      clientId,
      upcomingOnly,
      user.role,
      user.studioId,
    );
  }

  getServices(studioId: string, user: any) {
    return this.servicesService.findAll(studioId, user.role, user.studioId);
  }

  getPromotions(studioId: string) {
    return this.landingService.getPromotions(studioId);
  }

  getLandingServiceCards(studioId: string) {
    return this.landingService.getServiceCards(studioId);
  }

  getLandingMasters(studioId: string) {
    return this.landingService.getMasters(studioId);
  }

  async getAvailability(
    studioId: string,
    date: string,
    user: any,
    serviceId?: string,
    staffUserId?: string,
  ) {
    const [scheduleDays, busySlots, appointments] = await Promise.all([
      this.scheduleService.findAll(studioId, date, user.role, user.studioId),
      this.busySlotsService.findAll(studioId, date, user.role, user.studioId, user.userId),
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
      serviceIdHint: serviceId ?? null,
      staffUserIdHint: staffUserId ?? null,
    };
  }

  createAppointment(
    studioId: string,
    dto: CreateAppointmentDto,
    user: any,
  ) {
    return this.appointmentsService.create(studioId, dto, user.role, user.studioId);
  }

  updateAppointment(
    appointmentId: string,
    dto: UpdateAppointmentDto,
    user: any,
  ) {
    return this.appointmentsService.update(
      appointmentId,
      dto,
      user.role,
      user.studioId,
      user.userId,
    );
  }

  cancelAppointment(appointmentId: string, user: any) {
    return this.appointmentsService.update(
      appointmentId,
      { status: AppointmentStatus.CANCELLED },
      user.role,
      user.studioId,
      user.userId,
    );
  }
}
