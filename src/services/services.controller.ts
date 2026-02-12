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
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('services')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get('studios/:studioId/services')
  @ApiOperation({ summary: 'Get all services for a studio' })
  @ApiResponse({ status: 200, description: 'List of services' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async findAll(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @CurrentUser() user?: any,
  ) {
    try {
      return await this.servicesService.findAll(studioId, user?.role, user?.studioId);
    } catch (error) {
      console.error('Error in ServicesController.findAll:', {
        studioId,
        userRole: user?.role,
        userStudioId: user?.studioId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  @Post('studios/:studioId/services')
  @ApiOperation({ summary: 'Create a new service' })
  @ApiResponse({ status: 201, description: 'Service created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Body() createServiceDto: CreateServiceDto,
    @CurrentUser() user?: any,
  ) {
    return this.servicesService.create(studioId, createServiceDto, user?.role, user?.studioId);
  }

  @Patch('services/:id')
  @ApiOperation({ summary: 'Update service' })
  @ApiResponse({ status: 200, description: 'Service updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceDto: UpdateServiceDto,
    @CurrentUser() user?: any,
  ) {
    return this.servicesService.update(id, updateServiceDto, user?.role, user?.studioId);
  }
}




