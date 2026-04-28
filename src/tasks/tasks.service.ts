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
import { CreateStudioTaskDto, StudioTaskAudience } from './dto/create-task.dto';
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

const OWNER_LEVEL_OR_DEV: UserRole[] = [
  UserRole.OWNER,
  UserRole.DEPUTY_OWNER,
  UserRole.DEVELOPER,
];

const MANAGER_POOL_CREATORS = new Set<string>([
  UserRole.OWNER,
  UserRole.DEPUTY_OWNER,
  UserRole.DEVELOPER,
]);

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

  /**
   * Проверяет клиента и запись в организации филиала; запись должна быть в этом studioId.
   * Если указана только запись — clientId берётся из записи.
   */
  private async resolveTaskLinks(
    studioId: string,
    organizationId: string,
    clientIdInput?: string | null,
    appointmentIdInput?: string | null,
  ): Promise<{ clientId: string | null; appointmentId: string | null }> {
    const appointmentId = appointmentIdInput?.trim() || null;
    let clientId = clientIdInput?.trim() || null;

    if (appointmentId) {
      const appt = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { studio: { select: { organizationId: true } } },
      });
      if (!appt) {
        throw new BadRequestException('Запись не найдена');
      }
      if (appt.studio.organizationId !== organizationId) {
        throw new BadRequestException('Запись не принадлежит организации этого филиала');
      }
      if (appt.studioId !== studioId) {
        throw new BadRequestException(
          'Запись относится к другому филиалу; укажите запись из текущего филиала',
        );
      }
      if (clientId && clientId !== appt.clientId) {
        throw new BadRequestException('Указанный клиент не совпадает с клиентом записи');
      }
      clientId = appt.clientId;
    }

    if (clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: clientId, organizationId },
      });
      if (!client) {
        throw new BadRequestException('Клиент не найден в этой организации');
      }
    }

    return { clientId, appointmentId };
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
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      appointment: {
        select: {
          id: true,
          studioId: true,
          clientId: true,
          startAt: true,
          endAt: true,
          status: true,
          service: { select: { id: true, name: true } },
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

  private async resolveManagerPoolControllerIds(
    organizationId: string,
    assigneeUserId: string,
  ): Promise<string[]> {
    const managers = await this.prisma.user.findMany({
      where: {
        organizationId,
        role: UserRole.MANAGER,
        isActive: true,
      },
      select: { id: true },
    });
    return managers.map((m) => m.id).filter((id) => id !== assigneeUserId);
  }

  private async assertManagerCanAccessTask(
    userRole: string,
    userId: string,
    taskId: string,
  ): Promise<boolean> {
    if (userRole !== UserRole.MANAGER && userRole !== UserRole.ADMIN) return true;
    const rel = await this.prisma.studioTask.findFirst({
      where: {
        id: taskId,
        OR: [
          { assigneeUserId: userId },
          { controllers: { some: { userId } } },
        ],
      },
      select: { id: true },
    });
    return !!rel;
  }

  async findAll(studioId: string, userRole: string, userId: string, userStudioId?: string) {
    this.assertStudioScope(studioId, userRole, userStudioId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const where: any = { organizationId };
    if (userRole === UserRole.MASTER) {
      where.assigneeUserId = userId;
    } else if (userRole === UserRole.MANAGER || userRole === UserRole.ADMIN) {
      where.OR = [{ assigneeUserId: userId }, { controllers: { some: { userId } } }];
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
    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const deadlineAt = new Date(dto.deadlineAt);
    if (Number.isNaN(deadlineAt.getTime())) {
      throw new BadRequestException('Некорректная дата deadlineAt');
    }

    const links = await this.resolveTaskLinks(
      studioId,
      organizationId,
      dto.clientId ?? null,
      dto.appointmentId ?? null,
    );
    const audience = dto.audience ?? StudioTaskAudience.PERSONAL;
    if (
      audience === StudioTaskAudience.MANAGER_POOL &&
      !MANAGER_POOL_CREATORS.has(userRole)
    ) {
      throw new ForbiddenException(
        'MANAGER_POOL задачи может создавать только OWNER, DEPUTY_OWNER или DEVELOPER',
      );
    }
    let controllerIds: string[] = [];
    if (audience === StudioTaskAudience.MANAGER_POOL) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assigneeUserId },
        select: { organizationId: true, role: true, isActive: true },
      });
      if (
        !assignee ||
        !assignee.isActive ||
        assignee.organizationId !== organizationId ||
        assignee.role !== UserRole.MANAGER
      ) {
        throw new BadRequestException(
          'Для MANAGER_POOL исполнитель должен быть активным менеджером этой организации',
        );
      }
      controllerIds = await this.resolveManagerPoolControllerIds(
        organizationId,
        dto.assigneeUserId,
      );
    } else {
      controllerIds = [];
    }
    if (audience === StudioTaskAudience.PERSONAL && (dto.controllerUserIds ?? []).length > 0) {
      throw new BadRequestException(
        'Для PERSONAL-задачи нельзя передавать controllerUserIds: задачу видит только исполнитель',
      );
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
        clientId: links.clientId,
        appointmentId: links.appointmentId,
        controllers: {
          create: controllerIds.map((uid) => ({
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

    if (OWNER_LEVEL_OR_DEV.includes(userRole as UserRole)) {
      return task;
    }
    if (userRole === UserRole.MASTER) {
      if (task.assigneeUserId !== userId) {
        throw new ForbiddenException('Нет доступа к этой задаче');
      }
    } else if (userRole === UserRole.MANAGER || userRole === UserRole.ADMIN) {
      const ok = await this.assertManagerCanAccessTask(userRole, userId, task.id);
      if (!ok) {
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
    const isManagerLike = userRole === UserRole.MANAGER || userRole === UserRole.ADMIN;
    if (isManagerLike) {
      const ok = await this.assertManagerCanAccessTask(userRole, userId, task.id);
      if (!ok) {
        throw new ForbiddenException('Можно менять только свои задачи и задачи из общего пула');
      }
    }
    if (isMaster) {
      if (task.assigneeUserId !== userId) {
        throw new ForbiddenException('Можно менять только свои задачи');
      }
      const allowedKeys = ['status', 'rejectionComment'];
      const keys = Object.keys(dto).filter(
        (k) => (dto as Record<string, unknown>)[k] !== undefined,
      );
      const bad = keys.filter((k) => !allowedKeys.includes(k));
      if (bad.length) {
        throw new ForbiddenException(
          'Мастер может менять только статус и комментарий отказа по своей задаче',
        );
      }
      if (
        dto.status != null &&
        dto.status !== TaskStatus.DONE &&
        dto.status !== TaskStatus.OPEN &&
        dto.status !== TaskStatus.CANCELLED
      ) {
        throw new BadRequestException(
          'Мастер может перевести задачу в DONE, OPEN или CANCELLED (отказ)',
        );
      }
      if (dto.status === TaskStatus.CANCELLED) {
        if (!dto.rejectionComment || !dto.rejectionComment.trim()) {
          throw new BadRequestException(
            'При отказе от задачи мастер должен указать комментарий причины отказа',
          );
        }
      } else if (dto.rejectionComment !== undefined) {
        throw new BadRequestException('Комментарий отказа можно передать только со статусом CANCELLED');
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
    if (dto.rejectionComment !== undefined) data.rejectionComment = dto.rejectionComment.trim();
    if (dto.status !== undefined && dto.status !== TaskStatus.CANCELLED) {
      data.rejectionComment = null;
    }

    if (!isMaster && (dto.clientId !== undefined || dto.appointmentId !== undefined)) {
      let effClient: string | null | undefined =
        dto.clientId !== undefined ? dto.clientId : task.clientId;
      let effAppt: string | null | undefined =
        dto.appointmentId !== undefined ? dto.appointmentId : task.appointmentId;
      if (dto.clientId === null) effClient = null;
      if (dto.appointmentId === null) effAppt = null;

      const links = await this.resolveTaskLinks(
        studioId,
        organizationId,
        effClient ?? null,
        effAppt ?? null,
      );
      data.clientId = links.clientId;
      data.appointmentId = links.appointmentId;
    }

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

    const updatedTask = await this.prisma.studioTask.findFirst({
      where: { id: taskId },
      include: this.taskInclude(),
    });
    if (!updatedTask) {
      throw new NotFoundException('Задача не найдена');
    }

    const shouldNotifyCreator =
      isMaster &&
      dto.status === TaskStatus.CANCELLED &&
      task.createdByUserId !== userId;

    if (shouldNotifyCreator) {
      try {
        await this.notifications.createTaskRejectedNotification(
          studioId,
          task.id,
          task.createdByUserId,
          task.title,
          dto.rejectionComment!.trim(),
        );
      } catch (e) {
        this.logger.warn(`createTaskRejectedNotification failed: ${e}`);
      }
    }

    return updatedTask;
  }

  async remove(
    studioId: string,
    taskId: string,
    userRole: string,
    userId: string,
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
    if (userRole === UserRole.MANAGER || userRole === UserRole.ADMIN) {
      const ok = await this.assertManagerCanAccessTask(userRole, userId, task.id);
      if (!ok) {
        throw new ForbiddenException('Можно удалять только свои задачи и задачи из общего пула');
      }
    }

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
