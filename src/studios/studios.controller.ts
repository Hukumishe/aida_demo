import {
  Controller,
  Get,
  Post,
  Put,
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
import { UpdateStudioLoyaltyDto } from './dto/update-studio-loyalty.dto';
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
    return this.studiosService.findAll(user.role, user.studioId, user.organizationId);
  }

  @Post()
  @Roles(UserRole.DEVELOPER, UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE)
  @ApiOperation({
    summary: 'Create a new studio',
    description:
      'OWNER/DEPUTY/SERVICE — филиал в своей организации. DEVELOPER может передать organizationId, чтобы создать филиал в любой организации.',
  })
  @ApiResponse({ status: 201, description: 'Studio created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() createStudioDto: CreateStudioDto, @CurrentUser() user: any) {
    const { organizationId: bodyOrgId, ...dto } = createStudioDto;
    const orgId =
      user.role === UserRole.DEVELOPER && bodyOrgId?.trim()
        ? bodyOrgId.trim()
        : user.organizationId;
    return this.studiosService.create(dto, orgId);
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
    return this.studiosService.findOne(studioId, user.role, user.studioId, user.organizationId);
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
  @Roles(UserRole.DEVELOPER, UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE, UserRole.MARKETER)
  @ApiOperation({
    summary:
      'Update studio settings: лимит бонусов, маркетинг «приведи друга» (уровень владельца); MARKETER — только маркетинговые поля',
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

  @Get(':studioId/loyalty')
  @ApiOperation({
    summary:
      'Уровни лояльности студии: PRESET (классика из кода) или CUSTOM (свои названия, % и вехи перехода)',
  })
  @ApiResponse({ status: 200 })
  async getLoyalty(@Param('studioId') studioId: string, @CurrentUser() user: any) {
    return this.studiosService.getLoyalty(studioId, user.role, user.studioId);
  }

  @Put(':studioId/loyalty')
  @Roles(UserRole.DEVELOPER, UserRole.OWNER, UserRole.DEPUTY_OWNER, UserRole.SERVICE, UserRole.MARKETER)
  @ApiOperation({
    summary:
      'Задать режим лояльности: PRESET или полная замена CUSTOM (tiers + milestones). Владелец или MARKETER.',
  })
  @ApiResponse({ status: 200 })
  async updateLoyalty(
    @Param('studioId') studioId: string,
    @Body() dto: UpdateStudioLoyaltyDto,
    @CurrentUser() user: any,
  ) {
    return this.studiosService.updateLoyalty(studioId, dto, user.role, user.studioId);
  }
}




