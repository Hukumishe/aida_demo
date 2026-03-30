import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StudiosService } from './studios.service';
import { CreateStudioDto } from './dto/create-studio.dto';
import { UpdateStudioSettingsDto } from './dto/update-studio-settings.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { Roles, UserRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('studios')
@Controller('studios')
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class StudiosController {
  constructor(private readonly studiosService: StudiosService) {}

  @Get()
  @ApiOperation({ summary: 'Get all studios (OWNER sees all, others see only their studio)' })
  @ApiResponse({ status: 200, description: 'List of studios' })
  async findAll(@CurrentUser() user: any) {
    return this.studiosService.findAll(user.role, user.studioId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({ summary: 'Create a new studio (OWNER and DEPUTY_OWNER only)' })
  @ApiResponse({ status: 201, description: 'Studio created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() createStudioDto: CreateStudioDto) {
    return this.studiosService.create(createStudioDto);
  }

  @Get(':studioId')
  @ApiOperation({ summary: 'Get studio by ID' })
  @ApiResponse({ status: 200, description: 'Studio details' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Studio not found' })
  async findOne(
    @Param('studioId') studioId: string,
    @CurrentUser() user: any,
  ) {
    return this.studiosService.findOne(studioId, user.role, user.studioId);
  }

  @Get(':studioId/settings')
  @ApiOperation({ summary: 'Get studio settings (лимит бонусов, «приведи друга»)' })
  @ApiResponse({ status: 200, description: 'Settings' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getSettings(
    @Param('studioId') studioId: string,
    @CurrentUser() user: any,
  ) {
    return this.studiosService.getSettings(studioId, user.role, user.studioId);
  }

  @Patch(':studioId/settings')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({
    summary:
      'Update studio settings: лимит бонусов, маркетинг «приведи друга» (уровень владельца)',
  })
  @ApiResponse({ status: 200, description: 'Studio updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateSettings(
    @Param('studioId') studioId: string,
    @Body() dto: UpdateStudioSettingsDto,
    @CurrentUser() user: any,
  ) {
    return this.studiosService.updateSettings(studioId, dto, user.role);
  }
}




