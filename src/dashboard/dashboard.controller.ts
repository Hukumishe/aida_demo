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
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/decorators/roles.decorator';

@ApiTags('dashboard')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('studios/:studioId/dashboard')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER)
  @ApiOperation({ 
    summary: 'Get dashboard statistics for a studio (OWNER and DEPUTY_OWNER only)',
    description: 'Filter by date range (startDate/endDate) or by period. If both startDate and endDate are provided, period is ignored. If only startDate is provided, endDate defaults to today. If only endDate is provided, startDate defaults to 30 days before endDate.'
  })
  @ApiQuery({ 
    name: 'startDate', 
    required: false, 
    description: 'Start date (YYYY-MM-DD). Filter "from" date. If both startDate and endDate are provided, period is ignored.',
    example: '2024-01-15'
  })
  @ApiQuery({ 
    name: 'endDate', 
    required: false, 
    description: 'End date (YYYY-MM-DD). Filter "to" date. If both startDate and endDate are provided, period is ignored.',
    example: '2024-01-31'
  })
  @ApiQuery({ 
    name: 'period', 
    required: false, 
    enum: ['day', 'week', 'month', 'year', 'all'],
    description: 'Period type. Used only if startDate and endDate are not provided. Calculates period from today backwards.' 
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
  @ApiResponse({ status: 403, description: 'Forbidden - Only OWNER and DEPUTY_OWNER can access dashboard' })
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
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER)
  @ApiOperation({ 
    summary: 'Get aggregated dashboard statistics for all studios (OWNER and DEPUTY_OWNER only)',
    description: 'Filter by date range (startDate/endDate) or by period. If both startDate and endDate are provided, period is ignored. If only startDate is provided, endDate defaults to today. If only endDate is provided, startDate defaults to 30 days before endDate.'
  })
  @ApiQuery({ 
    name: 'startDate', 
    required: false, 
    description: 'Start date (YYYY-MM-DD). Filter "from" date. If both startDate and endDate are provided, period is ignored.',
    example: '2024-01-15'
  })
  @ApiQuery({ 
    name: 'endDate', 
    required: false, 
    description: 'End date (YYYY-MM-DD). Filter "to" date. If both startDate and endDate are provided, period is ignored.',
    example: '2024-01-31'
  })
  @ApiQuery({ 
    name: 'period', 
    required: false, 
    enum: ['day', 'week', 'month', 'year', 'all'],
    description: 'Period type. Used only if startDate and endDate are not provided. Calculates period from today backwards.' 
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








