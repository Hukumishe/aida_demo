import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { PromptsService } from './prompts.service';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, UserRole } from '../common/decorators/roles.decorator';

@ApiTags('prompts')
@Controller('prompts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SERVICE)
@ApiBearerAuth()
export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}

  @Post()
  @ApiOperation({ summary: 'Создать промпт (только роль SERVICE)' })
  @ApiResponse({ status: 201, description: 'Промпт создан' })
  @ApiResponse({ status: 400, description: 'Ошибка валидации' })
  @ApiResponse({ status: 403, description: 'Доступ только для роли SERVICE' })
  create(@Body() dto: CreatePromptDto) {
    return this.promptsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Список всех промптов (только роль SERVICE)' })
  @ApiResponse({ status: 200, description: 'Список промптов' })
  @ApiResponse({ status: 403, description: 'Доступ только для роли SERVICE' })
  findAll() {
    return this.promptsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить промпт по id (только роль SERVICE)' })
  @ApiResponse({ status: 200, description: 'Промпт' })
  @ApiResponse({ status: 404, description: 'Промпт не найден' })
  @ApiResponse({ status: 403, description: 'Доступ только для роли SERVICE' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.promptsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить промпт (только роль SERVICE)' })
  @ApiResponse({ status: 200, description: 'Промпт обновлён' })
  @ApiResponse({ status: 400, description: 'Ошибка валидации' })
  @ApiResponse({ status: 404, description: 'Промпт не найден' })
  @ApiResponse({ status: 403, description: 'Доступ только для роли SERVICE' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromptDto,
  ) {
    return this.promptsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить промпт (только роль SERVICE)' })
  @ApiResponse({ status: 200, description: 'Промпт удалён' })
  @ApiResponse({ status: 404, description: 'Промпт не найден' })
  @ApiResponse({ status: 403, description: 'Доступ только для роли SERVICE' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.promptsService.remove(id);
  }
}
