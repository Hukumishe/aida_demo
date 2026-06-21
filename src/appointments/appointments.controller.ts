import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { WaitlistEntryStatus } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { MarkAppointmentDoneDto } from './dto/mark-appointment-done.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../common/decorators/roles.decorator';
import { listAppointmentStatusOptions } from './appointment-status.constants';

@ApiTags('appointments')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('appointment-statuses')
  @ApiOperation({ summary: 'Статусы записи (value + label) для журнала и фильтров' })
  listAppointmentStatuses() {
    return listAppointmentStatusOptions();
  }

  @Get('studios/:studioId/appointment-log')
  @ApiOperation({
    summary: 'Журнал на день: записи клиентов + личное время (для сетки и списка)',
  })
  @ApiQuery({ name: 'date', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({
    name: 'createdByUserId',
    required: false,
    description: 'Только записи, созданные указанным пользователем (автор)',
  })
  @ApiQuery({
    name: 'onlyMine',
    required: false,
    description: 'true — только записи, созданные текущим пользователем',
  })
  @ApiQuery({
    name: 'staffUserId',
    required: false,
    description: 'Только записи к указанному мастеру (исполнитель визита)',
  })
  async getAppointmentLogDay(
    @Param('studioId') studioId: string,
    @Query('date') date: string,
    @Query('createdByUserId') createdByUserId?: string,
    @Query('onlyMine') onlyMine?: string,
    @Query('staffUserId') staffUserId?: string,
    @CurrentUser() user?: any,
  ) {
    const authorFilter = this.resolveAppointmentAuthorFilter(
      createdByUserId,
      onlyMine,
      user?.userId,
    );
    return this.appointmentsService.getAppointmentLogDay(
      studioId,
      date,
      user?.role,
      user?.studioId,
      user?.userId,
      authorFilter,
      staffUserId?.trim() || undefined,
    );
  }

  @Get('studios/:studioId/appointments')
  @ApiOperation({ summary: 'Get all appointments for a studio' })
  @ApiQuery({ name: 'date', required: false, description: 'Filter by date (YYYY-MM-DD)' })
  @ApiQuery({
    name: 'createdByUserId',
    required: false,
    description: 'Только записи, созданные указанным пользователем (автор)',
  })
  @ApiQuery({
    name: 'onlyMine',
    required: false,
    description: 'true — только записи, созданные текущим пользователем',
  })
  @ApiQuery({
    name: 'staffUserId',
    required: false,
    description: 'Только записи к указанному мастеру (исполнитель визита)',
  })
  @ApiResponse({ status: 200, description: 'List of appointments' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @Param('studioId') studioId: string,
    @Query('date') date?: string,
    @Query('createdByUserId') createdByUserId?: string,
    @Query('onlyMine') onlyMine?: string,
    @Query('staffUserId') staffUserId?: string,
    @CurrentUser() user?: any,
  ) {
    const authorFilter = this.resolveAppointmentAuthorFilter(
      createdByUserId,
      onlyMine,
      user?.userId,
    );
    return this.appointmentsService.findAll(
      studioId,
      date,
      user?.role,
      user?.studioId,
      user?.userId,
      authorFilter,
      staffUserId?.trim() || undefined,
    );
  }

  /** Автор записи: onlyMine перекрывает явный createdByUserId. */
  private resolveAppointmentAuthorFilter(
    createdByUserId?: string,
    onlyMine?: string,
    currentUserId?: string,
  ): string | undefined {
    if (onlyMine === 'true' || onlyMine === '1') {
      if (currentUserId && currentUserId !== 'api-key') {
        return currentUserId;
      }
    }
    return createdByUserId?.trim() || undefined;
  }

  @Get('studios/:studioId/waitlist-entries')
  @ApiOperation({
    summary: 'Лист ожидания',
    description:
      'Заявки с лендинга/Nextbot, когда желаемый слот занят (пересечение по полной длительности услуги). По умолчанию только PENDING.',
  })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD — фильтр по дате желаемого начала' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'PENDING | FULFILLED | CANCELLED или all — все статусы',
  })
  @ApiResponse({ status: 200 })
  async findWaitlistEntries(
    @Param('studioId') studioId: string,
    @Query('date') date?: string,
    @Query('status') statusRaw?: string,
    @CurrentUser() user?: any,
  ) {
    let status: WaitlistEntryStatus | 'all' | undefined;
    if (statusRaw === 'all') {
      status = 'all';
    } else if (statusRaw && Object.values(WaitlistEntryStatus).includes(statusRaw as WaitlistEntryStatus)) {
      status = statusRaw as WaitlistEntryStatus;
    }
    return this.appointmentsService.findWaitlistEntries(
      studioId,
      user?.role,
      user?.studioId,
      user?.userId,
      {
        date,
        status: status === 'all' ? 'all' : status === undefined ? undefined : status,
      },
    );
  }

  @Post('studios/:studioId/waitlist-entries/:entryId/cancel')
  @ApiOperation({ summary: 'Отменить заявку в листе ожидания' })
  @ApiResponse({ status: 200 })
  async cancelWaitlistEntry(
    @Param('studioId') studioId: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user?: any,
  ) {
    return this.appointmentsService.cancelWaitlistEntry(
      studioId,
      entryId,
      user?.role,
      user?.studioId,
      user?.userId,
    );
  }

  @Post('studios/:studioId/waitlist-entries/:entryId/convert')
  @ApiOperation({
    summary: 'Создать запись из листа ожидания',
    description:
      'Пытается создать запись на то же время/мастера/услугу. При успехе заявка переводится в FULFILLED. Если слот всё ещё занят — 409.',
  })
  @ApiResponse({ status: 409, description: 'Слот по-прежнему недоступен' })
  async convertWaitlistEntry(
    @Param('studioId') studioId: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user?: any,
  ) {
    return this.appointmentsService.convertWaitlistEntryToAppointment(
      studioId,
      entryId,
      user?.role,
      user?.studioId,
      user?.organizationId,
      user?.userId,
    );
  }

  @Post('studios/:studioId/appointments')
  @ApiOperation({ summary: 'Create a new appointment' })
  @ApiResponse({ status: 201, description: 'Appointment created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Conflict - time slot not available' })
  async create(
    @Param('studioId') studioId: string,
    @Body() createAppointmentDto: CreateAppointmentDto,
    @CurrentUser() user?: any,
  ) {
    return this.appointmentsService.create(
      studioId,
      createAppointmentDto,
      user?.role,
      user?.studioId,
      user?.organizationId,
      user?.userId,
    );
  }

  @Get('appointments/:id/history')
  @ApiOperation({ summary: 'История действий по записи (модалка «История»)' })
  @ApiResponse({ status: 200, description: 'Хронология событий' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async getAppointmentHistory(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    return this.appointmentsService.getAppointmentHistory(
      id,
      user?.role,
      user?.studioId,
      user?.userId,
      user?.organizationId,
    );
  }

  @Patch('appointments/:id')
  @ApiOperation({ summary: 'Update appointment' })
  @ApiResponse({ status: 200, description: 'Appointment updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  @ApiResponse({ status: 409, description: 'Conflict - time slot not available' })
  async update(
    @Param('id') id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
    @CurrentUser() user?: any,
  ) {
    return this.appointmentsService.update(
      id,
      updateAppointmentDto,
      user?.role,
      user?.studioId,
      user?.userId,
      user?.organizationId,
    );
  }

  @Post('appointments/:id/cancel-without-prepayment-forfeit')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Отменить запись без сгорания предоплаты (только ADMIN)',
    description:
      'Поздняя отмена (< 4 ч до начала) без forfeitedPrepaymentAmount. Обычная отмена через PATCH с status=CANCELLED списывает предоплату в доход.',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async cancelWithoutPrepaymentForfeit(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    return this.appointmentsService.cancelWithoutPrepaymentForfeit(
      id,
      user?.role,
      user?.studioId,
      user?.userId,
      user?.organizationId,
    );
  }

  @Post('appointments/:id/fine-master-for-late')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Оштрафовать мастера за опоздание (только ADMIN)',
    description:
      'Доступно через 10 минут после начала записи. Сумма из masterLateFineAmount в параметрах системы. Клиент платит на эту сумму меньше при завершении визита.',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async fineMasterForLate(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    return this.appointmentsService.fineMasterForLate(
      id,
      user?.role,
      user?.studioId,
      user?.userId,
      user?.organizationId,
    );
  }

  @Post('appointments/:id/no-show')
  @ApiOperation({ summary: 'Mark appointment as no-show (Не пришёл)' })
  @ApiResponse({ status: 200, description: 'Appointment marked as no-show and deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async markNoShow(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    return this.appointmentsService.markNoShow(id, user?.role, user?.studioId, user?.userId);
  }

  @Post(['appointments/:id/mark-late', 'studios/:studioId/appointments/:id/mark-late'])
  @ApiOperation({ summary: 'Mark appointment as late (Опоздал) – prepayment to income, appointment kept' })
  @ApiResponse({ status: 200, description: 'Appointment marked as late' })
  @ApiResponse({ status: 400, description: 'Too early, no prepayment, or already forfeited' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async markLate(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    return this.appointmentsService.markLate(id, user?.role, user?.studioId, user?.userId);
  }

  @Post('appointments/:id/arrived')
  @ApiOperation({ summary: 'Mark appointment as arrived' })
  @ApiResponse({ status: 200, description: 'Appointment marked as arrived' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async markArrived(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    return this.appointmentsService.markArrived(id, user?.userId, user?.role, user?.studioId);
  }

  @Get('appointments/:id/done-checkout')
  @ApiOperation({
    summary: 'Расчёт суммы к оплате при завершении записи',
    description:
      'Серверный расчёт: услуги + допродажи − скидки − бонусы − предоплата. Поле moneyPaidNow — «Итого к оплате» на кассе. Query bonusesUsed — для ползунка бонусов.',
  })
  @ApiQuery({ name: 'bonusesUsed', required: false, type: Number, example: 0 })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async getDoneCheckout(
    @Param('id') id: string,
    @Query('bonusesUsed') bonusesUsed?: string,
    @CurrentUser() user?: any,
  ) {
    const bonus =
      bonusesUsed != null && bonusesUsed !== ''
        ? Math.max(0, parseInt(bonusesUsed, 10) || 0)
        : 0;
    return this.appointmentsService.getDoneCheckout(
      id,
      bonus,
      user?.role,
      user?.studioId,
    );
  }

  @Post('appointments/:id/done')
  @ApiOperation({ summary: 'Mark appointment as done (completed)' })
  @ApiResponse({ status: 200, description: 'Appointment marked as done' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  @ApiResponse({ status: 400, description: 'Bad request - appointment already done or cancelled' })
  async markDone(
    @Param('id') id: string,
    @Body() dto: MarkAppointmentDoneDto,
    @CurrentUser() user?: any,
  ) {
    return this.appointmentsService.markDone(id, user?.userId, user?.role, user?.studioId, dto);
  }
}

