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
  ApiTags,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateStudioTaskDto } from './dto/create-task.dto';
import { UpdateStudioTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../common/decorators/roles.decorator';

@ApiTags('tasks')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('studios/:studioId/tasks')
  @ApiOperation({ summary: 'Список задач филиала (мастер видит только назначенные ему)' })
  async findAll(
    @Param('studioId') studioId: string,
    @CurrentUser() user: { userId: string; role: string; studioId?: string },
  ) {
    return this.tasksService.findAll(studioId, user.role, user.userId, user.studioId);
  }

  @Get('studios/:studioId/tasks/:taskId')
  @ApiOperation({ summary: 'Одна задача' })
  async findOne(
    @Param('studioId') studioId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: { userId: string; role: string; studioId?: string },
  ) {
    return this.tasksService.findOne(studioId, taskId, user.role, user.userId, user.studioId);
  }

  @Post('studios/:studioId/tasks')
  @Roles(UserRole.DEVELOPER,
    UserRole.OWNER,
    UserRole.DEPUTY_OWNER,
    UserRole.SERVICE,
    UserRole.MANAGER,
    UserRole.ADMIN)
  @ApiOperation({ summary: 'Создать задачу (уведомление исполнителю в колокольчик)' })
  async create(
    @Param('studioId') studioId: string,
    @Body() dto: CreateStudioTaskDto,
    @CurrentUser() user: { userId: string; role: string; studioId?: string },
  ) {
    return this.tasksService.create(studioId, dto, user.userId, user.role, user.studioId);
  }

  @Patch('studios/:studioId/tasks/:taskId')
  @ApiOperation({
    summary:
      'Обновить задачу (менеджеры — полностью; мастер — только свой статус, например DONE)',
  })
  async update(
    @Param('studioId') studioId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateStudioTaskDto,
    @CurrentUser() user: { userId: string; role: string; studioId?: string },
  ) {
    return this.tasksService.update(
      studioId,
      taskId,
      dto,
      user.role,
      user.userId,
      user.studioId,
    );
  }

  @Delete('studios/:studioId/tasks/:taskId')
  @Roles(UserRole.DEVELOPER,
    UserRole.OWNER,
    UserRole.DEPUTY_OWNER,
    UserRole.SERVICE,
    UserRole.MANAGER,
    UserRole.ADMIN)
  @ApiOperation({ summary: 'Удалить задачу' })
  async remove(
    @Param('studioId') studioId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: { role: string; studioId?: string },
  ) {
    return this.tasksService.remove(studioId, taskId, user.role, user.studioId);
  }
}
