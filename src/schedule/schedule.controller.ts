import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDayDto } from './dto/create-schedule-day.dto';
import { UpdateScheduleDayDto } from './dto/update-schedule-day.dto';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('schedule')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('studios/:studioId/schedule')
  @ApiOperation({ summary: 'Get schedule for a studio' })
  @ApiQuery({ name: 'date', required: false, description: 'Filter by date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'List of schedule days' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Query('date') date?: string,
    @CurrentUser() user?: any,
  ) {
    return this.scheduleService.findAll(studioId, date, user?.role, user?.studioId);
  }

  @Post('studios/:studioId/schedule')
  @ApiOperation({ summary: 'Create or update a schedule day' })
  @ApiResponse({ status: 201, description: 'Schedule day created/updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Body() createScheduleDayDto: CreateScheduleDayDto,
    @CurrentUser() user?: any,
  ) {
    return this.scheduleService.create(studioId, createScheduleDayDto, user?.role, user?.studioId);
  }

  @Post('studios/:studioId/schedule/generate')
  @ApiOperation({ summary: 'Generate schedule from template (5/2 or 6/1)' })
  @ApiResponse({ status: 201, description: 'Schedule generated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async generate(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Body() generateScheduleDto: GenerateScheduleDto,
    @CurrentUser() user?: any,
  ) {
    return this.scheduleService.generate(studioId, generateScheduleDto, user?.role, user?.studioId);
  }

  @Patch('schedule/day/:id')
  @ApiOperation({ summary: 'Update schedule day' })
  @ApiResponse({ status: 200, description: 'Schedule day updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Schedule day not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateScheduleDayDto: UpdateScheduleDayDto,
    @CurrentUser() user?: any,
  ) {
    return this.scheduleService.update(id, updateScheduleDayDto, user?.role, user?.studioId);
  }
}

