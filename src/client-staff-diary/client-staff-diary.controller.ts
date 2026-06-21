import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
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
import { ClientStaffDiaryService } from './client-staff-diary.service';
import { CreateClientStaffDiaryEntryDto } from './dto/create-client-staff-diary-entry.dto';
import { UpdateClientStaffDiaryEntryDto } from './dto/update-client-staff-diary-entry.dto';
import { listClientStaffDiaryVisibilityOptions } from './client-staff-diary.constants';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { Roles, UserRole } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('client-staff-diary')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class ClientStaffDiaryController {
  constructor(private readonly clientStaffDiaryService: ClientStaffDiaryService) {}

  @Get('staff-diary/visibility-options')
  @Roles(
    UserRole.MASTER,
    UserRole.OWNER,
    UserRole.DEPUTY_OWNER,
    UserRole.DEVELOPER,
    UserRole.SERVICE,
    UserRole.ADMIN,
    UserRole.MANAGER,
  )
  @ApiOperation({
    summary: 'Типы заметок дневника (для селекта в UI)',
    description:
      'PRIVATE — в UI описание «видите только вы»; фактически owner/deputy тоже видят личные.',
  })
  listVisibilityOptions() {
    return listClientStaffDiaryVisibilityOptions();
  }

  @Get('appointments/:appointmentId/staff-diary')
  @Roles(
    UserRole.MASTER,
    UserRole.OWNER,
    UserRole.DEPUTY_OWNER,
    UserRole.DEVELOPER,
    UserRole.SERVICE,
    UserRole.ADMIN,
    UserRole.MANAGER,
  )
  @ApiOperation({
    summary: 'Дневник мастера по клиенту из контекста записи',
    description:
      'MASTER: свои личные + все общие. ADMIN/MANAGER: только общие. OWNER/DEPUTY/SERVICE: все.',
  })
  @ApiResponse({ status: 200 })
  listForAppointment(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user?: any,
  ) {
    return this.clientStaffDiaryService.listForAppointment(
      appointmentId,
      user?.role,
      user?.studioId,
      user?.userId,
      user?.organizationId,
    );
  }

  @Post('appointments/:appointmentId/staff-diary')
  @Roles(UserRole.MASTER)
  @ApiOperation({
    summary: 'Добавить заметку в дневник (из записи)',
    description:
      'visibility: PRIVATE (по умолчанию) или SHARED. clientId и appointmentId подставляются на сервере.',
  })
  @ApiResponse({ status: 201 })
  createForAppointment(
    @Param('appointmentId') appointmentId: string,
    @Body() dto: CreateClientStaffDiaryEntryDto,
    @CurrentUser() user?: any,
  ) {
    return this.clientStaffDiaryService.createForAppointment(
      appointmentId,
      dto,
      user?.role,
      user?.studioId,
      user?.userId,
      user?.organizationId,
    );
  }

  @Get('clients/:clientId/staff-diary')
  @Roles(
    UserRole.OWNER,
    UserRole.DEPUTY_OWNER,
    UserRole.DEVELOPER,
    UserRole.SERVICE,
    UserRole.ADMIN,
    UserRole.MANAGER,
  )
  @ApiOperation({
    summary: 'Заметки мастеров по клиенту',
    description:
      'OWNER/DEPUTY/SERVICE: все типы. ADMIN/MANAGER: только общие (SHARED).',
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER: контекст организации',
  })
  @ApiResponse({ status: 200 })
  listForClient(
    @Param('clientId') clientId: string,
    @Query('organizationId') organizationId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.clientStaffDiaryService.listForClient(
      clientId,
      user?.role,
      user?.organizationId,
      organizationId,
      user?.userId,
    );
  }

  @Patch('staff-diary/:id')
  @Roles(UserRole.MASTER)
  @ApiOperation({ summary: 'Изменить свою заметку дневника (текст и тип)' })
  @ApiResponse({ status: 200 })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientStaffDiaryEntryDto,
    @CurrentUser() user?: any,
  ) {
    return this.clientStaffDiaryService.update(id, dto, user?.role, user?.userId);
  }

  @Delete('staff-diary/:id')
  @Roles(UserRole.MASTER)
  @ApiOperation({ summary: 'Удалить свою заметку дневника' })
  @ApiResponse({ status: 200 })
  remove(@Param('id') id: string, @CurrentUser() user?: any) {
    return this.clientStaffDiaryService.remove(id, user?.role, user?.userId);
  }
}
