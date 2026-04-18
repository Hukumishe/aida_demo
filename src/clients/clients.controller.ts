import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { BonusAdjustmentDto } from './dto/bonus-adjustment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('clients')
@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all clients for the organization' })
  @ApiQuery({ name: 'q', required: false, description: 'Search query' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER: список клиентов указанной организации',
  })
  @ApiResponse({ status: 200, description: 'List of clients' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @Query('q') query?: string,
    @Query('organizationId') organizationId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.clientsService.findAll(
      query,
      user?.role,
      user?.organizationId,
      organizationId,
    );
  }

  @Get('segments')
  @ApiOperation({
    summary: 'Get client segment counts (New, Never visited, Sleeping, Missing)',
    description:
      'Сегменты считаются по последнему визиту в выбранный филиал — укажите studioId в query.',
  })
  @ApiQuery({
    name: 'studioId',
    required: true,
    description: 'Филиал для расчёта сегментов (последний визит в эту студию)',
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description:
      'Только DEVELOPER: филиал должен принадлежать этой организации (контекст экрана).',
  })
  @ApiResponse({ status: 200, description: 'Segment counts' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getSegments(
    @Query('studioId') studioId: string,
    @Query('organizationId') organizationId?: string,
    @CurrentUser() user?: any,
  ) {
    if (!studioId?.trim()) {
      throw new BadRequestException('Query parameter studioId is required');
    }
    return this.clientsService.getClientSegments(
      studioId.trim(),
      user?.role,
      user?.studioId,
      user?.organizationId,
      organizationId,
    );
  }

  @Get('referred')
  @ApiOperation({ summary: 'List referred clients (who was referred, by whom)' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER: другая организация',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getReferredClients(
    @Query('organizationId') organizationId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.clientsService.getReferredClients(
      user?.role,
      user?.organizationId,
      organizationId,
    );
  }

  @Get('referrers')
  @ApiOperation({
    summary:
      'List referrers (people whose codes were used) with referred count — for dashboard table',
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER: другая организация',
  })
  @ApiResponse({
    status: 200,
    description:
      'List of clients who referred someone, with referredCount; click row → open client profile',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getReferrers(
    @Query('organizationId') organizationId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.clientsService.getReferrers(
      user?.role,
      user?.organizationId,
      organizationId,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a new client' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description:
      'Только DEVELOPER: создать клиента в указанной организации (контекст экрана). Иначе — организация из JWT.',
  })
  @ApiResponse({ status: 201, description: 'Client created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Body() createClientDto: CreateClientDto,
    @Query('organizationId') organizationId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.clientsService.create(
      createClientDto,
      user?.role,
      user?.studioId,
      user?.organizationId,
      organizationId,
    );
  }

  @Get(':id/statistics')
  @ApiOperation({ summary: 'Get client statistics (visits, average check)' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description:
      'Только DEVELOPER: клиент должен быть в этой организации (тот же контекст, что и GET /clients).',
  })
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
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.clientsService.getClientStatistics(
      id,
      user?.role,
      user?.studioId,
      user?.organizationId,
      organizationId,
    );
  }

  @Get(':id/appointments')
  @ApiOperation({ summary: 'Get client appointments' })
  @ApiQuery({
    name: 'upcoming',
    required: false,
    type: Boolean,
    description: 'Get only upcoming appointments (default: false)',
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER: контекст организации (как GET /clients).',
  })
  @ApiResponse({ status: 200, description: 'List of client appointments' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async getAppointments(
    @Param('id') id: string,
    @Query('upcoming') upcoming?: string,
    @Query('organizationId') organizationId?: string,
    @CurrentUser() user?: any,
  ) {
    const upcomingOnly = upcoming === 'true' || upcoming === '1';
    return this.clientsService.getClientAppointments(
      id,
      upcomingOnly,
      user?.role,
      user?.studioId,
      user?.organizationId,
      organizationId,
    );
  }

  @Get(':id/bonus-history')
  @ApiOperation({ summary: 'Get client bonus history (accruals and deductions)' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER: контекст организации (как GET /clients).',
  })
  @ApiResponse({ status: 200, description: 'List of bonus history entries' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async getBonusHistory(
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.clientsService.getBonusHistory(
      id,
      user?.role,
      user?.studioId,
      user?.organizationId,
      organizationId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get client by ID' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description:
      'Только DEVELOPER: клиент должен быть в этой организации (тот же контекст, что и GET /clients).',
  })
  @ApiResponse({ status: 200, description: 'Client details' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async findOne(
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.clientsService.findOne(
      id,
      user?.role,
      user?.studioId,
      user?.organizationId,
      organizationId,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update client' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER: контекст организации (как GET /clients).',
  })
  @ApiResponse({ status: 200, description: 'Client updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async update(
    @Param('id') id: string,
    @Body() updateClientDto: UpdateClientDto,
    @Query('organizationId') organizationId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.clientsService.update(
      id,
      updateClientDto,
      user?.role,
      user?.studioId,
      user?.organizationId,
      organizationId,
    );
  }

  @Post(':id/bonus-adjustment')
  @ApiOperation({ summary: 'Manual bonus adjustment (Owner only)' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER: контекст организации (как GET /clients).',
  })
  @ApiResponse({ status: 201, description: 'Adjustment applied' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  @ApiResponse({ status: 400, description: 'Would result in negative balance' })
  async bonusAdjustment(
    @Param('id') id: string,
    @Body() dto: BonusAdjustmentDto,
    @Query('organizationId') organizationId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.clientsService.bonusAdjustment(
      id,
      dto,
      user?.userId,
      user?.role,
      user?.studioId,
      user?.organizationId,
      organizationId,
    );
  }
}
