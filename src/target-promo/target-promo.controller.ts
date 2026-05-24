import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TargetPromoService } from './target-promo.service';
import { CreateTargetPromoDto } from './dto/create-target-promo.dto';
import { UpdateTargetPromoDto } from './dto/update-target-promo.dto';

@ApiTags('target-promos')
@Controller('target-promos')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TargetPromoController {
  constructor(private readonly targetPromoService: TargetPromoService) {}

  @Get()
  @ApiOperation({ summary: 'Список промокодов Target организации' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER: другая организация',
  })
  @ApiQuery({ name: 'activeOnly', required: false, description: 'true — только активные' })
  async list(
    @Query('organizationId') organizationIdQuery: string | undefined,
    @Query('activeOnly') activeOnly: string | undefined,
    @CurrentUser() user?: { role: string; organizationId?: string },
  ) {
    const organizationId = await this.targetPromoService.resolveOrganizationId(
      user?.role,
      user?.organizationId,
      organizationIdQuery,
    );
    return this.targetPromoService.listForOrganization(
      organizationId,
      user?.role,
      activeOnly !== 'true' && activeOnly !== '1',
    );
  }

  @Get('activations')
  @ApiOperation({ summary: 'Журнал активаций промокодов Target' })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'targetPromoId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listActivations(
    @Query('organizationId') organizationIdQuery: string | undefined,
    @Query('targetPromoId') targetPromoId: string | undefined,
    @Query('limit') limitStr: string | undefined,
    @CurrentUser() user?: { role: string; organizationId?: string },
  ) {
    const organizationId = await this.targetPromoService.resolveOrganizationId(
      user?.role,
      user?.organizationId,
      organizationIdQuery,
    );
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    return this.targetPromoService.listActivations(
      organizationId,
      targetPromoId?.trim() || undefined,
      user?.role,
      Number.isFinite(limit) ? limit : 50,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Создать промокод Target' })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiResponse({ status: 201 })
  async create(
    @Body() dto: CreateTargetPromoDto,
    @Query('organizationId') organizationIdQuery: string | undefined,
    @CurrentUser() user?: { role: string; organizationId?: string },
  ) {
    const organizationId = await this.targetPromoService.resolveOrganizationId(
      user?.role,
      user?.organizationId,
      organizationIdQuery,
    );
    return this.targetPromoService.create(organizationId, dto, user?.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить промокод Target' })
  @ApiQuery({ name: 'organizationId', required: false })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTargetPromoDto,
    @Query('organizationId') organizationIdQuery: string | undefined,
    @CurrentUser() user?: { role: string; organizationId?: string },
  ) {
    const organizationId = await this.targetPromoService.resolveOrganizationId(
      user?.role,
      user?.organizationId,
      organizationIdQuery,
    );
    return this.targetPromoService.update(organizationId, id, dto, user?.role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить промокод Target' })
  @ApiQuery({ name: 'organizationId', required: false })
  async remove(
    @Param('id') id: string,
    @Query('organizationId') organizationIdQuery: string | undefined,
    @CurrentUser() user?: { role: string; organizationId?: string },
  ) {
    const organizationId = await this.targetPromoService.resolveOrganizationId(
      user?.role,
      user?.organizationId,
      organizationIdQuery,
    );
    return this.targetPromoService.remove(organizationId, id, user?.role);
  }
}
