import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UpsellsService } from './upsells.service';
import { CreateUpsellDto } from './dto/create-upsell.dto';
import { UpdateUpsellDto } from './dto/update-upsell.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('upsells')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class UpsellsController {
  constructor(private readonly upsellsService: UpsellsService) {}

  @Post('appointments/:appointmentId/upsells')
  @ApiOperation({ summary: 'Create a new upsell for an appointment' })
  @ApiResponse({ status: 201, description: 'Upsell created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Appointment or service not found' })
  @ApiResponse({ status: 400, description: 'Bad request - service not active' })
  async create(
    @Param('appointmentId') appointmentId: string,
    @Body() createUpsellDto: CreateUpsellDto,
    @CurrentUser() user?: any,
  ) {
    return this.upsellsService.create(
      appointmentId,
      createUpsellDto,
      user?.role,
      user?.studioId,
      user?.userId,
    );
  }

  @Get('appointments/:appointmentId/upsells')
  @ApiOperation({ summary: 'Get all upsells for an appointment' })
  @ApiResponse({ status: 200, description: 'List of upsells' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async findAll(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user?: any,
  ) {
    return this.upsellsService.findAll(
      appointmentId,
      user?.role,
      user?.studioId,
    );
  }

  @Patch('upsells/:id')
  @ApiOperation({ summary: 'Update an upsell' })
  @ApiResponse({ status: 200, description: 'Upsell updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Upsell not found' })
  async update(
    @Param('id') id: string,
    @Body() updateUpsellDto: UpdateUpsellDto,
    @CurrentUser() user?: any,
  ) {
    return this.upsellsService.update(
      id,
      updateUpsellDto,
      user?.role,
      user?.studioId,
      user?.userId,
    );
  }

  @Delete('upsells/:id')
  @ApiOperation({ summary: 'Delete an upsell' })
  @ApiResponse({ status: 200, description: 'Upsell deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Upsell not found' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    return this.upsellsService.remove(id, user?.role, user?.studioId, user?.userId);
  }
}

