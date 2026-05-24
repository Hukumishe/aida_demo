import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NextbotAutoMessagesService } from './nextbot-auto-messages.service';
import { CreateNextbotAutoMessageTemplateDto } from './dto/create-nextbot-auto-message-template.dto';
import { UpdateNextbotAutoMessageTemplateDto } from './dto/update-nextbot-auto-message-template.dto';
import { TestSendNextbotMessageDto } from './dto/test-send-nextbot-message.dto';

@ApiTags('nextbot-auto-messages')
@Controller('studios/:studioId/nextbot-auto-messages')
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class NextbotAutoMessagesController {
  constructor(private readonly service: NextbotAutoMessagesService) {}

  @Get('presets')
  @ApiOperation({ summary: 'Типовые пресеты триггеров (подсказки для админки)' })
  listPresets() {
    return this.service.listTriggerPresets();
  }

  @Get('logs')
  @ApiOperation({ summary: 'Журнал исходящих автосообщений филиала' })
  findLogs(
    @Param('studioId') studioId: string,
    @CurrentUser() user: { role: string; organizationId?: string },
  ) {
    return this.service.findLogs(studioId, user.role, user.organizationId);
  }

  @Get('variables')
  @ApiOperation({
    summary: 'Список переменных для текста шаблона',
    description: 'Подстановка в messageText: {{name}}, {{service}}, …',
  })
  @ApiResponse({ status: 200 })
  listVariables() {
    return this.service.listVariables();
  }

  @Post('test-send')
  @ApiOperation({
    summary: 'Тестовая отправка сообщения в Nextbot',
    description:
      'Отправка на webhook организации с вашим dialogId и текстом. ' +
      'Переменные — из appointmentId и/или поля variables. Не создаёт запись в очереди автосообщений.',
  })
  @ApiResponse({ status: 200, description: 'Сообщение отправлено' })
  @ApiResponse({ status: 400, description: 'Нет webhook / ошибка Nextbot' })
  testSend(
    @Param('studioId') studioId: string,
    @Body() dto: TestSendNextbotMessageDto,
    @CurrentUser() user: { role: string; organizationId?: string },
  ) {
    return this.service.testSend(studioId, dto, user.role, user.organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'Список шаблонов автосообщений филиала' })
  @ApiResponse({ status: 200 })
  findAll(
    @Param('studioId') studioId: string,
    @CurrentUser() user: { role: string; organizationId?: string },
  ) {
    return this.service.findAll(studioId, user.role, user.organizationId);
  }

  @Get(':templateId')
  @ApiOperation({ summary: 'Шаблон автосообщения по id' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  findOne(
    @Param('studioId') studioId: string,
    @Param('templateId') templateId: string,
    @CurrentUser() user: { role: string; organizationId?: string },
  ) {
    return this.service.findOne(studioId, templateId, user.role, user.organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Создать шаблон автосообщения' })
  @ApiResponse({ status: 201 })
  create(
    @Param('studioId') studioId: string,
    @Body() dto: CreateNextbotAutoMessageTemplateDto,
    @CurrentUser() user: { role: string; organizationId?: string },
  ) {
    return this.service.create(studioId, dto, user.role, user.organizationId);
  }

  @Patch(':templateId')
  @ApiOperation({ summary: 'Обновить шаблон автосообщения' })
  @ApiResponse({ status: 200 })
  update(
    @Param('studioId') studioId: string,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateNextbotAutoMessageTemplateDto,
    @CurrentUser() user: { role: string; organizationId?: string },
  ) {
    return this.service.update(studioId, templateId, dto, user.role, user.organizationId);
  }

  @Delete(':templateId')
  @ApiOperation({ summary: 'Удалить шаблон автосообщения' })
  @ApiResponse({ status: 200 })
  remove(
    @Param('studioId') studioId: string,
    @Param('templateId') templateId: string,
    @CurrentUser() user: { role: string; organizationId?: string },
  ) {
    return this.service.remove(studioId, templateId, user.role, user.organizationId);
  }
}
