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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { BusySlotsService } from './busy-slots.service';
import { CreateBusySlotDto } from './dto/create-busy-slot.dto';
import { UpdateBusySlotDto } from './dto/update-busy-slot.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('busy-slots')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class BusySlotsController {
  constructor(private readonly busySlotsService: BusySlotsService) {}

  @Get('studios/:studioId/busy-slots')
  @ApiOperation({ summary: 'Get all busy slots for a studio' })
  @ApiQuery({ name: 'date', required: false, description: 'Filter by date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'List of busy slots' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @Param('studioId') studioId: string,
    @Query('date') date?: string,
    @CurrentUser() user?: any,
  ) {
    return this.busySlotsService.findAll(studioId, date, user?.role, user?.studioId, user?.userId);
  }

  @Post('studios/:studioId/busy-slots')
  @ApiOperation({ summary: 'Create a new busy slot' })
  @ApiResponse({ status: 201, description: 'Busy slot created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Conflict - slot not allowed' })
  async create(
    @Param('studioId') studioId: string,
    @Body() createBusySlotDto: CreateBusySlotDto,
    @CurrentUser() user?: any,
  ) {
    return this.busySlotsService.create(studioId, createBusySlotDto, user?.role, user?.studioId, user?.userId);
  }

  @Patch('busy-slots/:id')
  @ApiOperation({ summary: 'Update busy slot' })
  @ApiResponse({ status: 200, description: 'Busy slot updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Busy slot not found' })
  @ApiResponse({ status: 409, description: 'Conflict - slot not allowed' })
  async update(
    @Param('id') id: string,
    @Body() updateBusySlotDto: UpdateBusySlotDto,
    @CurrentUser() user?: any,
  ) {
    return this.busySlotsService.update(
      id,
      updateBusySlotDto,
      user?.role,
      user?.studioId,
      user?.userId,
    );
  }

  @Delete('busy-slots/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete busy slot' })
  @ApiResponse({ status: 204, description: 'Busy slot deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Busy slot not found' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    return this.busySlotsService.remove(id, user?.role, user?.studioId, user?.userId);
  }
}




