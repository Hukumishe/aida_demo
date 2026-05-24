import {
  BadRequestException,
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
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { NextbotService } from './nextbot.service';
import { collectServiceIdList } from './nextbot-service-ids.util';
import { CreateClientDto } from '../clients/dto/create-client.dto';
import { UpdateClientDto } from '../clients/dto/update-client.dto';
import { CreateAppointmentDto } from '../appointments/dto/create-appointment.dto';
import { UpdateAppointmentDto } from '../appointments/dto/update-appointment.dto';
import { NextbotSurveyDto } from './dto/nextbot-survey.dto';
import { RequestManagerInvoiceDto } from './dto/request-manager-invoice.dto';
import { VerifyReceiptNighttimeDto } from './dto/verify-receipt-nighttime.dto';
import { CreateEscalationTicketDto } from './dto/create-escalation-ticket.dto';
import { LinkNextbotDialogDto } from './dto/link-nextbot-dialog.dto';
import { SubmitAppointmentFeedbackDto } from './dto/submit-appointment-feedback.dto';

/**
 * Эндпоинты строго по функциям из системного промпта xmind (aida_xmind.pdf).
 * get_user_id — только внутри Nextbot, HTTP нет.
 * cancel_booking / reschedule_booking в PDF не отделены: используй modify_booking (POST .../appointments/:id/update).
 */
@ApiTags('nextbot')
@Controller('nextbot')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NextbotController {
  constructor(private readonly nextbotService: NextbotService) {}

  // --- get_company_context ---
  @Get('context')
  @ApiOperation({
    summary: 'get_company_context',
    description:
      'Возвращает { studios } — список филиалов (как в панели). У каждой студии в массиве есть поле organizationId.',
  })
  @ApiResponse({ status: 200 })
  getContext(@CurrentUser() user: CurrentUserPayload) {
    return this.nextbotService.getCompanyContext(user);
  }

  // --- verify_client_status ---
  @Get('clients/verify')
  @ApiOperation({
    summary: 'verify_client_status',
    description:
      'Ответ: found + компактные поля клиента (firstName, patronymic, level, bonuses, cashbackPercent) и строка prompt — промпт с портала для этого сценария (ключи в БД: verify_client_status_not_found, ' +
      'verify_client_status_found_with_birth_date, verify_client_status_found_without_birth_date).',
  })
  @ApiQuery({
    name: 'phone',
    required: false,
    description: 'Телефон / контакт для поиска клиента в организации',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Устарело: то же, что phone (если phone не передан)',
  })
  @ApiQuery({
    name: 'dialogId',
    required: false,
    description:
      'dialog_id из Nextbot: при найденном клиенте сохраняется в профиль (nextbotDialogId) для исходящих сообщений',
  })
  verifyClient(
    @Query('phone') phone: string | undefined,
    @Query('q') legacyQ: string | undefined,
    @Query('dialogId') dialogId: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const resolved = phone?.trim() || legacyQ?.trim();
    return this.nextbotService.verifyClient(resolved || undefined, user, dialogId);
  }

  @Patch('clients/link-dialog')
  @ApiOperation({
    summary: 'link_nextbot_dialog',
    description:
      'Привязать dialog_id Nextbot к клиенту по телефону. Поле в CRM: nextbotDialogId (в ответе также dialogId).',
  })
  @ApiResponse({ status: 200, description: 'Dialog linked' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  linkNextbotDialog(
    @Body() dto: LinkNextbotDialogDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.linkNextbotDialog(dto, user);
  }

  // --- register_new_client ---
  @Post('clients/register')
  @ApiOperation({ summary: 'register_new_client' })
  @ApiResponse({ status: 201 })
  registerClient(
    @Body() dto: CreateClientDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.registerClient(dto, user);
  }

  // --- update_old_client_profile ---
  @Patch('clients/:clientId/update')
  @ApiOperation({
    summary: 'update_old_client_profile',
    description:
      'Обновление профиля существующего клиента (тело как PATCH /clients/:id). В ответе — обновлённый клиент и строка `update_old_client_profile` (промпт из панели AIDA по этому ключу).',
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER: контекст организации, как у GET /clients.',
  })
  @ApiResponse({ status: 200, description: 'Client updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  updateOldClientProfile(
    @Param('clientId') clientId: string,
    @Body() dto: UpdateClientDto,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.updateOldClientProfile(
      clientId,
      dto,
      user,
      organizationId,
    );
  }

  // --- process_survey_answers ---
  @Post('clients/:clientId/survey')
  @ApiOperation({ summary: 'process_survey_answers' })
  processSurvey(
    @Param('clientId') clientId: string,
    @Body() dto: NextbotSurveyDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.processSurvey(clientId, dto, user);
  }

  // --- process_survey_answers_failed (xmind) ---
  @Post('clients/:clientId/survey-failed')
  @ApiOperation({ summary: 'process_survey_answers_failed (заглушка)' })
  @ApiBody({ required: false })
  @ApiResponse({ status: 501 })
  surveyFailed(
    @Param('clientId') _clientId: string,
    @Body() _body?: Record<string, unknown>,
  ) {
    return this.nextbotService.notImplemented('process_survey_answers_failed');
  }

  @Post('appointments/:appointmentId/feedback')
  @ApiOperation({
    summary: 'submit_appointment_feedback',
    description:
      'Оценка 1–5 из чата Nextbot после визита. 4–5: опционально 2GIS; ≤3: задача менеджерам.',
  })
  submitAppointmentFeedback(
    @Param('appointmentId') appointmentId: string,
    @Body() dto: SubmitAppointmentFeedbackDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.submitAppointmentFeedback(appointmentId, dto, user);
  }

  // --- get_service_categories ---
  // Первичный фильтр: укрупнённые направления работы (категории услуг).
  // Для каждой категории возвращается:
  // - `available_in` — список ID филиалов организации;
  // - `available_in_studios` — список объектов { id, name } тех же филиалов,
  // где категория НЕ отключена (учёт StudioDisabledCategory).
  @Get('service-categories')
  @ApiOperation({
    summary: 'get_service_categories',
    description:
      'Возвращает категории услуг организации для презентации клиенту. У каждой категории есть ' +
      '`available_in` (ID филиалов) и `available_in_studios` ({ id, name } филиалов), где она доступна. Организация определяется по JWT / API-ключу. ' +
      'Параметр `studioId` принимается для совместимости, но не обязателен (категории общие на всю сеть).',
  })
  @ApiQuery({
    name: 'studioId',
    required: false,
    description: 'Необязательно. Принимается для совместимости с вызовом из xmind-обёртки.',
  })
  getServiceCategories(@CurrentUser() user: CurrentUserPayload) {
    return this.nextbotService.getServiceCategories(user);
  }

  // --- get_services_and_prices ---
  // Основной путь, который использует xmind-обёртка:
  //   GET /nextbot/studios/:studioId/services?organizationId=...&category=...&audience=...
  // Бэкенд сам отсекает услуги, недоступные в студии / в неактивной категории,
  // и фильтрует по выбранной категории и полу клиента (аудитории).
  @Get('studios/:studioId/services')
  @ApiOperation({
    summary: 'get_services_and_prices',
    description:
      'Возвращает целевой срез прайса выбранного филиала. Бэкенд сам отсекает услуги, ' +
      'отключённые в этом филиале (StudioDisabledService/Category) и неактивные, ' +
      'а также фильтрует по `category` (id или имя) и `audience` (MEN/WOMEN). ' +
      'Ответу намеренно оставлены только поля id / name / defaultPrice / defaultDurationMin.',
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description:
      'Необязательно. Принимается для совместимости; фактически организация определяется по JWT/API-ключу.',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'ID или название категории услуг (например, "Лазерная эпиляция").',
  })
  @ApiQuery({
    name: 'audience',
    required: false,
    description: 'Пол клиента / аудитория прайса: MEN | WOMEN (допустимы также "мужской" / "женский").',
  })
  getServicesForStudio(
    @Param('studioId') studioId: string,
    @Query('category') category: string | undefined,
    @Query('audience') audience: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!studioId?.trim()) {
      throw new BadRequestException('Path parameter studioId is required');
    }
    return this.nextbotService.getServices(studioId.trim(), user, {
      category,
      audience,
    });
  }

  /**
   * Устаревший путь `GET /nextbot/services?studioId=...` оставлен ради обратной совместимости
   * (старые версии xmind-обёртки).
   * Новый код должен использовать `/nextbot/studios/:studioId/services`.
   */
  @Get('services')
  @ApiOperation({
    summary: 'get_services_and_prices (legacy alias)',
    description:
      'Устаревший путь. Используйте `/nextbot/studios/:studioId/services`.',
  })
  @ApiQuery({ name: 'studioId', required: true })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'audience', required: false })
  getServices(
    @Query('studioId') studioId: string,
    @Query('category') category: string | undefined,
    @Query('audience') audience: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!studioId?.trim()) {
      throw new BadRequestException('Query parameter studioId is required');
    }
    return this.nextbotService.getServices(studioId.trim(), user, {
      category,
      audience,
    });
  }

  // --- get_active_promotions (org-level) ---
  // Акции действуют на всю организацию, поэтому studioId не требуется.
  @Get('landing/promotions')
  @ApiOperation({
    summary: 'get_active_promotions',
    description:
      'Активные акции организации (определяется по JWT / API-ключу). studioId НЕ требуется — акции общие по всей сети салонов.',
  })
  getPromotionsForOrganization(@CurrentUser() user: CurrentUserPayload) {
    return this.nextbotService.getPromotionsForOrganization(user);
  }

  // --- check_loyalty_status ---
  @Get('clients/loyalty')
  @ApiOperation({ summary: 'check_loyalty_status' })
  @ApiQuery({
    name: 'phone',
    required: false,
    description: 'Телефон / контакт для поиска клиента',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Устарело: то же, что phone (если phone не передан)',
  })
  loyalty(
    @Query('phone') phone: string | undefined,
    @Query('q') legacyQ: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const resolved = phone?.trim() || legacyQ?.trim();
    return this.nextbotService.loyaltySummary(resolved || undefined, user);
  }

  // --- get_referral_code ---
  @Get('clients/referral')
  @ApiOperation({ summary: 'get_referral_code' })
  @ApiQuery({
    name: 'phone',
    required: false,
    description: 'Телефон / контакт для поиска клиента',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Устарело: то же, что phone (если phone не передан)',
  })
  referral(
    @Query('phone') phone: string | undefined,
    @Query('q') legacyQ: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const resolved = phone?.trim() || legacyQ?.trim();
    return this.nextbotService.referralSummary(resolved || undefined, user);
  }

  // --- check_availability ---
  @Get('studios/:studioId/availability-raw')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({
    summary: 'check_availability',
    description:
      'Свободные слоты (freeSlots) и текст промпта для ИИ (поле check_availability). ' +
      'Передайте `serviceIds` (одна или несколько услуг) или legacy `serviceId` / `durationMinutes`. ' +
      'В теле ответа всегда есть `serviceIds` (массив id).',
  })
  @ApiQuery({ name: 'date', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'staffUserId', required: false })
  @ApiQuery({
    name: 'serviceIds',
    required: false,
    description:
      'Одна или несколько услуг: повтор параметра, либо CSV `id1,id2`. Мастера — пересечение по всем услугам; ' +
      'длительность — сумма (с override мастера по каждой услуге при заданном staffUserId).',
  })
  @ApiQuery({
    name: 'service_ids',
    required: false,
    description: 'См. serviceIds (snake_case).',
  })
  @ApiQuery({
    name: 'serviceId',
    required: false,
    description:
      'Legacy: одна услуга (если serviceIds не передан). Длительность из CRM, фильтр мастеров по staff_services.',
  })
  @ApiQuery({
    name: 'service_id',
    required: false,
    description: 'См. serviceId (для совместимости с клиентами, шлюзами, Nextbot).',
  })
  @ApiQuery({
    name: 'durationMinutes',
    required: false,
    description: 'Если нет serviceId — длительность слота (по умолчанию 60)',
  })
  @ApiQuery({
    name: 'slotStepMinutes',
    required: false,
    description: 'Шаг сетки слотов в минутах (по умолчанию 15, мин 5, макс 120)',
  })
  availabilityRaw(
    @Param('studioId') studioId: string,
    @Query('date') date: string,
    @Query('staffUserId') staffUserId: string | undefined,
    @Query('serviceIds') serviceIds: string | string[] | undefined,
    @Query('service_ids') serviceIdsSnake: string | string[] | undefined,
    @Query('serviceId') serviceId: string | undefined,
    @Query('service_id') serviceIdSnake: string | undefined,
    @Query('durationMinutes') durationMinutesRaw: string | undefined,
    @Query('slotStepMinutes') slotStepMinutesRaw: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const serviceIdList = collectServiceIdList(
      serviceIds,
      serviceIdsSnake,
      serviceId,
      serviceIdSnake,
    );
    const durationMinutes =
      durationMinutesRaw !== undefined && durationMinutesRaw !== ''
        ? parseInt(durationMinutesRaw, 10)
        : undefined;
    const slotStepMinutes =
      slotStepMinutesRaw !== undefined && slotStepMinutesRaw !== ''
        ? parseInt(slotStepMinutesRaw, 10)
        : undefined;
    return this.nextbotService.availabilityRaw(studioId, date, staffUserId, user, {
      serviceIds: serviceIdList.length > 0 ? serviceIdList : undefined,
      durationMinutes:
        durationMinutes !== undefined && !Number.isNaN(durationMinutes)
          ? durationMinutes
          : undefined,
      slotStepMinutes:
        slotStepMinutes !== undefined && !Number.isNaN(slotStepMinutes)
          ? slotStepMinutes
          : undefined,
    });
  }

  // --- create_booking_request ---
  @Post('studios/:studioId/appointments')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'create_booking_request' })
  @ApiResponse({ status: 201 })
  createAppointment(
    @Param('studioId') studioId: string,
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.createAppointment(studioId, dto, user);
  }

  // --- modify_booking (перенос, отмена через status, prepayment и т.д.) ---
  @Post('appointments/:id/update')
  @ApiOperation({
    summary:
      'modify_booking (отмена: {"status":"CANCELLED"}, перенос: {"startAt":"..."})',
  })
  modifyBooking(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.modifyBooking(id, dto, user);
  }

  // --- Заглушки xmind (нет в CRM) — до маршрутов с :studioId не требуется, но порядок ниже ок ---

  @Post('add-to-waitlist')
  @ApiOperation({ summary: 'add_to_waitlist' })
  @ApiBody({ required: false })
  @ApiResponse({ status: 501 })
  addToWaitlist(@Body() _body?: Record<string, unknown>) {
    return this.nextbotService.notImplemented('add_to_waitlist');
  }

  /**
   * request_manager_invoice — маршрутизатор оплаты Kaspi для предварительной брони.
   *
   * Бэкенд сам определяет день/ночь по локальному времени филиала и рабочим часам
   * отдела маркетинга организации (`marketingHoursStartHour/EndHour`):
   *   • День  → создаёт `StudioTask` на выставление счёта менеджеру + уведомление.
   *   • Ночь  → ставит `holdExpiresAt = now + 30 min` на запись и возвращает
   *             динамический промпт со статичными реквизитами Kaspi;
   *             по истечении таймера бронь автоматически отменяется,
   *             если не переведена в PENDING_CONFIRMATION (verify_receipt_nighttime).
   */
  @Post('request-manager-invoice')
  @ApiOperation({
    summary: 'request_manager_invoice',
    description:
      'Маршрутизатор оплаты Kaspi: день → задача менеджеру; ночь → 30-мин таймер удержания предварительной брони и статичные реквизиты Kaspi.',
  })
  @ApiResponse({ status: 200 })
  requestManagerInvoice(
    @Body() dto: RequestManagerInvoiceDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.requestManagerInvoice(dto, user);
  }

  @Post('generate-payment-link')
  @ApiOperation({ summary: 'generate_payment_link' })
  @ApiBody({ required: false })
  @ApiResponse({ status: 501 })
  generatePaymentLink(@Body() _body?: Record<string, unknown>) {
    return this.nextbotService.notImplemented('generate_payment_link');
  }

  /**
   * verify_receipt_nighttime — финализатор ночной оплаты.
   *
   * Агент вызывает этот роут после того, как клиент прислал чек и ассистент
   * визуально сверил ИП / дату / сумму. Бэкенд переводит запись из TENTATIVE
   * в PENDING_CONFIRMATION (крон автоотмены больше её не тронет) и создаёт
   * утреннюю задачу менеджеру на сверку с выпиской Kaspi. Идемпотентен:
   * повторный вызов для уже PENDING_CONFIRMATION просто вернёт промпт.
   */
  @Post('verify-receipt-nighttime')
  @ApiOperation({
    summary: 'verify_receipt_nighttime',
    description:
      'Завершение ночной ветки оплаты: TENTATIVE → PENDING_CONFIRMATION, ' +
      'сброс holdExpiresAt, утренняя задача менеджеру на сверку чека с Kaspi-выпиской.',
  })
  @ApiResponse({ status: 200 })
  verifyReceiptNighttime(
    @Body() dto: VerifyReceiptNighttimeDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.verifyReceiptNighttime(dto, user);
  }

  @Post('purchase-certificate')
  @ApiOperation({ summary: 'purchase_certificate' })
  @ApiBody({ required: false })
  @ApiResponse({ status: 501 })
  purchaseCertificate(@Body() _body?: Record<string, unknown>) {
    return this.nextbotService.notImplemented('purchase_certificate');
  }

  @Post('validate-certificate-code')
  @ApiOperation({ summary: 'validate_certificate_code' })
  @ApiBody({ required: false })
  @ApiResponse({ status: 501 })
  validateCertificateCode(@Body() _body?: Record<string, unknown>) {
    return this.nextbotService.notImplemented('validate_certificate_code');
  }

  @Post('create-escalation-ticket')
  @ApiOperation({ summary: 'create_escalation_ticket' })
  @ApiResponse({ status: 200 })
  createEscalationTicket(
    @Body() dto: CreateEscalationTicketDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.nextbotService.createEscalationTicket(dto, user);
  }

  @Post('dev-error-report')
  @ApiOperation({ summary: 'dev_error_report' })
  @ApiBody({ required: false })
  @ApiResponse({ status: 501 })
  devErrorReport(@Body() _body?: Record<string, unknown>) {
    return this.nextbotService.notImplemented('dev_error_report');
  }
}
