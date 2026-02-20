import {
  Controller,
  Get,
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
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('dashboard')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('studios/:studioId/dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics for a studio' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ 
    name: 'period', 
    required: false, 
    enum: ['day', 'week', 'month', 'year', 'all'],
    description: 'Period type (overrides dates if provided)' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Dashboard statistics',
    schema: {
      type: 'object',
      properties: {
        period: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' },
          },
        },
        overview: {
          type: 'object',
          properties: {
            totalAppointments: { type: 'number' },
            revenue: { type: 'number' },
            cancellationRate: { type: 'number' },
            completionRate: { type: 'number' },
          },
        },
        statusCounts: {
          type: 'object',
          properties: {
            BOOKED: { type: 'number' },
            CANCELLED: { type: 'number' },
            ARRIVED: { type: 'number' },
            DONE: { type: 'number' },
          },
        },
        popularServices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              count: { type: 'number' },
              revenue: { type: 'number' },
            },
          },
        },
        topStaff: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              count: { type: 'number' },
              revenue: { type: 'number' },
            },
          },
        },
        dailyChart: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string' },
              count: { type: 'number' },
              revenue: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getStudioDashboard(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Query() query: DashboardQueryDto,
    @CurrentUser() user?: any,
  ) {
    return this.dashboardService.getStudioDashboard(
      studioId,
      query,
      user?.role,
      user?.studioId,
    );
  }

  @Get('dashboard/all')
  @ApiOperation({ summary: 'Get aggregated dashboard statistics for all studios (OWNER only)' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ 
    name: 'period', 
    required: false, 
    enum: ['day', 'week', 'month', 'year', 'all'],
    description: 'Period type (overrides dates if provided)' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Aggregated dashboard statistics',
    schema: {
      type: 'object',
      properties: {
        period: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' },
          },
        },
        overview: {
          type: 'object',
          properties: {
            totalStudios: { type: 'number' },
            totalAppointments: { type: 'number' },
            totalRevenue: { type: 'number' },
            cancellationRate: { type: 'number' },
            completionRate: { type: 'number' },
          },
        },
        aggregatedStatusCounts: {
          type: 'object',
          properties: {
            BOOKED: { type: 'number' },
            CANCELLED: { type: 'number' },
            ARRIVED: { type: 'number' },
            DONE: { type: 'number' },
          },
        },
        studios: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              studioId: { type: 'string' },
              studioName: { type: 'string' },
              totalAppointments: { type: 'number' },
              revenue: { type: 'number' },
              statusCounts: {
                type: 'object',
                properties: {
                  BOOKED: { type: 'number' },
                  CANCELLED: { type: 'number' },
                  ARRIVED: { type: 'number' },
                  DONE: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Only owners can access' })
  async getAllStudiosDashboard(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user?: any,
  ) {
    return this.dashboardService.getAllStudiosDashboard(query, user?.role);
  }
}





