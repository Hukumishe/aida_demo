import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DevTicketStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateId, IdPrefix } from '../common/id-generator';
import { CreateDevTicketDto } from './dto/create-dev-ticket.dto';
import { AddDevTicketMessageDto } from './dto/add-dev-ticket-message.dto';
import { UpdateDevTicketStatusDto } from './dto/update-dev-ticket-status.dto';

export type DevTicketBucket = 'active' | 'archive';

@Injectable()
export class DevTicketsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Создание — только владелец и зам (по ТЗ). */
  private canCreateTicket(role: string | undefined): boolean {
    return role === UserRole.OWNER || role === UserRole.DEPUTY_OWNER;
  }

  /** Просмотр/чат по своей организации — владелец, зам, SERVICE. */
  private isOrgTicketViewer(role: string | undefined): boolean {
    return (
      role === UserRole.OWNER ||
      role === UserRole.DEPUTY_OWNER ||
      role === UserRole.SERVICE
    );
  }

  private assertCanCreate(role: string | undefined): void {
    if (!this.canCreateTicket(role)) {
      throw new ForbiddenException('Тикеты могут создавать только владелец и заместитель');
    }
  }

  private assertDeveloper(role: string | undefined): void {
    if (role !== UserRole.DEVELOPER) {
      throw new ForbiddenException('Действие доступно только разработчику');
    }
  }

  private assertCanViewOrgTicket(
    userRole: string | undefined,
    userOrganizationId: string | undefined,
    ticketOrganizationId: string,
  ): void {
    if (userRole === UserRole.DEVELOPER) return;
    if (
      this.isOrgTicketViewer(userRole) &&
      userOrganizationId === ticketOrganizationId
    ) {
      return;
    }
    throw new ForbiddenException('Нет доступа к этому тикету');
  }

  private assertCanPostMessage(
    userRole: string | undefined,
    userOrganizationId: string | undefined,
    ticket: {
      organizationId: string;
      status: DevTicketStatus;
    },
  ): void {
    if (ticket.status === DevTicketStatus.COMPLETED) {
      throw new BadRequestException('Тикет выполнен: чат только для чтения');
    }
    if (userRole === UserRole.DEVELOPER) return;
    if (
      this.isOrgTicketViewer(userRole) &&
      userOrganizationId === ticket.organizationId
    ) {
      return;
    }
    throw new ForbiddenException('Писать в чат могут только разработчик и сеть (владелец/зам/сервис)');
  }

  private messageUserSelect() {
    return {
      id: true,
      role: true,
      staffProfile: { select: { firstName: true, lastName: true } },
    } as const;
  }

  async create(
    userId: string,
    userRole: string | undefined,
    userOrganizationId: string | undefined,
    dto: CreateDevTicketDto,
  ) {
    this.assertCanCreate(userRole);
    if (!userOrganizationId) {
      throw new BadRequestException('Нет organizationId у пользователя');
    }

    return this.prisma.devTicket.create({
      data: {
        id: generateId(IdPrefix.DevTicket),
        organizationId: userOrganizationId,
        createdByUserId: userId,
        title: dto.title.trim(),
        problemDescription: dto.problemDescription.trim(),
        howItHappened: dto.howItHappened?.trim() ?? null,
        screenshotUrls: dto.screenshotUrls?.length ? dto.screenshotUrls : [],
        status: DevTicketStatus.OPEN,
      },
      include: {
        createdBy: { select: this.messageUserSelect() },
        organization: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(
    userRole: string | undefined,
    userOrganizationId: string | undefined,
    bucket: DevTicketBucket,
  ) {
    if (userRole === UserRole.DEVELOPER) {
      const statusFilter =
        bucket === 'active'
          ? { in: [DevTicketStatus.OPEN, DevTicketStatus.IN_PROGRESS] }
          : DevTicketStatus.COMPLETED;

      return this.prisma.devTicket.findMany({
        where: { status: statusFilter },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: this.messageUserSelect() },
          organization: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
        },
      });
    }

    if (!this.isOrgTicketViewer(userRole) || !userOrganizationId) {
      throw new ForbiddenException(
        'Список тикетов доступен владельцу, заместителю, сервису или разработчику',
      );
    }

    const statusFilter =
      bucket === 'active'
        ? { in: [DevTicketStatus.OPEN, DevTicketStatus.IN_PROGRESS] }
        : DevTicketStatus.COMPLETED;

    return this.prisma.devTicket.findMany({
      where: {
        organizationId: userOrganizationId,
        status: statusFilter,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: this.messageUserSelect() },
        _count: { select: { messages: true } },
      },
    });
  }

  async findOne(
    ticketId: string,
    userRole: string | undefined,
    userOrganizationId: string | undefined,
  ) {
    const ticket = await this.prisma.devTicket.findUnique({
      where: { id: ticketId },
      include: {
        createdBy: { select: this.messageUserSelect() },
        completedBy: { select: this.messageUserSelect() },
        organization: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: this.messageUserSelect() } },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Тикет не найден');
    }

    this.assertCanViewOrgTicket(userRole, userOrganizationId, ticket.organizationId);
    return ticket;
  }

  async addMessage(
    ticketId: string,
    userId: string,
    userRole: string | undefined,
    userOrganizationId: string | undefined,
    dto: AddDevTicketMessageDto,
  ) {
    const ticket = await this.prisma.devTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('Тикет не найден');
    }

    this.assertCanViewOrgTicket(userRole, userOrganizationId, ticket.organizationId);
    this.assertCanPostMessage(userRole, userOrganizationId, ticket);

    return this.prisma.devTicketMessage.create({
      data: {
        id: generateId(IdPrefix.DevTicketMessage),
        ticketId,
        userId,
        body: dto.body.trim(),
      },
      include: { user: { select: this.messageUserSelect() } },
    });
  }

  async updateStatus(
    ticketId: string,
    userId: string,
    userRole: string | undefined,
    dto: UpdateDevTicketStatusDto,
  ) {
    this.assertDeveloper(userRole);

    if (dto.status !== DevTicketStatus.IN_PROGRESS && dto.status !== DevTicketStatus.COMPLETED) {
      throw new BadRequestException('Можно только IN_PROGRESS или COMPLETED');
    }

    const ticket = await this.prisma.devTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('Тикет не найден');
    }

    if (ticket.status === DevTicketStatus.COMPLETED) {
      throw new BadRequestException('Тикет уже выполнен');
    }

    const data: {
      status: DevTicketStatus;
      completedAt?: Date | null;
      completedByUserId?: string | null;
    } = { status: dto.status };

    if (dto.status === DevTicketStatus.COMPLETED) {
      data.completedAt = new Date();
      data.completedByUserId = userId;
    }

    return this.prisma.devTicket.update({
      where: { id: ticketId },
      data,
      include: {
        createdBy: { select: this.messageUserSelect() },
        completedBy: { select: this.messageUserSelect() },
        organization: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: this.messageUserSelect() } },
        },
      },
    });
  }
}
