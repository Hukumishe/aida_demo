import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NextbotBirthdaySettingsService } from './nextbot-birthday-settings.service';
import { UpsertBirthdaySettingsDto } from './dto/upsert-birthday-settings.dto';

@ApiTags('nextbot-birthday')
@Controller('studios/:studioId/nextbot-birthday')
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class NextbotBirthdayController {
  constructor(private readonly settingsService: NextbotBirthdaySettingsService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Настройки автосообщения «День рождения»' })
  getSettings(
    @Param('studioId') studioId: string,
    @CurrentUser() user: { role: string; organizationId?: string },
  ) {
    return this.settingsService.getSettings(studioId, user.role, user.organizationId);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Сохранить настройки «День рождения»' })
  upsertSettings(
    @Param('studioId') studioId: string,
    @Body() dto: UpsertBirthdaySettingsDto,
    @CurrentUser() user: { role: string; organizationId?: string },
  ) {
    return this.settingsService.upsertSettings(
      studioId,
      dto,
      user.role,
      user.organizationId,
    );
  }

  @Get('logs')
  @ApiOperation({ summary: 'Журнал поздравлений с днём рождения' })
  findLogs(
    @Param('studioId') studioId: string,
    @CurrentUser() user: { role: string; organizationId?: string },
  ) {
    return this.settingsService.findLogs(studioId, user.organizationId, user.role);
  }
}
