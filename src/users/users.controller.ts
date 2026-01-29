import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
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
}

