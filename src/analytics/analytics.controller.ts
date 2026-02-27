import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { ServiceSalesQueryDto } from './dto/service-sales-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('analytics')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('studios/:studioId/analytics/service-sales')
  @ApiOperation({
    summary: 'Service sales by month for bar chart',
    description:
      'Revenue from completed (DONE) appointments grouped by month and service. Optional filters: startDate, endDate, serviceId. Default: last 12 months.',
  })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'serviceId', required: false, description: 'Filter by service UUID' })
  @ApiResponse({ status: 200, description: 'Monthly service sales data' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  getServiceSales(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Query() query: ServiceSalesQueryDto,
    @CurrentUser() user?: { userId?: string; role?: string; studioId?: string },
  ) {
    return this.analyticsService.getServiceSales(
      studioId,
      query,
      user?.role,
      user?.studioId,
    );
  }
}
