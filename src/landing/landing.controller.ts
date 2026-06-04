import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { LandingService } from './landing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { Roles, UserRole } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CreateLandingPromotionDto } from './dto/create-promotion.dto';
import { UpdateLandingPromotionDto } from './dto/update-promotion.dto';
import { UpdateLandingMastersDto } from './dto/update-masters.dto';
import { CreateLandingServiceCardDto } from './dto/create-service-card.dto';
import { UpdateLandingServiceCardDto } from './dto/update-service-card.dto';
import { ReorderLandingServiceCardsDto } from './dto/reorder-service-cards.dto';
import { ResolvePromotionCodeDto } from './dto/resolve-promotion-code.dto';
import { LandingBookingRequestDto } from './dto/landing-booking-request.dto';

@ApiTags('landing')
@Controller()
export class LandingController {
  constructor(
    private readonly landingService: LandingService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Пытается достать organizationId из Authorization: Bearer <jwt> без падения.
   * Нужен для "опционально авторизованных" публичных эндпоинтов: лендингу
   * передают `?organizationId=`, а админка владельца ходит с JWT — и мы
   * извлекаем org из токена без обязательного query-параметра.
   */
  private tryGetOrganizationIdFromBearer(req: Request): string | undefined {
    const auth = req.headers.authorization;
    if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return undefined;
    const token = auth.slice(7).trim();
    if (!token) return undefined;
    try {
      const payload = this.jwtService.verify<{ organizationId?: string }>(token);
      const orgId = (payload?.organizationId ?? '').trim();
      return orgId || undefined;
    } catch {
      return undefined;
    }
  }

  // --- Promotions (organization-level) ---
  // Акции действуют на всю организацию (сеть салонов). studioId больше не требуется.

  @Public()
  @Get('landing/promotions')
  @ApiOperation({
    summary: 'Список активных акций организации (публично + админка)',
    description:
      'Возвращает акции организации с их промокодами и услугами. Акции общие на всю сеть. ' +
      'Лендинг передаёт `?organizationId=` в query. Админка владельца может не передавать ' +
      'query — `organizationId` будет взят из JWT (Authorization: Bearer).',
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description:
      'ID организации. Обязателен для публичных вызовов без JWT. Если пользователь ' +
      'авторизован (Bearer-токен), можно не передавать — возьмём из токена.',
  })
  @ApiResponse({ status: 200, description: 'Список акций' })
  async listPromotions(
    @Query('organizationId') organizationId: string | undefined,
    @Req() req: Request,
  ) {
    let orgId = (organizationId ?? '').trim();
    if (!orgId) {
      orgId = this.tryGetOrganizationIdFromBearer(req) ?? '';
    }
    if (!orgId) {
      throw new BadRequestException(
        'organizationId is required (query parameter or Bearer JWT with organizationId)',
      );
    }
    return this.landingService.getPromotionsForOrganization(orgId);
  }

  @Public()
  @Post('landing/promotions/resolve-code')
  @ApiOperation({
    summary: 'Проверить промокод и получить автоподстановку услуг/цены',
    description:
      'Публичный эндпоинт. В body обязательно `code` и `organizationId`. Опциональный `studioId` ' +
      '— чтобы отфильтровать услуги по тому, что доступно для записи в конкретном филиале.',
  })
  @ApiResponse({ status: 200, description: 'Данные акции для автозаполнения формы записи' })
  async resolvePromotionCode(@Body() dto: ResolvePromotionCodeDto) {
    const orgId = (dto.organizationId ?? '').trim();
    if (!orgId) {
      throw new BadRequestException('Body field organizationId is required');
    }
    return this.landingService.resolvePromotionCodeForOrganization(
      orgId,
      dto.code,
      dto.studioId?.trim() || undefined,
    );
  }

  @Post('landing/promotions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DEVELOPER, UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({
    summary: 'Создать акцию (скидка / 1+1 / bundle, с on/off)',
    description:
      'Акция создаётся в рамках организации пользователя. DEVELOPER может передать ' +
      '`?organizationId=<id>`, чтобы создать акцию в другой организации.',
  })
  @ApiQuery({ name: 'organizationId', required: false, description: 'Только DEVELOPER — id чужой организации' })
  @ApiResponse({ status: 201, description: 'Акция создана' })
  async createPromotion(
    @Body() dto: CreateLandingPromotionDto,
    @Query('organizationId') organizationIdQuery: string | undefined,
    @CurrentUser() user: any,
  ) {
    const organizationId = await this.landingService.resolveOrganizationIdForPromotion(
      user?.role,
      user?.organizationId,
      organizationIdQuery,
    );
    return this.landingService.createPromotionForOrganization(organizationId, dto);
  }

