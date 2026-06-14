import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { AddStaffServiceDto } from './dto/add-staff-service.dto';
import { CreateServiceOverrideDto } from './dto/create-service-override.dto';
import { UpdateServiceOverrideDto } from './dto/update-service-override.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../common/decorators/roles.decorator';

@ApiTags('staff')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('studios/:studioId/staff/network')
  @ApiOperation({
    summary: 'Сетевой персонал организации (без привязки к филиалу)',
    description:
      'Пользователи с `studioId = null`: OWNER, DEPUTY_OWNER, SERVICE, MANAGER. Один и тот же список при любом выбранном филиале сети. Для блока «администрирование» на экране сотрудников. ' +
      'Параметр includeDismissed=true добавляет уволенных (isActive=false).',
  })
  @ApiResponse({ status: 200, description: 'List of organization-level staff' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findNetworkStaff(
    @Param('studioId') studioId: string,
    @CurrentUser() user: any,
    @Query('includeDismissed') includeDismissed?: string,
  ) {
    const includeDismissedFlag =
      includeDismissed === 'true' || includeDismissed === '1' || includeDismissed === 'yes';
    return this.usersService.findNetworkStaff(
      studioId,
      user.role,
      user.studioId,
      user.organizationId,
      includeDismissedFlag,
      user.userId,
    );
  }

  @Get('studios/:studioId/staff')
  @ApiOperation({
    summary: 'Get all staff members for a studio',
    description:
      'Возвращает сотрудников филиала. При includeNetwork=true дополнительно включает сетевых сотрудников организации (studioId = null). ' +
      'При includeDismissed=true в выборку попадают и уволенные (isActive=false), чтобы можно было восстановить.',
  })
  @ApiResponse({ status: 200, description: 'List of staff members' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @Param('studioId') studioId: string,
    @CurrentUser() user: any,
    @Query('includeNetwork') includeNetwork?: string,
    @Query('includeDismissed') includeDismissed?: string,
  ) {
    const includeNetworkFlag =
      includeNetwork === 'true' || includeNetwork === '1' || includeNetwork === 'yes';
    const includeDismissedFlag =
      includeDismissed === 'true' || includeDismissed === '1' || includeDismissed === 'yes';
    return this.usersService.findAll(
      studioId,
      user.role,
      user.studioId,
      user.organizationId,
      includeNetworkFlag,
      includeDismissedFlag,
      user.userId,
    );
  }

  @Post('studios/:studioId/staff')
  @ApiOperation({ summary: 'Create a new staff member' })
  @ApiResponse({ status: 201, description: 'Staff member created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Param('studioId') studioId: string,
    @Body() createStaffDto: CreateStaffDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.create(studioId, createStaffDto, user.role, user.studioId);
  }

  @Patch('staff/:userId')
  @ApiOperation({
    summary: 'Update staff member',
    description:
      'Email, phone, role, password, филиалы. Админ может у мастера менять только `phone`. Телефон: OWNER, DEPUTY_OWNER, SERVICE, DEVELOPER, ADMIN.',
  })
  @ApiResponse({ status: 200, description: 'Staff member updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  async update(
    @Param('userId') userId: string,
    @Body() updateStaffDto: UpdateStaffDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.update(
      userId,
      updateStaffDto,
      user.role,
      user.studioId,
      user.userId,
    );
  }

  @Get('staff/:staffUserId/services')
  @ApiOperation({ summary: 'Get all services for a staff member' })
  @ApiResponse({ status: 200, description: 'List of staff services' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  async getStaffServices(
    @Param('staffUserId') staffUserId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.getStaffServices(
      staffUserId,
      user.role,
      user.studioId,
      user.userId,
    );
  }

  @Post('staff/:staffUserId/services')
  @ApiOperation({ summary: 'Add a service to a staff member' })
  @ApiResponse({ status: 201, description: 'Service added to staff member' })
  @ApiResponse({ status: 400, description: 'Bad request (service already assigned or wrong studio)' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Staff member or service not found' })
  async addService(
    @Param('staffUserId') staffUserId: string,
    @Body() addStaffServiceDto: AddStaffServiceDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.addService(
      staffUserId,
      addStaffServiceDto.serviceId,
      user.role,
      user.studioId,
      user.userId,
    );
  }

  @Delete('staff/:staffUserId/services/:serviceId')
  @ApiOperation({ summary: 'Remove a service from a staff member' })
  @ApiResponse({ status: 200, description: 'Service removed from staff member' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Staff member or service assignment not found' })
  async removeService(
    @Param('staffUserId') staffUserId: string,
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.removeService(
      staffUserId,
      serviceId,
      user.role,
      user.studioId,
      user.userId,
    );
  }

  @Get('staff/:userId/profile')
  @ApiOperation({ summary: 'Get staff member profile' })
  @ApiResponse({ status: 200, description: 'Staff member profile' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  async getStaffProfile(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.getStaffProfile(userId, user.role, user.studioId, user.userId);
  }

  @Patch('staff/:userId/profile')
  @ApiOperation({ summary: 'Update staff member profile' })
  @ApiResponse({ status: 200, description: 'Staff member profile updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  async updateStaffProfile(
    @Param('userId') userId: string,
    @Body() updateProfileDto: UpdateStaffProfileDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.updateStaffProfile(
      userId,
      updateProfileDto,
      user.role,
      user.studioId,
      user.userId,
    );
  }

  @Delete('staff/:userId')
  @ApiOperation({ summary: 'Dismiss staff member (revoke access, data preserved)' })
  @ApiResponse({ status: 200, description: 'Staff member dismissed' })
  @ApiResponse({ status: 400, description: 'Bad request (cannot dismiss OWNER or already dismissed)' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  async remove(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.remove(userId, user.role, user.studioId, user.userId);
  }

  @Post('staff/:userId/restore')
  @ApiOperation({
    summary: 'Restore dismissed staff member',
    description:
      'Восстанавливает уволенного сотрудника: isActive = true. Данные, роль и привязки к услугам не менялись при увольнении — доступ в JWT снова действует.',
  })
  @ApiResponse({ status: 200, description: 'Staff member restored' })
  @ApiResponse({ status: 400, description: 'Bad request (already active or cannot restore role)' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  async restore(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.restore(userId, user.role, user.studioId, user.userId);
  }

  @Delete('staff/:userId/hard')
  @Roles(UserRole.DEVELOPER)
  @ApiOperation({
    summary: 'Hard delete staff member (DEVELOPER only)',
    description:
      'Полностью удаляет сотрудника из БД (без soft-delete). Использовать с осторожностью.',
  })
  @ApiResponse({ status: 200, description: 'Staff member permanently deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden - DEVELOPER only' })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  async hardDelete(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.hardDelete(userId, user.role);
  }

  @Get('staff/:staffUserId/services/:serviceId/override')
  @ApiOperation({ summary: 'Get service override for a staff member' })
  @ApiResponse({ status: 200, description: 'Service override details' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Override not found' })
  async getServiceOverride(
    @Param('staffUserId') staffUserId: string,
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.getServiceOverride(staffUserId, serviceId, user.role, user.studioId);
  }

  @Get('staff/:staffUserId/overrides')
  @ApiOperation({ summary: 'Get all service overrides for a staff member' })
  @ApiResponse({ status: 200, description: 'List of service overrides' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  async getStaffServiceOverrides(
    @Param('staffUserId') staffUserId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.getStaffServiceOverrides(staffUserId, user.role, user.studioId);
  }

  @Post('staff/:staffUserId/services/:serviceId/override')
  @ApiOperation({ summary: 'Create or set service override for a staff member' })
  @ApiResponse({ status: 201, description: 'Service override created' })
  @ApiResponse({ status: 400, description: 'Bad request (service not assigned or override already exists)' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Staff member or service not found' })
  async createServiceOverride(
    @Param('staffUserId') staffUserId: string,
    @Param('serviceId') serviceId: string,
    @Body() createOverrideDto: CreateServiceOverrideDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.createServiceOverride(
      staffUserId,
      serviceId,
      createOverrideDto,
      user.role,
      user.studioId,
    );
  }

  @Patch('staff/:staffUserId/services/:serviceId/override')
  @ApiOperation({ summary: 'Update service override for a staff member' })
  @ApiResponse({ status: 200, description: 'Service override updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Override not found' })
  async updateServiceOverride(
    @Param('staffUserId') staffUserId: string,
    @Param('serviceId') serviceId: string,
    @Body() updateOverrideDto: UpdateServiceOverrideDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.updateServiceOverride(
      staffUserId,
      serviceId,
      updateOverrideDto,
      user.role,
      user.studioId,
    );
  }

  @Delete('staff/:staffUserId/services/:serviceId/override')
  @ApiOperation({ summary: 'Delete service override for a staff member' })
  @ApiResponse({ status: 200, description: 'Service override deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Override not found' })
  async deleteServiceOverride(
    @Param('staffUserId') staffUserId: string,
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.deleteServiceOverride(staffUserId, serviceId, user.role, user.studioId);
  }
}




