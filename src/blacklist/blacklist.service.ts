import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBlacklistRequestDto } from './dto/create-blacklist-request.dto';
import { ApproveBlacklistRequestDto } from './dto/approve-blacklist-request.dto';
import { RejectBlacklistRequestDto } from './dto/reject-blacklist-request.dto';
import { UserRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';

@Injectable()
export class BlacklistService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Создать запрос на добавление клиента в черный список
   * Могут создавать только MANAGER и ADMIN
   */
  async createRequest(
    clientId: string,
    createDto: CreateBlacklistRequestDto,
    userRole: string,
    userId: string,
    userStudioId?: string,
  ) {
    // Проверка прав доступа
    // OWNER и DEPUTY_OWNER могут создавать запросы, которые автоматически одобряются
    if (
      userRole !== UserRole.MANAGER &&
      userRole !== UserRole.ADMIN &&
      !isOwnerLevelRole(userRole)
    ) {
      throw new ForbiddenException('Only managers, admins, owners and deputy owners can create blacklist requests');
    }

    // Найти клиента
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        studio: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // Проверка доступа к студии
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userStudioId !== client.studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }
    }

    // Проверить, не находится ли клиент уже в черном списке
    if (client.isBlacklisted) {
      throw new BadRequestException('Client is already blacklisted');
    }

    // Проверить, что клиент не является пользователем системы (OWNER, DEPUTY_OWNER, ADMIN, MANAGER, MASTER)
    const userWithSamePhone = await this.prisma.user.findUnique({
      where: { phone: client.phone },
    });

    if (userWithSamePhone) {
      throw new BadRequestException('System users (owners, admins, managers, masters) cannot be added to blacklist');
    }

    // Проверить, нет ли уже активного запроса
    const existingRequest = await this.prisma.blacklistRequest.findFirst({
      where: {
        clientId,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      throw new BadRequestException('There is already a pending request for this client');
    }

    // Получить информацию о пользователе, создающем запрос
    const requestedBy = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        staffProfile: true,
      },
    });

    const requestedByName = requestedBy?.staffProfile
      ? `${requestedBy.staffProfile.firstName} ${requestedBy.staffProfile.lastName || ''}`.trim()
      : requestedBy?.email || requestedBy?.phone || 'Неизвестный';

    // Создать запрос
    const request = await this.prisma.blacklistRequest.create({
      data: {
        studioId: client.studioId,
        clientId,
        requestedByUserId: userId,
        reason: createDto.reason,
        status: 'PENDING',
      },
      include: {
        client: true,
        requestedBy: {
          include: {
            staffProfile: true,
          },
        },
      },
    });

    // Если запрос создан OWNER или DEPUTY_OWNER, автоматически одобрить его
    if (isOwnerLevelRole(userRole)) {
      // Найти всех клиентов с таким же телефоном во всех студиях
      const clientsWithSamePhone = await this.prisma.client.findMany({
        where: {
          phone: client.phone,
        },
      });

      // Обновить запрос и всех клиентов с таким же телефоном
      const [updatedRequest] = await this.prisma.$transaction([
        this.prisma.blacklistRequest.update({
          where: { id: request.id },
          data: {
            status: 'APPROVED',
            approvedByUserId: userId,
            approvedAt: new Date(),
          },
        }),
        // Обновить всех клиентов с таким же телефоном во всех студиях
        this.prisma.client.updateMany({
          where: {
            phone: client.phone,
          },
          data: {
            isBlacklisted: true,
            blacklistReason: createDto.reason,
          },
        }),
      ]);

      return updatedRequest;
    }

    // Для MANAGER и ADMIN - создать уведомления для владельцев
    const clientName = `${client.firstName} ${client.lastName || ''}`.trim();
    await this.notificationsService.createBlacklistRequestNotification(
      client.studioId,
      request.id,
      clientName,
      requestedByName,
      createDto.reason,
    );

    return request;
  }

  /**
   * Добавить клиента в черный список напрямую (для OWNER и DEPUTY_OWNER)
   * Без создания запроса - сразу добавляет в ЧС
   */
  async addToBlacklistDirectly(
    clientId: string,
    createDto: CreateBlacklistRequestDto,
    userRole: string,
    userId: string,
  ) {
    // Проверка прав доступа
    if (!isOwnerLevelRole(userRole)) {
      throw new ForbiddenException('Only owners and deputy owners can add clients to blacklist directly');
    }

    // Найти клиента
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        studio: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // Проверить, не находится ли клиент уже в черном списке
    if (client.isBlacklisted) {
      throw new BadRequestException('Client is already blacklisted');
    }

    // Проверить, что клиент не является пользователем системы
    const userWithSamePhone = await this.prisma.user.findUnique({
      where: { phone: client.phone },
    });

    if (userWithSamePhone) {
      throw new BadRequestException('System users (owners, admins, managers, masters) cannot be added to blacklist');
    }

    // Найти всех клиентов с таким же телефоном во всех студиях
    const clientsWithSamePhone = await this.prisma.client.findMany({
      where: {
        phone: client.phone,
      },
    });

    // Добавить всех клиентов с таким же телефоном в черный список
    await this.prisma.client.updateMany({
      where: {
        phone: client.phone,
      },
      data: {
        isBlacklisted: true,
        blacklistReason: createDto.reason,
      },
    });

    return {
      message: 'Client added to blacklist',
      clientsUpdated: clientsWithSamePhone.length,
      client: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        isBlacklisted: true,
        blacklistReason: createDto.reason,
      },
    };
  }

  /**
   * Получить все запросы на добавление в черный список
   */
  async findAllRequests(
    studioId: string,
    userRole: string,
    userStudioId?: string,
    status?: string,
  ) {
    // Проверка доступа
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userStudioId !== studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }
    }

    const where: any = { studioId };
    if (status) {
      where.status = status;
    }

    return this.prisma.blacklistRequest.findMany({
      where,
      include: {
        client: true,
        requestedBy: {
          include: {
            staffProfile: true,
          },
        },
        approvedBy: {
          include: {
            staffProfile: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Одобрить запрос на добавление в черный список
   * Могут только OWNER и DEPUTY_OWNER
   */
  async approveRequest(
    requestId: string,
    approveDto: ApproveBlacklistRequestDto,
    userRole: string,
    userId: string,
  ) {
    // Проверка прав доступа
    if (!isOwnerLevelRole(userRole)) {
      throw new ForbiddenException('Only owners and deputy owners can approve blacklist requests');
    }

    // Найти запрос
    const request = await this.prisma.blacklistRequest.findUnique({
      where: { id: requestId },
      include: {
        client: true,
        studio: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Blacklist request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request is already ${request.status.toLowerCase()}`);
    }

    // Найти всех клиентов с таким же телефоном во всех студиях
    const clientsWithSamePhone = await this.prisma.client.findMany({
      where: {
        phone: request.client.phone,
      },
    });

    // Обновить запрос и всех клиентов с таким же телефоном (сохранить причину в карточке клиента)
    const [updatedRequest] = await this.prisma.$transaction([
      this.prisma.blacklistRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedByUserId: userId,
          approvedAt: new Date(),
        },
      }),
      // Обновить всех клиентов с таким же телефоном во всех студиях
      this.prisma.client.updateMany({
        where: {
          phone: request.client.phone,
        },
        data: {
          isBlacklisted: true,
          blacklistReason: request.reason,
        },
      }),
    ]);

    return updatedRequest;
  }

  /**
   * Отклонить запрос на добавление в черный список
   * Могут только OWNER и DEPUTY_OWNER
   */
  async rejectRequest(
    requestId: string,
    rejectDto: RejectBlacklistRequestDto,
    userRole: string,
    userId: string,
  ) {
    // Проверка прав доступа
    if (!isOwnerLevelRole(userRole)) {
      throw new ForbiddenException('Only owners and deputy owners can reject blacklist requests');
    }

    // Найти запрос
    const request = await this.prisma.blacklistRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Blacklist request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request is already ${request.status.toLowerCase()}`);
    }

    // Обновить запрос
    return this.prisma.blacklistRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectedReason: rejectDto.rejectedReason,
        rejectedAt: new Date(),
      },
    });
  }

  /**
   * Получить список клиентов в черном списке
   */
  async getBlacklistedClients(
    studioId: string,
    userRole: string,
    userStudioId?: string,
  ) {
    // Проверка доступа
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userStudioId !== studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }
    }

    return this.prisma.client.findMany({
      where: {
        studioId,
        isBlacklisted: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  /**
   * Удалить клиента из черного списка
   * Могут только OWNER и DEPUTY_OWNER
   */
  async removeFromBlacklist(
    clientId: string,
    userRole: string,
  ) {
    // Проверка прав доступа
    if (!isOwnerLevelRole(userRole)) {
      throw new ForbiddenException('Only owners and deputy owners can remove clients from blacklist');
    }

    // Найти клиента, чтобы получить его телефон
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (!client.isBlacklisted) {
      throw new BadRequestException('Client is not in blacklist');
    }

    // Удалить из черного списка во всех студиях (очистить причину)
    // Находим всех клиентов с таким же телефоном и удаляем их из ЧС
    return this.prisma.client.updateMany({
      where: {
        phone: client.phone,
      },
      data: {
        isBlacklisted: false,
        blacklistReason: null,
      },
    });
  }
}


