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
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('appointments')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('studios/:studioId/appointments')
  @ApiOperation({ summary: 'Get all appointments for a studio' })
  @ApiQuery({ name: 'date', required: false, description: 'Filter by date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'List of appointments' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Query('date') date?: string,
    @CurrentUser() user?: any,
  ) {
    return this.appointmentsService.findAll(
      studioId,
      date,
      user?.role,
      user?.studioId,
      user?.userId,
    );
  }

  @Post('studios/:studioId/appointments')
  @ApiOperation({ summary: 'Create a new appointment' })
  @ApiResponse({ status: 201, description: 'Appointment created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Conflict - time slot not available' })
  async create(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Body() createAppointmentDto: CreateAppointmentDto,
    @CurrentUser() user?: any,
  ) {
    return this.appointmentsService.create(studioId, createAppointmentDto, user?.role, user?.studioId);
  }

  @Patch('appointments/:id')
  @ApiOperation({ summary: 'Update appointment' })
  @ApiResponse({ status: 200, description: 'Appointment updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  @ApiResponse({ status: 409, description: 'Conflict - time slot not available' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
    @CurrentUser() user?: any,
  ) {
    return this.appointmentsService.update(
      id,
      updateAppointmentDto,
      user?.role,
      user?.studioId,
      user?.userId,
    );
  }

  @Post('appointments/:id/cancel')
  @ApiOperation({ summary: 'Cancel appointment' })
  @ApiResponse({ status: 200, description: 'Appointment cancelled' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: any,
  ) {
    return this.appointmentsService.cancel(id, user?.role, user?.studioId, user?.userId);
  }

  @Post('appointments/:id/arrived')
  @ApiOperation({ summary: 'Mark appointment as arrived' })
  @ApiResponse({ status: 200, description: 'Appointment marked as arrived' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async markArrived(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: any,
  ) {
    return this.appointmentsService.markArrived(id, user?.userId, user?.role, user?.studioId);
  }
}