  @Patch('landing/promotions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DEVELOPER, UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Обновить акцию (в т.ч. on/off через isActive)' })
  @ApiQuery({ name: 'organizationId', required: false, description: 'Только DEVELOPER — id чужой организации' })
  @ApiResponse({ status: 200, description: 'Акция обновлена' })
  async updatePromotion(
    @Param('id') id: string,
    @Body() dto: UpdateLandingPromotionDto,
    @Query('organizationId') organizationIdQuery: string | undefined,
    @CurrentUser() user: any,
  ) {
    const organizationId = await this.landingService.resolveOrganizationIdForPromotion(
      user?.role,
      user?.organizationId,
      organizationIdQuery,
    );
    return this.landingService.updatePromotionForOrganization(organizationId, id, dto);
  }

  @Delete('landing/promotions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DEVELOPER, UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Удалить акцию' })
  @ApiQuery({ name: 'organizationId', required: false, description: 'Только DEVELOPER — id чужой организации' })
  @ApiResponse({ status: 200, description: 'Акция удалена' })
  async deletePromotion(
    @Param('id') id: string,
    @Query('organizationId') organizationIdQuery: string | undefined,
    @CurrentUser() user: any,
  ) {
    const organizationId = await this.landingService.resolveOrganizationIdForPromotion(
      user?.role,
      user?.organizationId,
      organizationIdQuery,
    );
    return this.landingService.deletePromotionForOrganization(organizationId, id);
  }

  @Public()
  @Get('landing/organizations/:organizationId/studios')
  @ApiOperation({
    summary: 'Филиалы сети для формы записи (публично)',
    description:
      'Список студий организации: id, name, address, timezone. organizationId — из env лендинга (VITE_ORGANIZATION_ID).',
  })
  getPublicStudios(@Param('organizationId') organizationId: string) {
    return this.landingService.getPublicStudiosForOrganization(organizationId);
  }

  @Public()
  @Get('landing/studios/:studioId/bookable-services')
  @ApiOperation({
    summary: 'Услуги филиала для формы записи (публично)',
    description:
      'Каталог услуг CRM в филиале. Опционально staffUserId — только услуги выбранного мастера (staff_services).',
  })
  @ApiQuery({
    name: 'staffUserId',
    required: false,
    description: 'После выбора мастера — только его услуги',
  })
  getPublicBookableServices(
    @Param('studioId') studioId: string,
    @Query('staffUserId') staffUserId?: string,
  ) {
    return this.landingService.getPublicBookableServices(studioId, staffUserId);
  }

  @Public()
  @Get('landing/studios/:studioId/bookable-masters')
  @ApiOperation({
    summary: 'Мастера филиала для формы записи (публично)',
    description:
      'Все активные мастера/админы филиала (без фильтра «на лендинге»). Опционально serviceId — по staff_services.',
  })
  @ApiQuery({
    name: 'serviceId',
    required: false,
    isArray: true,
    description: 'Фильтр после выбора услуг: ?serviceId=srv_a&serviceId=srv_b',
  })
  getPublicBookableMasters(
    @Param('studioId') studioId: string,
    @Query('serviceId') serviceId?: string | string[],
  ) {
    const ids = serviceId == null ? [] : Array.isArray(serviceId) ? serviceId : [serviceId];
    return this.landingService.getPublicBookableMasters(studioId, ids);
  }

  @Public()
  @Get('landing/studios/:studioId/availability')
  @ApiOperation({
    summary: 'Свободные слоты для формы записи (публично)',
    description: 'date=YYYY-MM-DD, serviceId обязателен; staffUserId опционален (фильтр мастера).',
  })
  @ApiQuery({ name: 'date', required: true })
  @ApiQuery({ name: 'serviceId', required: true })
  @ApiQuery({ name: 'staffUserId', required: false })
  getPublicAvailability(
    @Param('studioId') studioId: string,
    @Query('date') date: string,
    @Query('serviceId') serviceId: string,
    @Query('staffUserId') staffUserId?: string,
  ) {
    return this.landingService.getPublicAvailability(
      studioId,
      date,
      serviceId,
      staffUserId,
    );
  }

  @Public()
  @Post('landing/booking-request')
  @ApiOperation({
    summary: 'Отправка формы «Запись в удобное время» (публично)',
    description:
      'Полная запись при startAt+serviceId+staffUserId; иначе заявка на перезвон (notes).',
  })
  @ApiResponse({ status: 201 })
  submitBookingRequest(@Body() dto: LandingBookingRequestDto) {
    return this.landingService.submitBookingRequest(dto);
  }

  // --- Masters ---

  // Публичный список мастеров для лендинга
  @Public()
  @Get('studios/:studioId/landing/masters')
  @ApiOperation({ summary: 'Список мастеров для лендинга с конфигурацией видимости и порядка' })
  @ApiResponse({ status: 200 })
  async getMasters(
    @Param('studioId') studioId: string,
  ) {
    return this.landingService.getMasters(studioId);
  }

  @Patch('studios/:studioId/landing/masters')
  @UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DEVELOPER, UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Обновить список мастеров для лендинга (галочки + порядок)' })
  @ApiResponse({ status: 200, description: 'Список мастеров обновлён' })
  async updateMasters(
    @Param('studioId') studioId: string,
    @Body() dto: UpdateLandingMastersDto,
    @CurrentUser() user: any,
  ) {
    return this.landingService.updateMasters(
      studioId,
      dto,
      user?.role,
      user?.studioId,
    );
  }

  // --- Services ---

  /**
   * Каталог услуг (CRM) для админки: выпадающий список при добавлении карточки на лендинг.
   * Не использовать GET .../landing/services — он отдаёт уже созданные карточки, не справочник услуг.
   */
  @Get('studios/:studioId/landing/service-catalog')
  @UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DEVELOPER, UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({
    summary: 'Каталог услуг для выбора в карточке лендинга (админка)',
    description:
      'Тот же состав, что GET /services?studioId=… (с полем isOfferedInStudio). Для селекта «Услуга» в модалке добавления карточки.',
  })
  @ApiResponse({ status: 200 })
  async getServiceCatalogForLanding(
    @Param('studioId') studioId: string,
    @CurrentUser() user: any,
  ) {
    return this.landingService.getServiceCatalogForLandingCards(
      studioId,
      user?.role,
      user?.studioId,
      user?.organizationId,
    );
  }

  // Публичный список карточек услуг для лендинга (уже настроенные блоки, не справочник услуг)
  @Public()
  @Get('studios/:studioId/landing/services')
  @ApiOperation({
    summary: 'Карточки услуг для лендинга (публично)',
    description: 'Сохранённые карточки с картинками/текстами. Для выпадающего списка услуг в админке — GET .../landing/service-catalog.',
  })
  @ApiResponse({ status: 200 })
  async getServiceCards(
    @Param('studioId') studioId: string,
  ) {
    return this.landingService.getServiceCards(studioId);
  }

  @Post('studios/:studioId/landing/services')
  @UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DEVELOPER, UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Создать карточку услуги для лендинга' })
  @ApiResponse({ status: 201 })
  async createServiceCard(
    @Param('studioId') studioId: string,
    @Body() dto: CreateLandingServiceCardDto,
    @CurrentUser() user: any,
  ) {
    return this.landingService.createServiceCard(
      studioId,
      dto,
      user?.role,
      user?.studioId,
    );
  }

  @Patch('studios/:studioId/landing/services/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DEVELOPER, UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Обновить карточку услуги (текст, картинка)' })
  @ApiResponse({ status: 200 })
  async updateServiceCard(
    @Param('studioId') studioId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLandingServiceCardDto,
    @CurrentUser() user: any,
  ) {
    return this.landingService.updateServiceCard(
      studioId,
      id,
      dto,
      user?.role,
      user?.studioId,
    );
  }

  @Delete('studios/:studioId/landing/services/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DEVELOPER, UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Удалить карточку услуги с лендинга' })
  @ApiResponse({ status: 200 })
  async deleteServiceCard(
    @Param('studioId') studioId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.landingService.deleteServiceCard(
      studioId,
      id,
      user?.role,
      user?.studioId,
    );
  }

  @Patch('studios/:studioId/landing/services/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DEVELOPER, UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Обновить порядок карточек услуг (drag&drop)' })
  @ApiResponse({ status: 200 })
  async reorderServiceCards(
    @Param('studioId') studioId: string,
    @Body() dto: ReorderLandingServiceCardsDto,
    @CurrentUser() user: any,
  ) {
    return this.landingService.reorderServiceCards(
      studioId,
      dto,
      user?.role,
      user?.studioId,
    );
  }
}
