import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TaskStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getOrganizationIdForStudio } from '../common/organization-scope';
import { generateId, IdPrefix } from '../common/id-generator';
import { isOwnerLevelRole } from '../common/decorators/roles.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateStudioTaskDto } from './dto/create-task.dto';
import { UpdateStudioTaskDto } from './dto/update-task.dto';

/** Кто может быть «контролёром» задачи: мастера филиала + уровень владельца + DEVELOPER */
const CONTROLLER_ROLES: UserRole[] = [
  UserRole.MANAGER,
  UserRole.ADMIN,
  UserRole.DEVELOPER,
  UserRole.OWNER,
  UserRole.DEPUTY_OWNER,
  UserRole.SERVICE,
];

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async assertUserIsStudioStaff(studioId: string, userId: string) {
    const u = await this.prisma.user.findFirst({
      where: { id: userId, studioId, isActive: true },
    });
    if (!u) {
      throw new BadRequestException('Пользователь не найден в этом филиале или неактивен');
    }
    return u;
  }

  private async assertControllersAreManagers(studioId: string, userIds: string[]) {
    if (userIds.length === 0) return;
    const unique = [...new Set(userIds)];
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: unique },
        studioId,
        isActive: true,
        role: { in: CONTROLLER_ROLES },
      },
    });
    if (users.length !== unique.length) {
      throw new BadRequestException(
        'Контролёры задачи: активные пользователи филиала с ролью MANAGER, ADMIN или уровень владельца / DEVELOPER',
      );
    }
  }

  private taskInclude() {
    return {
      assignee: {
        select: {
          id: true,
          role: true,
          staffProfile: { select: { firstName: true, lastName: true } },
        },
      },
      createdBy: {
        select: {
          id: true,
          role: true,
          staffProfile: { select: { firstName: true, lastName: true } },
        },
      },
      controllers: {
        include: {
          user: {
            select: {
              id: true,
              role: true,
              staffProfile: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    } as const;
  }

  async findAll(studioId: string, userRole: string, userId: string, userStudioId?: string) {
    this.assertStudioScope(studioId, userRole, userStudioId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const where: { organizationId: string; assigneeUserId?: string } = { organizationId };
    if (userRole === UserRole.MASTER) {
      where.assigneeUserId = userId;
    }

    return this.prisma.studioTask.findMany({
      where,
      orderBy: [{ deadlineAt: 'asc' }, { createdAt: 'desc' }],
      include: this.taskInclude(),
    });
  }

  private assertStudioScope(studioId: string, userRole: string, userStudioId?: string) {
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userStudioId !== studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }
    }
  }

  async create(
    studioId: string,
    dto: CreateStudioTaskDto,
    createdByUserId: string,
    userRole: string,
    userStudioId?: string,
  ) {
    if (
      !isOwnerLevelRole(userRole) &&
      userRole !== UserRole.MANAGER &&
      userRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Создавать задачи могут менеджеры и администраторы филиала');
    }
    this.assertStudioScope(studioId, userRole, userStudioId);

    await this.assertUserIsStudioStaff(studioId, dto.assigneeUserId);
    await this.assertControllersAreManagers(studioId, dto.controllerUserIds ?? []);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const deadlineAt = new Date(dto.deadlineAt);
    if (Number.isNaN(deadlineAt.getTime())) {
      throw new BadRequestException('Некорректная дата deadlineAt');
    }

    const task = await this.prisma.studioTask.create({
      data: {
        id: generateId(IdPrefix.StudioTask),
        organizationId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        assigneeUserId: dto.assigneeUserId,
        createdByUserId,
        deadlineAt,
        status: TaskStatus.OPEN,
        controllers: {
          create: (dto.controllerUserIds ?? []).map((uid) => ({
            id: generateId(IdPrefix.StudioTaskController),
            userId: uid,
          })),
        },
      },
      include: this.taskInclude(),
    });

    try {
      await this.notifications.createNewTaskNotification(
        studioId,
        task.id,
        dto.assigneeUserId,
        task.title,
        deadlineAt,
      );
    } catch (e) {
      this.logger.warn(`createNewTaskNotification failed: ${e}`);
    }

    return task;
  }

  async findOne(
    studioId: string,
    taskId: string,
    userRole: string,
    userId: string,
    userStudioId?: string,
  ) {
    this.assertStudioScope(studioId, userRole, userStudioId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const task = await this.prisma.studioTask.findFirst({
      where: { id: taskId, organizationId },
      include: this.taskInclude(),
    });
    if (!task) throw new NotFoundException('Задача не найдена');

    if (userRole === UserRole.MASTER) {
      if (task.assigneeUserId !== userId) {
        throw new ForbiddenException('Нет доступа к этой задаче');
      }
    }

    return task;
  }

  async update(
    studioId: string,
    taskId: string,
    dto: UpdateStudioTaskDto,
    userRole: string,
    userId: string,
    userStudioId?: string,
  ) {
    this.assertStudioScope(studioId, userRole, userStudioId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const task = await this.prisma.studioTask.findFirst({
      where: { id: taskId, organizationId },
      include: { controllers: true },
    });
    if (!task) throw new NotFoundException('Задача не найдена');

    const isMaster = userRole === UserRole.MASTER;
    if (isMaster) {
      if (task.assigneeUserId !== userId) {
        throw new ForbiddenException('Можно менять только свои задачи');
      }
      const allowedKeys = ['status'];
      const keys = Object.keys(dto).filter((k) => (dto as any)[k] !== undefined);
      const bad = keys.filter((k) => !allowedKeys.includes(k));
      if (bad.length) {
        throw new ForbiddenException('Мастер может только отметить статус задачи (например DONE)');
      }
      if (dto.status != null && dto.status !== TaskStatus.DONE && dto.status !== TaskStatus.OPEN) {
        throw new BadRequestException('Мастер может перевести задачу в DONE или вернуть в OPEN');
      }
    }

    if (dto.assigneeUserId) {
      await this.assertUserIsStudioStaff(studioId, dto.assigneeUserId);
    }
    if (dto.controllerUserIds) {
      await this.assertControllersAreManagers(studioId, dto.controllerUserIds);
    }

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.assigneeUserId !== undefined) data.assigneeUserId = dto.assigneeUserId;
    if (dto.deadlineAt !== undefined) {
      const d = new Date(dto.deadlineAt);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Некорректная дата deadlineAt');
      data.deadlineAt = d;
      data.deadlineReminderSentAt = null;
    }
    if (dto.status !== undefined) data.status = dto.status;

    await this.prisma.$transaction(async (tx) => {
      if (dto.controllerUserIds !== undefined) {
        await tx.studioTaskController.deleteMany({ where: { taskId } });
        if (dto.controllerUserIds.length > 0) {
          await tx.studioTaskController.createMany({
            data: dto.controllerUserIds.map((uid) => ({
              id: generateId(IdPrefix.StudioTaskController),
              taskId,
              userId: uid,
            })),
          });
        }
      }

      if (Object.keys(data).length > 0) {
        await tx.studioTask.update({
          where: { id: taskId },
          data: data as any,
        });
      }
    });

    return this.prisma.studioTask.findFirst({
      where: { id: taskId },
      include: this.taskInclude(),
    });
  }

  async remove(
    studioId: string,
    taskId: string,
    userRole: string,
    userStudioId?: string,
  ) {
    if (
      !isOwnerLevelRole(userRole) &&
      userRole !== UserRole.MANAGER &&
      userRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Удалять задачи могут менеджеры и выше');
    }
    this.assertStudioScope(studioId, userRole, userStudioId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const task = await this.prisma.studioTask.findFirst({
      where: { id: taskId, organizationId },
    });
    if (!task) throw new NotFoundException('Задача не найдена');

    await this.prisma.studioTask.delete({ where: { id: taskId } });
    return { success: true };
  }

  /** Cron: задачи со сроком в ближайшие 24 ч, напоминание один раз */
  async sendDeadlineReminders() {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const tasks = await this.prisma.studioTask.findMany({
      where: {
        status: TaskStatus.OPEN,
        deadlineReminderSentAt: null,
        deadlineAt: { gt: now, lte: in24h },
      },
      include: { controllers: true },
    });

    for (const task of tasks) {
      const recipients = new Set<string>();
      recipients.add(task.assigneeUserId);
      for (const c of task.controllers) {
        recipients.add(c.userId);
      }

      for (const uid of recipients) {
        try {
          await this.notifications.createTaskDeadlineApproachingNotification(
            task.organizationId,
            uid,
            task.id,
            task.title,
            task.deadlineAt,
          );
        } catch (e) {
          this.logger.warn(`deadline reminder for task ${task.id} user ${uid}: ${e}`);
        }
      }

      try {
        await this.prisma.studioTask.update({
          where: { id: task.id },
          data: { deadlineReminderSentAt: new Date() },
        });
      } catch (e) {
        this.logger.warn(`mark deadlineReminderSentAt ${task.id}: ${e}`);
      }
    }
  }
}
