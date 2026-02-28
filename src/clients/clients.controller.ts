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
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { BonusAdjustmentDto } from './dto/bonus-adjustment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('clients')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get('studios/:studioId/clients')
  @ApiOperation({ summary: 'Get all clients for a studio' })
  @ApiQuery({ name: 'q', required: false, description: 'Search query' })
  @ApiResponse({ status: 200, description: 'List of clients' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Query('q') query?: string,
    @CurrentUser() user?: any,
  ) {
    return this.clientsService.findAll(studioId, query, user?.role, user?.studioId);
  }

  @Get('studios/:studioId/clients/segments')
  @ApiOperation({ summary: 'Get client segment counts (New, Never visited, Sleeping, Missing)' })
  @ApiResponse({ status: 200, description: 'Segment counts' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getSegments(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @CurrentUser() user?: any,
  ) {
    return this.clientsService.getClientSegments(studioId, user?.role, user?.studioId);
  }

  @Get('studios/:studioId/clients/referred')
  @ApiOperation({ summary: 'List referred clients (for dashboard table)' })
  @ApiResponse({ status: 200, description: 'List of clients who were referred, with referrer info' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getReferredClients(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @CurrentUser() user?: any,
  ) {
    return this.clientsService.getReferredClients(studioId, user?.role, user?.studioId);
  }

  @Post('studios/:studioId/clients')
  @ApiOperation({ summary: 'Create a new client' })
  @ApiResponse({ status: 201, description: 'Client created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Body() createClientDto: CreateClientDto,
    @CurrentUser() user?: any,
  ) {
    return this.clientsService.create(studioId, createClientDto, user?.role, user?.studioId);
  }

  @Get('clients/:id')
  @ApiOperation({ summary: 'Get client by ID' })
  @ApiResponse({ status: 200, description: 'Client details' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: any,
  ) {
    return this.clientsService.findOne(id, user?.role, user?.studioId);
  }

  @Patch('clients/:id')
  @ApiOperation({ summary: 'Update client' })
  @ApiResponse({ status: 200, description: 'Client updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateClientDto: UpdateClientDto,
    @CurrentUser() user?: any,
  ) {
    return this.clientsService.update(id, updateClientDto, user?.role, user?.studioId);
  }

  @Get('clients/:id/statistics')
  @ApiOperation({ summary: 'Get client statistics (visits, average check)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Client statistics',
    schema: {
      type: 'object',
      properties: {
        totalVisits: { type: 'number', example: 15 },
        averageCheck: { type: 'number', example: 2500 },
        totalSpent: { type: 'number', example: 37500 },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async getStatistics(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: any,
  ) {
    return this.clientsService.getClientStatistics(id, user?.role, user?.studioId);
  }

  @Get('clients/:id/appointments')
  @ApiOperation({ summary: 'Get client appointments' })
  @ApiQuery({ 
    name: 'upcoming', 
    required: false, 
    type: Boolean,
    description: 'Get only upcoming appointments (default: false)' 
  })
  @ApiResponse({ status: 200, description: 'List of client appointments' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async getAppointments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('upcoming') upcoming?: string,
    @CurrentUser() user?: any,
  ) {
    const upcomingOnly = upcoming === 'true' || upcoming === '1';
    return this.clientsService.getClientAppointments(
      id,
      upcomingOnly,
      user?.role,
      user?.studioId,
    );
  }

  @Get('clients/:id/bonus-history')
  @ApiOperation({ summary: 'Get client bonus history (accruals and deductions)' })
  @ApiResponse({ status: 200, description: 'List of bonus history entries' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async getBonusHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: any,
  ) {
    return this.clientsService.getBonusHistory(id, user?.role, user?.studioId);
  }

  @Post('clients/:id/bonus-adjustment')
  @ApiOperation({ summary: 'Manual bonus adjustment (Owner only)' })
  @ApiResponse({ status: 201, description: 'Adjustment applied' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  @ApiResponse({ status: 400, description: 'Would result in negative balance' })
  async bonusAdjustment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BonusAdjustmentDto,
    @CurrentUser() user?: any,
  ) {
    return this.clientsService.bonusAdjustment(id, dto, user?.userId, user?.role, user?.studioId);
  }
}




