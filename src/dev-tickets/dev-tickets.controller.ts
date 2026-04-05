import {
  BadRequestException,
  Body,
  Controller,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DevTicketsService, DevTicketBucket } from './dev-tickets.service';
import { CreateDevTicketDto } from './dto/create-dev-ticket.dto';
import { AddDevTicketMessageDto } from './dto/add-dev-ticket-message.dto';
import { UpdateDevTicketStatusDto } from './dto/update-dev-ticket-status.dto';

@ApiTags('dev-tickets')
@Controller('dev-tickets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DevTicketsController {
  constructor(private readonly devTicketsService: DevTicketsService) {}

  @Post()
  @ApiOperation({
    summary: 'Создать тикет (только OWNER и DEPUTY_OWNER)',
  })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 403 })
  create(
    @Body() dto: CreateDevTicketDto,
    @CurrentUser() user: { userId: string; role: string; organizationId?: string },
  ) {
    return this.devTicketsService.create(user.userId, user.role, user.organizationId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Список тикетов',
    description:
      'DEVELOPER — все организации. OWNER/DEPUTY — только своя организация. bucket=active — открытые и в работе; archive — выполненные.',
  })
  @ApiQuery({
    name: 'bucket',
    enum: ['active', 'archive'],
    required: true,
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403 })
  findAll(
    @Query('bucket') bucket: string,
    @CurrentUser() user: { role: string; organizationId?: string },
  ) {
    if (bucket !== 'active' && bucket !== 'archive') {
      throw new BadRequestException('Укажите bucket=active или bucket=archive');
    }
    return this.devTicketsService.findAll(user.role, user.organizationId, bucket as DevTicketBucket);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Тикет с историей сообщений' })
  @ApiResponse({ status: 404 })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { role: string; organizationId?: string },
  ) {
    return this.devTicketsService.findOne(id, user.role, user.organizationId);
  }

  @Post(':id/messages')
  @ApiOperation({
    summary: 'Сообщение в чат тикета',
    description: 'Пока тикет не COMPLETED. Пишут DEVELOPER и пользователи OWNER/DEPUTY своей сети.',
  })
  @ApiResponse({ status: 400, description: 'Тикет выполнен' })
  addMessage(
    @Param('id') id: string,
    @Body() dto: AddDevTicketMessageDto,
    @CurrentUser() user: { userId: string; role: string; organizationId?: string },
  ) {
    return this.devTicketsService.addMessage(
      id,
      user.userId,
      user.role,
      user.organizationId,
      dto,
    );
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Сменить статус (только DEVELOPER)',
    description: 'IN_PROGRESS или COMPLETED. При COMPLETED чат закрывается.',
  })
  @ApiResponse({ status: 403 })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDevTicketStatusDto,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    return this.devTicketsService.updateStatus(id, user.userId, user.role, dto);
  }
}
