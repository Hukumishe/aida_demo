import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, UserRole } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PayrollService } from './payroll.service';
import { UpsertPayrollSettingsDto } from './dto/upsert-payroll-settings.dto';
import { PayrollReportQueryDto } from './dto/payroll-report-query.dto';

@ApiTags('payroll')
@Controller('organizations/:organizationId')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('staff/:staffUserId/payroll-settings')
  @Roles(UserRole.OWNER, UserRole.DEVELOPER, UserRole.MASTER)
  @ApiOperation({
    summary: 'Настройки комиссии сотрудника',
    description:
      'OWNER и DEVELOPER — любой сотрудник; MASTER — только свои настройки (просмотр).',
  })
  @ApiResponse({ status: 200 })
  getSettings(
    @Param('organizationId') organizationId: string,
    @Param('staffUserId') staffUserId: string,
    @CurrentUser() user?: { role: string; organizationId?: string; userId?: string },
  ) {
    return this.payrollService.getSettings(
      organizationId,
      staffUserId,
      user?.role,
      user?.organizationId,
      user?.userId,
    );
  }

  @Put('staff/:staffUserId/payroll-settings')
  @Roles(UserRole.OWNER, UserRole.DEVELOPER)
  @ApiOperation({
    summary: 'Сохранить настройки комиссии',
    description: 'OWNER и DEVELOPER.',
  })
  @ApiResponse({ status: 200 })
  upsertSettings(
    @Param('organizationId') organizationId: string,
    @Param('staffUserId') staffUserId: string,
    @Body() dto: UpsertPayrollSettingsDto,
    @CurrentUser() user?: { role: string; organizationId?: string; userId?: string },
  ) {
    return this.payrollService.upsertSettings(
      organizationId,
      staffUserId,
      dto,
      user?.role,
      user?.organizationId,
      user?.userId,
    );
  }

  @Get('payroll-report')
  @Roles(UserRole.OWNER, UserRole.DEVELOPER, UserRole.MASTER)
  @ApiOperation({
    summary: 'Отчёт по начислениям зарплаты за период',
    description:
      'OWNER и DEVELOPER — вся организация (фильтр staffUserId опционален); MASTER — только свои начисления.',
  })
  @ApiResponse({ status: 200 })
  getReport(
    @Param('organizationId') organizationId: string,
    @Query() query: PayrollReportQueryDto,
    @CurrentUser() user?: { role: string; organizationId?: string; userId?: string },
  ) {
    return this.payrollService.getReport(
      organizationId,
      query,
      user?.role,
      user?.organizationId,
      user?.userId,
    );
  }
}
