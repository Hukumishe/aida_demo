import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
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
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { SetServiceStudioOfferingDto } from './dto/set-service-studio-offering.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('services')
@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  // --- Категории (статические пути до :id) ---

  @Get('categories')
  @ApiOperation({
    summary: 'Список категорий услуг организации',
    description:
      'Опционально `studioId` — добавить `isOfferedInStudio` для выбранного филиала (как у услуг).',
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER: категории указанной организации',
  })
  @ApiQuery({
    name: 'studioId',
    required: false,
    description: 'Филиал для флага isOfferedInStudio (переключение — PATCH categories/.../studio-offering)',
  })
  @ApiResponse({ status: 200 })
  listCategories(
    @Query('organizationId') organizationId: string | undefined,
    @Query('studioId') studioId: string | undefined,
    @CurrentUser() user?: any,
  ) {
    return this.servicesService.findCategories(
      user?.role,
      user?.studioId,
      user?.organizationId,
      organizationId,
      studioId,
    );
  }

  @Post('categories')
  @ApiOperation({ summary: 'Создать категорию услуг' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER: создать в указанной организации',
  })
  @ApiResponse({ status: 201 })
  createCategory(
    @Body() dto: CreateServiceCategoryDto,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user?: any,
  ) {
    return this.servicesService.createCategory(
      dto,
      user?.role,
      user?.studioId,
      user?.organizationId,
      organizationId,
    );
  }

  @Patch('categories/:categoryId/studio-offering')
  @ApiOperation({
    summary: 'Включить/выключить категорию только в выбранном филиале',
    description:
      'Тело: `studioId` + `offered`. Каталог сети и другие филиалы не меняются; услуги в категории наследуют недоступность здесь.',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  setCategoryStudioOffering(
    @Param('categoryId') categoryId: string,
    @Body() dto: SetServiceStudioOfferingDto,
    @CurrentUser() user?: any,
  ) {
    return this.servicesService.setStudioCategoryOffering(
      categoryId,
      dto.studioId,
      dto.offered,
      user?.role,
      user?.studioId,
      user?.organizationId,
    );
  }

  @Patch('categories/:categoryId')
  @ApiOperation({ summary: 'Изменить категорию услуг' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateServiceCategoryDto,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user?: any,
  ) {
    return this.servicesService.updateCategory(
      categoryId,
      dto,
      user?.role,
      user?.studioId,
      user?.organizationId,
      organizationId,
    );
  }

  @Delete('categories/:categoryId')
  @ApiOperation({
    summary: 'Удалить категорию',
    description: 'У услуг с этой категорией поле categoryId станет null',
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  deleteCategory(
    @Param('categoryId') categoryId: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user?: any,
  ) {
    return this.servicesService.deleteCategory(
      categoryId,
      user?.role,
      user?.studioId,
      user?.organizationId,
      organizationId,
    );
  }

  // --- Каталог услуг (один на организацию) ---

  @Get()
  @ApiOperation({
    summary: 'Список услуг организации',
    description:
      'Опционально `studioId` в query — добавить `isOfferedInStudio` для выбранного филиала.',
  })
  @ApiQuery({
    name: 'studioId',
    required: false,
    description: 'Филиал для флага isOfferedInStudio (переключение доступа — отдельный PATCH studio-offering)',
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER: каталог указанной организации',
  })
  @ApiResponse({ status: 200, description: 'List of services' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async findAll(
    @Query('studioId') studioId: string | undefined,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user?: any,
  ) {
    try {
      return await this.servicesService.findAll(
        user?.role,
        user?.studioId,
        user?.organizationId,
        organizationId,
        studioId,
      );
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

  @Post()
  @ApiOperation({ summary: 'Создать услугу в каталоге организации' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER',
  })
  @ApiResponse({ status: 201, description: 'Service created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Body() createServiceDto: CreateServiceDto,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user?: any,
  ) {
    return this.servicesService.create(
      createServiceDto,
      user?.role,
      user?.studioId,
      user?.organizationId,
      organizationId,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить услугу' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER',
  })
  @ApiResponse({ status: 200, description: 'Service updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async update(
    @Param('id') id: string,
    @Body() updateServiceDto: UpdateServiceDto,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user?: any,
  ) {
    return this.servicesService.update(
      id,
      updateServiceDto,
      user?.role,
      user?.studioId,
      user?.organizationId,
      organizationId,
    );
  }

  @Patch(':id/studio-offering')
  @ApiOperation({
    summary: 'Включить/выключить услугу только в выбранном филиале',
    description:
      'Тело: `studioId` + `offered`. Не меняет каталог организации и другие филиалы.',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  setStudioOffering(
    @Param('id') id: string,
    @Body() dto: SetServiceStudioOfferingDto,
    @CurrentUser() user?: any,
  ) {
    return this.servicesService.setStudioServiceOffering(
      id,
      dto.studioId,
      dto.offered,
      user?.role,
      user?.studioId,
      user?.organizationId,
    );
  }
}
