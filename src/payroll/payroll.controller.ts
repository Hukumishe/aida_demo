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

  @Get('payroll-settings')
  @Roles(UserRole.OWNER, UserRole.DEVELOPER, UserRole.MASTER)
  @ApiOperation({
    summary: 'Глобальные настройки комиссии организации',
    description: 'Одинаковые для всех мастеров. MASTER — только просмотр.',
  })
  @ApiResponse({ status: 200 })
  getSettings(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user?: { role: string; organizationId?: string },
  ) {
    return this.payrollService.getSettings(
      organizationId,
      user?.role,
      user?.organizationId,
    );
  }

  @Put('payroll-settings')
  @Roles(UserRole.OWNER, UserRole.DEVELOPER)
  @ApiOperation({ summary: 'Сохранить глобальные настройки комиссии' })
  @ApiResponse({ status: 200 })
  upsertSettings(
    @Param('organizationId') organizationId: string,
    @Body() dto: UpsertPayrollSettingsDto,
    @CurrentUser() user?: { role: string; organizationId?: string },
  ) {
    return this.payrollService.upsertSettings(
      organizationId,
      dto,
      user?.role,
      user?.organizationId,
    );
  }

  @Get('payroll-report')
  @Roles(UserRole.OWNER, UserRole.DEVELOPER, UserRole.MASTER)
  @ApiOperation({
    summary: 'Отчёт по начислениям за период',
    description:
      'OWNER/DEVELOPER — вся организация (staffUserId опционален); MASTER — только свои.',
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

  @Get('staff/:staffUserId/payroll')
  @Roles(UserRole.OWNER, UserRole.DEVELOPER, UserRole.MASTER)
  @ApiOperation({
    summary: 'Зарплата в карточке мастера',
    description:
      'Глобальные ставки организации + начисления этого мастера за период (from, to).',
  })
  @ApiResponse({ status: 200 })
  getStaffPayrollView(
    @Param('organizationId') organizationId: string,
    @Param('staffUserId') staffUserId: string,
    @Query() query: PayrollReportQueryDto,
    @CurrentUser() user?: { role: string; organizationId?: string; userId?: string },
  ) {
    return this.payrollService.getStaffPayrollView(
      organizationId,
      staffUserId,
      query,
      user?.role,
      user?.organizationId,
      user?.userId,
    );
  }
}
