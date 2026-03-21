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
import { Roles, UserRole } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { NextbotService } from './nextbot.service';
import { CreateClientDto } from '../clients/dto/create-client.dto';
import { CreateAppointmentDto } from '../appointments/dto/create-appointment.dto';
import { UpdateAppointmentDto } from '../appointments/dto/update-appointment.dto';
import { NextbotSurveyDto } from './dto/nextbot-survey.dto';

@ApiTags('nextbot')
@Controller('nextbot')
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class NextbotController {
  constructor(private readonly nextbotService: NextbotService) {}

  @Get('context')
  @ApiOperation({
    summary: 'Контекст компании: список студий (аналог get_company_context)',
  })
  @ApiResponse({ status: 200 })
  getContext(@CurrentUser() user: CurrentUserPayload) {
    return this.nextbotService.getCompanyContext(user);
  }

  @Get('studios/:studioId')
  @ApiOperation({ summary: 'Карточка студии (аналог get_studio_details)' })
  @ApiResponse({ status: 200 })
  getStudio(
    @Param('studioId') studioId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.getStudioDetails(studioId, user);
  }

  @Get('studios/:studioId/clients/verify')
  @ApiOperation({ summary: 'Поиск клиента по q + полный профиль' })
  @ApiQuery({ name: 'q', required: false })
  @ApiResponse({ status: 200 })
  verifyClient(
    @Param('studioId') studioId: string,
    @Query('q') q: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.verifyClient(studioId, q, user);
  }

  @Get('studios/:studioId/clients/loyalty')
  @ApiOperation({ summary: 'Краткая сводка лояльности по контакту (q)' })
  @ApiQuery({ name: 'q', required: false })
  loyalty(
    @Param('studioId') studioId: string,
    @Query('q') q: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.loyaltySummary(studioId, q, user);
  }

  @Get('studios/:studioId/clients/referral')
  @ApiOperation({ summary: 'Реферальный код по контакту (q)' })
  @ApiQuery({ name: 'q', required: false })
  referral(
    @Param('studioId') studioId: string,
    @Query('q') q: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.referralSummary(studioId, q, user);
  }

  @Post('studios/:studioId/clients/register')
  @ApiOperation({ summary: 'Регистрация клиента (alias POST .../clients)' })
  @ApiResponse({ status: 201 })
  registerClient(
    @Param('studioId') studioId: string,
    @Body() dto: CreateClientDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.registerClient(studioId, dto, user);
  }

  @Post('clients/:clientId/survey')
  @ApiOperation({ summary: 'Сохранить ответы анкеты в notes клиента' })
  @ApiResponse({ status: 200 })
  processSurvey(
    @Param('clientId') clientId: string,
    @Body() dto: NextbotSurveyDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.processSurvey(clientId, dto, user);
  }

  @Get('clients/:id')
  @ApiOperation({ summary: 'Профиль клиента' })
  @ApiResponse({ status: 200 })
  getClient(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.getClientProfile(id, user);
  }

  @Get('clients/:id/appointments')
  @ApiOperation({ summary: 'Записи клиента' })
  @ApiQuery({
    name: 'upcoming',
    required: false,
    description: 'Только предстоящие',
  })
  @ApiResponse({ status: 200 })
  listAppointments(
    @Param('id') id: string,
    @Query('upcoming') upcoming: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const upcomingOnly = upcoming === 'true' || upcoming === '1';
    return this.nextbotService.listClientAppointments(id, upcomingOnly, user);
  }

  @Get('studios/:studioId/services')
  @ApiOperation({ summary: 'Услуги и цены студии' })
  @ApiResponse({ status: 200 })
  getServices(
    @Param('studioId') studioId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.getServices(studioId, user);
  }

  @Get('studios/:studioId/landing/promotions')
  @ApiOperation({ summary: 'Активные акции лендинга' })
  @ApiResponse({ status: 200 })
  getPromotions(@Param('studioId') studioId: string) {
    return this.nextbotService.getPromotions(studioId);
  }

  @Get('studios/:studioId/availability-raw')
  @ApiOperation({
    summary:
      'Сырые schedule + busy-slots + appointments за дату (для расчёта слотов в боте)',
  })
  @ApiQuery({ name: 'date', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'staffUserId', required: false })
  @ApiResponse({ status: 200 })
  availabilityRaw(
    @Param('studioId') studioId: string,
    @Query('date') date: string,
    @Query('staffUserId') staffUserId: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.availabilityRaw(studioId, date, staffUserId, user);
  }

  @Post('studios/:studioId/appointments')
  @ApiOperation({ summary: 'Создать запись' })
  @ApiResponse({ status: 201 })
  createAppointment(
    @Param('studioId') studioId: string,
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.createAppointment(studioId, dto, user);
  }

  @Patch('appointments/:id')
  @ApiOperation({ summary: 'Изменить запись (в т.ч. перенос — startAt)' })
  @ApiResponse({ status: 200 })
  updateAppointment(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.updateAppointment(id, dto, user);
  }

  @Patch('appointments/:id/cancel')
  @ApiOperation({ summary: 'Отменить запись (status = CANCELLED)' })
  @ApiResponse({ status: 200 })
  cancelAppointment(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.cancelAppointment(id, user);
  }

  @Get('prompts')
  @Roles(UserRole.SERVICE)
  @ApiOperation({ summary: 'Список промптов (как GET /prompts)' })
  @ApiResponse({ status: 200 })
  listPrompts() {
    return this.nextbotService.listPrompts();
  }

  @Get('prompts/:id')
  @Roles(UserRole.SERVICE)
  @ApiOperation({ summary: 'Промпт по id' })
  @ApiResponse({ status: 200 })
  getPrompt(@Param('id') id: string) {
    return this.nextbotService.getPrompt(id);
  }
}
