import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NextbotService } from './nextbot.service';
import { CreateClientDto } from '../clients/dto/create-client.dto';
import { UpdateClientDto } from '../clients/dto/update-client.dto';
import { CreateAppointmentDto } from '../appointments/dto/create-appointment.dto';
import { UpdateAppointmentDto } from '../appointments/dto/update-appointment.dto';
import { NextbotSurveyDto } from './dto/nextbot-survey.dto';

/**
 * HTTP API для интеграций бота (Nextbot): один контракт вместо Python-обёрток.
 * Авторизация: JWT или X-API-Key (NEXTBOT_API_KEY), как у остального API.
 */
@ApiTags('nextbot')
@Controller('nextbot')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NextbotController {
  constructor(private readonly nextbotService: NextbotService) {}

  @Get('context')
  @ApiOperation({ summary: 'Контекст: список студий и опционально текущая студия' })
  @ApiQuery({ name: 'currentStudioId', required: false })
  @ApiResponse({ status: 200 })
  async getContext(
    @CurrentUser() user: any,
    @Query('currentStudioId') currentStudioId?: string,
  ) {
    return this.nextbotService.getContext(user, currentStudioId);
  }

  @Get('studios/:studioId')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Карточка студии' })
  @ApiResponse({ status: 200 })
  async getStudio(
    @Param('studioId') studioId: string,
    @CurrentUser() user: any,
  ) {
    return this.nextbotService.getStudio(studioId, user);
  }

  @Get('studios/:studioId/clients/lookup')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Поиск клиента по q (телефон/имя) и полный профиль при нахождении' })
  @ApiQuery({ name: 'q', required: true })
  @ApiResponse({ status: 200 })
  async lookupClient(
    @Param('studioId') studioId: string,
    @Query('q') q: string,
    @CurrentUser() user: any,
  ) {
    return this.nextbotService.lookupClient(studioId, q, user);
  }

  @Get('studios/:studioId/clients/loyalty')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Кратко: лояльность по поиску q' })
  @ApiQuery({ name: 'q', required: true })
  async loyalty(
    @Param('studioId') studioId: string,
    @Query('q') q: string,
    @CurrentUser() user: any,
  ) {
    return this.nextbotService.loyaltyStatus(studioId, q, user);
  }

  @Get('studios/:studioId/clients/referral')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Реферальный код по поиску q' })
  @ApiQuery({ name: 'q', required: true })
  async referral(
    @Param('studioId') studioId: string,
    @Query('q') q: string,
    @CurrentUser() user: any,
  ) {
    return this.nextbotService.referralInfo(studioId, q, user);
  }

  @Post('studios/:studioId/clients')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Регистрация клиента' })
  async registerClient(
    @Param('studioId') studioId: string,
    @Body() dto: CreateClientDto,
    @CurrentUser() user: any,
  ) {
    return this.nextbotService.registerClient(studioId, dto, user);
  }

  @Get('clients/:id')
  @ApiOperation({ summary: 'Профиль клиента по id' })
  async getClient(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.nextbotService.getClientProfile(id, user);
  }

  @Patch('clients/:id')
  @ApiOperation({ summary: 'Обновление клиента' })
  async updateClient(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: any,
  ) {
    return this.nextbotService.updateClient(id, dto, user);
  }

  @Post('clients/:id/survey')
  @ApiOperation({ summary: 'Сохранить ответы анкеты в notes' })
  async survey(
    @Param('id') id: string,
    @Body() dto: NextbotSurveyDto,
    @CurrentUser() user: any,
  ) {
    return this.nextbotService.submitSurvey(id, dto, user);
  }

  @Get('clients/:id/appointments')
  @ApiOperation({ summary: 'Записи клиента' })
  @ApiQuery({ name: 'upcoming', required: false })
  async clientAppointments(
    @Param('id') id: string,
    @Query('upcoming') upcoming: string | undefined,
    @CurrentUser() user: any,
  ) {
    const upcomingOnly = upcoming === 'true' || upcoming === '1';
    return this.nextbotService.getClientAppointments(id, upcomingOnly, user);
  }

  @Get('studios/:studioId/services')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Услуги и цены студии' })
  async services(
    @Param('studioId') studioId: string,
    @CurrentUser() user: any,
  ) {
    return this.nextbotService.getServices(studioId, user);
  }

  @Get('studios/:studioId/landing/promotions')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Акции лендинга' })
  async promotions(@Param('studioId') studioId: string) {
    return this.nextbotService.getPromotions(studioId);
  }

  @Get('studios/:studioId/landing/services')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Карточки услуг лендинга' })
  async landingServices(@Param('studioId') studioId: string) {
    return this.nextbotService.getLandingServiceCards(studioId);
  }

  @Get('studios/:studioId/landing/masters')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Мастера лендинга' })
  async landingMasters(@Param('studioId') studioId: string) {
    return this.nextbotService.getLandingMasters(studioId);
  }

  @Get('studios/:studioId/availability')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({
    summary:
      'Сырые данные для расчёта слотов: schedule + busy + appointments',
  })
  @ApiQuery({ name: 'date', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'serviceId', required: false })
  @ApiQuery({ name: 'staffUserId', required: false })
  async availability(
    @Param('studioId') studioId: string,
    @Query('date') date: string,
    @CurrentUser() user: any,
    @Query('serviceId') serviceId?: string,
    @Query('staffUserId') staffUserId?: string,
  ) {
    return this.nextbotService.getAvailability(
      studioId,
      date,
      user,
      serviceId,
      staffUserId,
    );
  }

  @Post('studios/:studioId/appointments')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Создать запись' })
  async createAppointment(
    @Param('studioId') studioId: string,
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: any,
  ) {
    return this.nextbotService.createAppointment(studioId, dto, user);
  }

  @Patch('appointments/:id')
  @ApiOperation({ summary: 'Изменить запись (startAt, prepaymentAmount, status)' })
  async updateAppointment(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: any,
  ) {
    return this.nextbotService.updateAppointment(id, dto, user);
  }

  @Post('appointments/:id/cancel')
  @ApiOperation({
    summary:
      'Отмена записи (status=CANCELLED). См. документацию: отличие от no-show',
  })
  async cancelAppointment(@Param('id') id: string, @CurrentUser() user: any) {
    return this.nextbotService.cancelAppointment(id, user);
  }
}
