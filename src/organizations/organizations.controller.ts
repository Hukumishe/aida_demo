import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, UserRole } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UsersService } from '../users/users.service';
import { CreateOrganizationOwnerDto } from '../users/dto/create-organization-owner.dto';

@ApiTags('organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly usersService: UsersService,
  ) {}

  @Get('resolve/:slug')
  @Public()
  @ApiOperation({
    summary: 'Найти организацию по slug (публичный, без JWT)',
    description: 'Возвращает id, name, slug, ianaTimezone. Используется фронтом для определения тенанта по hostname.',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  resolveBySlug(@Param('slug') slug: string) {
    return this.organizationsService.findBySlug(slug);
  }

  @Get()
  @Roles(UserRole.DEVELOPER)
  @ApiOperation({ summary: 'Список всех организаций (только DEVELOPER)' })
  @ApiResponse({ status: 200 })
  findAll() {
    return this.organizationsService.findAll();
  }

  @Get(':organizationId')
  @Roles(UserRole.DEVELOPER)
  @ApiOperation({ summary: 'Организация по id (только DEVELOPER)' })
  @ApiResponse({ status: 404 })
  findOne(@Param('organizationId') organizationId: string) {
    return this.organizationsService.findOne(organizationId);
  }

  @Post()
  @Roles(UserRole.DEVELOPER)
  @ApiOperation({ summary: 'Создать организацию (только DEVELOPER)' })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(dto);
  }

  @Patch(':organizationId')
  @Roles(UserRole.DEVELOPER)
  @ApiOperation({
    summary: 'Обновить организацию (только DEVELOPER)',
    description: 'Частичное обновление; сейчас поддерживается ianaTimezone.',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  update(
    @Param('organizationId') organizationId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(organizationId, dto);
  }

  @Post(':organizationId/owners')
  @Roles(UserRole.DEVELOPER)
  @ApiOperation({
    summary: 'Создать владельца (OWNER) для организации',
    description:
      'Без привязки к филиалу (studioId = null). Для новой организации до создания студии. Только DEVELOPER.',
  })
  @ApiResponse({ status: 201, description: 'OWNER создан' })
  @ApiResponse({ status: 400, description: 'Телефон или email уже заняты' })
  @ApiResponse({ status: 404, description: 'Организация не найдена' })
  createOwner(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateOrganizationOwnerDto,
    @CurrentUser() user: { role: string },
  ) {
    return this.usersService.createOrganizationOwner(organizationId, dto, user.role);
  }
}
