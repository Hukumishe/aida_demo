import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LandingService } from './landing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { Roles, UserRole } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateLandingPromotionDto } from './dto/create-promotion.dto';
import { UpdateLandingPromotionDto } from './dto/update-promotion.dto';
import { UpdateLandingMastersDto } from './dto/update-masters.dto';
import { CreateLandingServiceCardDto } from './dto/create-service-card.dto';
import { UpdateLandingServiceCardDto } from './dto/update-service-card.dto';
import { ReorderLandingServiceCardsDto } from './dto/reorder-service-cards.dto';

@ApiTags('landing')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class LandingController {
  constructor(private readonly landingService: LandingService) {}

  // --- Promotions ---

  @Get('studios/:studioId/landing/promotions')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Список акций для лендинга по студии' })
  @ApiResponse({ status: 200, description: 'Список акций с промокодами и услугами' })
  async getPromotions(
    @Param('studioId', ParseUUIDPipe) studioId: string,
  ) {
    return this.landingService.getPromotions(studioId);
  }

  @Post('studios/:studioId/landing/promotions')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Создать акцию для лендинга (скидка или 1+1)' })
  @ApiResponse({ status: 201, description: 'Акция создана' })
  async createPromotion(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Body() dto: CreateLandingPromotionDto,
    @CurrentUser() user: any,
  ) {
    return this.landingService.createPromotion(
      studioId,
      dto,
      user?.role,
      user?.studioId,
    );
  }

  @Patch('studios/:studioId/landing/promotions/:id')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Обновить акцию' })
  @ApiResponse({ status: 200, description: 'Акция обновлена' })
  async updatePromotion(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLandingPromotionDto,
    @CurrentUser() user: any,
  ) {
    return this.landingService.updatePromotion(
      studioId,
      id,
      dto,
      user?.role,
      user?.studioId,
    );
  }

  @Delete('studios/:studioId/landing/promotions/:id')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Удалить акцию' })
  @ApiResponse({ status: 200, description: 'Акция удалена' })
  async deletePromotion(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.landingService.deletePromotion(
      studioId,
      id,
      user?.role,
      user?.studioId,
    );
  }

  // --- Masters ---

  @Get('studios/:studioId/landing/masters')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Список мастеров для лендинга с конфигурацией видимости и порядка' })
  @ApiResponse({ status: 200 })
  async getMasters(
    @Param('studioId', ParseUUIDPipe) studioId: string,
  ) {
    return this.landingService.getMasters(studioId);
  }

  @Patch('studios/:studioId/landing/masters')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Обновить список мастеров для лендинга (галочки + порядок)' })
  @ApiResponse({ status: 200, description: 'Список мастеров обновлён' })
  async updateMasters(
    @Param('studioId', ParseUUIDPipe) studioId: string,
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

  @Get('studios/:studioId/landing/services')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Карточки услуг для лендинга' })
  @ApiResponse({ status: 200 })
  async getServiceCards(
    @Param('studioId', ParseUUIDPipe) studioId: string,
  ) {
    return this.landingService.getServiceCards(studioId);
  }

  @Post('studios/:studioId/landing/services')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Создать карточку услуги для лендинга' })
  @ApiResponse({ status: 201 })
  async createServiceCard(
    @Param('studioId', ParseUUIDPipe) studioId: string,
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
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Обновить карточку услуги (текст, картинка)' })
  @ApiResponse({ status: 200 })
  async updateServiceCard(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Param('id', ParseUUIDPipe) id: string,
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
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Удалить карточку услуги с лендинга' })
  @ApiResponse({ status: 200 })
  async deleteServiceCard(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Param('id', ParseUUIDPipe) id: string,
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
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Обновить порядок карточек услуг (drag&drop)' })
  @ApiResponse({ status: 200 })
  async reorderServiceCards(
    @Param('studioId', ParseUUIDPipe) studioId: string,
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
