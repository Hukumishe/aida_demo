import {
  Controller,
  Get,
  Post,
  Body,
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
import { StudiosService } from './studios.service';
import { CreateStudioDto } from './dto/create-studio.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { Roles, UserRole } from '../common/decorators/roles.decorator';
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
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Create a new studio (OWNER only)' })
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
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @CurrentUser() user: any,
  ) {
    return this.studiosService.findOne(studioId, user.role, user.studioId);
  }
}

