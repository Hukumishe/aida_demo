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
}

