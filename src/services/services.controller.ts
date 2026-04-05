import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { SetServiceStudioOfferingDto } from './dto/set-service-studio-offering.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('services')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get('studios/:studioId/services')
  @ApiOperation({ summary: 'Get all services for a studio' })
  @ApiResponse({ status: 200, description: 'List of services' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async findAll(
    @Param('studioId') studioId: string,
    @CurrentUser() user?: any,
  ) {
    try {
      return await this.servicesService.findAll(studioId, user?.role, user?.studioId);
    } catch (error) {
      console.error('Error in ServicesController.findAll:', {
        studioId,
        userRole: user?.role,
        userStudioId: user?.studioId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  @Post('studios/:studioId/services')
  @ApiOperation({ summary: 'Create a new service' })
  @ApiResponse({ status: 201, description: 'Service created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Param('studioId') studioId: string,
    @Body() createServiceDto: CreateServiceDto,
    @CurrentUser() user?: any,
  ) {
    return this.servicesService.create(studioId, createServiceDto, user?.role, user?.studioId);
  }

  @Patch('studios/:studioId/services/:id')
  @ApiOperation({ summary: 'Update service' })
  @ApiResponse({ status: 200, description: 'Service updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async update(
    @Param('studioId') studioId: string,
    @Param('id') id: string,
    @Body() updateServiceDto: UpdateServiceDto,
    @CurrentUser() user?: any,
  ) {
    return this.servicesService.update(studioId, id, updateServiceDto, user?.role, user?.studioId);
  }

  @Patch('studios/:studioId/services/:id/studio-offering')
  @ApiOperation({
    summary: 'Включить/выключить услугу только в этом филиале',
    description:
      'Не меняет каталог организации и другие филиалы. Поле `isActive` у услуги — отдельно (на всю сеть).',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  setStudioOffering(
    @Param('studioId') studioId: string,
    @Param('id') id: string,
    @Body() dto: SetServiceStudioOfferingDto,
    @CurrentUser() user?: any,
  ) {
    return this.servicesService.setStudioServiceOffering(
      studioId,
      id,
      dto.offered,
      user?.role,
      user?.studioId,
    );
  }

  // --- Категории услуг ---

  @Get('studios/:studioId/service-categories')
  @ApiOperation({ summary: 'Список категорий услуг студии' })
  @ApiResponse({ status: 200 })
  listCategories(
    @Param('studioId') studioId: string,
    @CurrentUser() user?: any,
  ) {
    return this.servicesService.findCategories(studioId, user?.role, user?.studioId);
  }

  @Post('studios/:studioId/service-categories')
  @ApiOperation({ summary: 'Создать категорию услуг' })
  @ApiResponse({ status: 201 })
  createCategory(
    @Param('studioId') studioId: string,
    @Body() dto: CreateServiceCategoryDto,
    @CurrentUser() user?: any,
  ) {
    return this.servicesService.createCategory(studioId, dto, user?.role, user?.studioId);
  }

  @Patch('studios/:studioId/service-categories/:categoryId')
  @ApiOperation({ summary: 'Изменить категорию услуг' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  updateCategory(
    @Param('studioId') studioId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateServiceCategoryDto,
    @CurrentUser() user?: any,
  ) {
    return this.servicesService.updateCategory(
      studioId,
      categoryId,
      dto,
      user?.role,
      user?.studioId,
    );
  }

  @Delete('studios/:studioId/service-categories/:categoryId')
  @ApiOperation({
    summary: 'Удалить категорию',
    description: 'У услуг с этой категорией поле categoryId станет null',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  deleteCategory(
    @Param('studioId') studioId: string,
    @Param('categoryId') categoryId: string,
    @CurrentUser() user?: any,
  ) {
    return this.servicesService.deleteCategory(
      studioId,
      categoryId,
      user?.role,
      user?.studioId,
    );
  }
}




