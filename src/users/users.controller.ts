import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { AddStaffServiceDto } from './dto/add-staff-service.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('staff')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('studios/:studioId/staff')
  @ApiOperation({ summary: 'Get all staff members for a studio' })
  @ApiResponse({ status: 200, description: 'List of staff members' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.findAll(studioId, user.role, user.studioId);
  }

  @Post('studios/:studioId/staff')
  @ApiOperation({ summary: 'Create a new staff member' })
  @ApiResponse({ status: 201, description: 'Staff member created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Body() createStaffDto: CreateStaffDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.create(studioId, createStaffDto, user.role, user.studioId);
  }

  @Patch('staff/:userId')
  @ApiOperation({ summary: 'Update staff member' })
  @ApiResponse({ status: 200, description: 'Staff member updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  async update(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updateStaffDto: UpdateStaffDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.update(userId, updateStaffDto, user.role, user.studioId);
  }

  @Get('staff/:staffUserId/services')
  @ApiOperation({ summary: 'Get all services for a staff member' })
  @ApiResponse({ status: 200, description: 'List of staff services' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  async getStaffServices(
    @Param('staffUserId', ParseUUIDPipe) staffUserId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.getStaffServices(staffUserId, user.role, user.studioId);
  }

  @Post('staff/:staffUserId/services')
  @ApiOperation({ summary: 'Add a service to a staff member' })
  @ApiResponse({ status: 201, description: 'Service added to staff member' })
  @ApiResponse({ status: 400, description: 'Bad request (service already assigned or wrong studio)' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Staff member or service not found' })
  async addService(
    @Param('staffUserId', ParseUUIDPipe) staffUserId: string,
    @Body() addStaffServiceDto: AddStaffServiceDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.addService(
      staffUserId,
      addStaffServiceDto.serviceId,
      user.role,
      user.studioId,
    );
  }

  @Delete('staff/:staffUserId/services/:serviceId')
  @ApiOperation({ summary: 'Remove a service from a staff member' })
  @ApiResponse({ status: 200, description: 'Service removed from staff member' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Staff member or service assignment not found' })
  async removeService(
    @Param('staffUserId', ParseUUIDPipe) staffUserId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.removeService(staffUserId, serviceId, user.role, user.studioId);
  }

  @Get('staff/:userId/profile')
  @ApiOperation({ summary: 'Get staff member profile' })
  @ApiResponse({ status: 200, description: 'Staff member profile' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  async getStaffProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.getStaffProfile(userId, user.role, user.studioId);
  }

  @Patch('staff/:userId/profile')
  @ApiOperation({ summary: 'Update staff member profile' })
  @ApiResponse({ status: 200, description: 'Staff member profile updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  async updateStaffProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updateProfileDto: UpdateStaffProfileDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.updateStaffProfile(userId, updateProfileDto, user.role, user.studioId);
  }

  @Delete('staff/:userId')
  @ApiOperation({ summary: 'Delete staff member' })
  @ApiResponse({ status: 200, description: 'Staff member deleted' })
  @ApiResponse({ status: 400, description: 'Bad request (cannot delete OWNER)' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  async remove(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.remove(userId, user.role, user.studioId);
  }
}




