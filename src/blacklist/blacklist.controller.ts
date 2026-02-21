import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
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
import { BlacklistService } from './blacklist.service';
import { CreateBlacklistRequestDto } from './dto/create-blacklist-request.dto';
import { ApproveBlacklistRequestDto } from './dto/approve-blacklist-request.dto';
import { RejectBlacklistRequestDto } from './dto/reject-blacklist-request.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/decorators/roles.decorator';

@ApiTags('blacklist')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BlacklistController {
  constructor(private readonly blacklistService: BlacklistService) {}

  @Post('clients/:clientId/blacklist/request')
  @Roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.DEPUTY_OWNER)
  @ApiOperation({ summary: 'Create blacklist request (MANAGER, ADMIN, OWNER, DEPUTY_OWNER). OWNER/DEPUTY_OWNER requests are auto-approved.' })
  @ApiResponse({ status: 201, description: 'Blacklist request created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async createRequest(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() createDto: CreateBlacklistRequestDto,
    @CurrentUser() user: any,
  ) {
    return this.blacklistService.createRequest(
      clientId,
      createDto,
      user.role,
      user.userId,
      user.studioId,
    );
  }

  @Post('clients/:clientId/blacklist/add')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER)
  @ApiOperation({ summary: 'Add client to blacklist directly (OWNER and DEPUTY_OWNER only)' })
  @ApiResponse({ status: 200, description: 'Client added to blacklist' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async addToBlacklist(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() createDto: CreateBlacklistRequestDto,
    @CurrentUser() user: any,
  ) {
    return this.blacklistService.addToBlacklistDirectly(
      clientId,
      createDto,
      user.role,
      user.userId,
    );
  }

  @Get('studios/:studioId/blacklist/requests')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Get all blacklist requests for a studio' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @ApiResponse({ status: 200, description: 'List of blacklist requests' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAllRequests(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Query('status') status?: string,
    @CurrentUser() user?: any,
  ) {
    return this.blacklistService.findAllRequests(
      studioId,
      user?.role,
      user?.studioId,
      status,
    );
  }

  @Patch('blacklist/requests/:requestId/approve')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER)
  @ApiOperation({ summary: 'Approve blacklist request (OWNER and DEPUTY_OWNER only)' })
  @ApiResponse({ status: 200, description: 'Request approved' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async approveRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() approveDto: ApproveBlacklistRequestDto,
    @CurrentUser() user: any,
  ) {
    return this.blacklistService.approveRequest(
      requestId,
      approveDto,
      user.role,
      user.userId,
    );
  }

  @Patch('blacklist/requests/:requestId/reject')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER)
  @ApiOperation({ summary: 'Reject blacklist request (OWNER and DEPUTY_OWNER only)' })
  @ApiResponse({ status: 200, description: 'Request rejected' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async rejectRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() rejectDto: RejectBlacklistRequestDto,
    @CurrentUser() user: any,
  ) {
    return this.blacklistService.rejectRequest(
      requestId,
      rejectDto,
      user.role,
      user.userId,
    );
  }

  @Get('studios/:studioId/blacklist')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Get all blacklisted clients for a studio' })
  @ApiResponse({ status: 200, description: 'List of blacklisted clients' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getBlacklistedClients(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @CurrentUser() user?: any,
  ) {
    return this.blacklistService.getBlacklistedClients(
      studioId,
      user?.role,
      user?.studioId,
    );
  }

  @Patch('clients/:clientId/blacklist/remove')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER)
  @ApiOperation({ summary: 'Remove client from blacklist (OWNER and DEPUTY_OWNER only)' })
  @ApiResponse({ status: 200, description: 'Client removed from blacklist' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async removeFromBlacklist(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @CurrentUser() user: any,
  ) {
    return this.blacklistService.removeFromBlacklist(clientId, user.role);
  }
}


