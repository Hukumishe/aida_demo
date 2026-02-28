import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UserRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';
import {
  getCashbackPercent,
  getLevelProgress,
  getLevelFromTotalPaid,
} from './constants/levels.constants';
import { ClientLevel } from '@prisma/client';
import * as crypto from 'crypto';

const REFERRAL_CODE_LENGTH = 6;
const REFERRAL_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  /** Генерирует уникальный реферальный код в рамках студии. */
  private async generateReferralCode(studioId: string): Promise<string> {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = '';
      const bytes = crypto.randomBytes(REFERRAL_CODE_LENGTH);
      for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
        code += REFERRAL_CODE_CHARS[bytes[i]! % REFERRAL_CODE_CHARS.length];
      }
      const existing = await this.prisma.client.findUnique({
        where: { studioId_referralCode: { studioId, referralCode: code } },
      });
      if (!existing) return code;
    }
    throw new BadRequestException('Could not generate unique referral code');
  }

  async findAll(studioId: string, query?: string, userRole?: string, userStudioId?: string) {
    // Check access
    // OWNER, DEPUTY_OWNER and MANAGER have access to all studios
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      // ADMIN can only access their own studio
      if (userRole === UserRole.ADMIN && userStudioId !== studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }
      // MASTER should not access client list directly (only through appointments)
      if (userRole === UserRole.MASTER) {
        throw new ForbiddenException('Masters cannot access client list');
      }
    }

    const where: any = { studioId, isBlacklisted: false };

    if (query) {
      where.OR = [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query, mode: 'insensitive' } },
      ];
    }

    const clients = await this.prisma.client.findMany({
      where,
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });

    if (clients.length === 0) return clients;

    const clientIds = clients.map((c) => c.id);
    const visitStats = await this.prisma.appointment.groupBy({
      by: ['clientId'],
      where: {
        clientId: { in: clientIds },
        status: 'DONE',
      },
      _count: true,
      _max: { startAt: true },
    });
    const statsByClient = new Map(
      visitStats.map((s) => [
        s.clientId,
        { totalVisits: s._count, lastVisitAt: s._max.startAt ?? null },
      ]),
    );

    return clients.map((client) => {
      const stats = statsByClient.get(client.id) ?? { totalVisits: 0, lastVisitAt: null };
      return {
        ...client,
        totalVisits: stats.totalVisits,
        lastVisitAt: stats.lastVisitAt,
      };
    });
  }

  async create(
    studioId: string,
    createClientDto: CreateClientDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    // Check access
    // OWNER, DEPUTY_OWNER and MANAGER have access to all studios
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      // ADMIN can only create clients in their own studio
      if (userRole === UserRole.ADMIN && userStudioId !== studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }
      // MASTER cannot create clients
      if (userRole === UserRole.MASTER) {
        throw new ForbiddenException('Masters cannot create clients');
      }
    }

    // Verify studio exists
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
    });
    if (!studio) {
      throw new NotFoundException(`Studio with ID ${studioId} not found`);
    }

    // Check phone uniqueness within studio
    const existingClient = await this.prisma.client.findUnique({
      where: {
        studioId_phone: {
          studioId,
          phone: createClientDto.phone,
        },
      },
    });

    if (existingClient) {
      throw new BadRequestException('Client with this phone already exists in this studio');
    }

    const referralCode = await this.generateReferralCode(studioId);
    try {
      return await this.prisma.client.create({
        data: {
          studioId,
          firstName: createClientDto.firstName,
          lastName: createClientDto.lastName,
          phone: createClientDto.phone,
          birthDate: createClientDto.birthDate ? new Date(createClientDto.birthDate) : undefined,
          notes: createClientDto.notes,
          bonuses: createClientDto.bonuses ?? 0,
          discount: createClientDto.discount ?? 0,
          balance: createClientDto.balance ?? 0,
          referralCode,
        },
      });
    } catch (error: any) {
      // Handle Prisma unique constraint errors
      if (error.code === 'P2002') {
        throw new BadRequestException('Client with this phone already exists in this studio');
      }
      throw error;
    }
  }

  async findOne(id: string, userRole?: string, userStudioId?: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        studio: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { referredClients: true },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    // Check access
    // OWNER, DEPUTY_OWNER and MANAGER have access to all studios
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      // ADMIN can only access clients from their own studio
      if (userRole === UserRole.ADMIN && userStudioId !== client.studioId) {
        throw new ForbiddenException('Access denied to this client');
      }
      // MASTER cannot access client details (phone is hidden in appointments)
      if (userRole === UserRole.MASTER) {
        throw new ForbiddenException('Masters cannot access client details');
      }
    }

    // Для старых клиентов без реферального кода — сгенерировать при первом чтении
    if (!client.referralCode) {
      client.referralCode = await this.generateReferralCode(client.studioId);
      await this.prisma.client.update({
        where: { id: client.id },
        data: { referralCode: client.referralCode },
      });
    }

    // Hide phone for MASTER (though they shouldn't access this endpoint)
    const referredCount = (client as any)._count?.referredClients ?? 0;
    if (userRole === UserRole.MASTER) {
      const { _count, ...rest } = client as any;
      return {
        ...rest,
        referredCount,
        phone: undefined,
      };
    }

    const level = (client as any).level ?? 'BRONZE';
    const totalPaidForLevel = (client as any).totalPaidForLevel ?? 0;
    const { _count, ...clientData } = client as any;
    return {
      ...clientData,
      referredCount,
      cashbackPercent: getCashbackPercent(level),
      levelProgress: getLevelProgress(totalPaidForLevel, level),
    };
  }

  async update(
    id: string,
    updateClientDto: UpdateClientDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    // Check access
    // OWNER, DEPUTY_OWNER and MANAGER have access to all studios
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      // ADMIN can only update clients from their own studio
      if (userRole === UserRole.ADMIN && userStudioId !== client.studioId) {
        throw new ForbiddenException('Access denied to this client');
      }
      // MASTER cannot update clients
      if (userRole === UserRole.MASTER) {
        throw new ForbiddenException('Masters cannot update clients');
      }
    }

    // Check phone uniqueness if phone is being updated
    if (updateClientDto.phone && updateClientDto.phone !== client.phone) {
      const existingClient = await this.prisma.client.findUnique({
        where: {
          studioId_phone: {
            studioId: client.studioId,
            phone: updateClientDto.phone,
          },
        },
      });

      if (existingClient) {
        throw new BadRequestException('Client with this phone already exists in this studio');
      }
    }

    // Только Owner и Deputy могут назначать или снимать DIAMOND
    const assigningDiamond =
      updateClientDto.level === ClientLevel.DIAMOND || updateClientDto.levelSetManually === true;
    const removingDiamond =
      (client as any).level === ClientLevel.DIAMOND &&
      (updateClientDto.levelSetManually === false ||
        (updateClientDto.level !== undefined && updateClientDto.level !== ClientLevel.DIAMOND));
    if (assigningDiamond || removingDiamond) {
      if (!isOwnerLevelRole(userRole)) {
        throw new ForbiddenException('Only owner or deputy owner can assign or remove DIAMOND level');
      }
    }

    if (updateClientDto.level !== undefined && updateClientDto.level !== ClientLevel.DIAMOND) {
      (updateClientDto as any).levelSetManually = false;
    }

    // Снять DIAMOND: передали levelSetManually: false — пересчитать уровень по totalPaidForLevel
    const data: any = { ...updateClientDto };
    if (
      updateClientDto.levelSetManually === false &&
      (client as any).level === ClientLevel.DIAMOND &&
      updateClientDto.level === undefined
    ) {
      const totalPaid = (client as any).totalPaidForLevel ?? 0;
      data.level = getLevelFromTotalPaid(totalPaid);
    }
    if (data.birthDate !== undefined) {
      data.birthDate = data.birthDate ? new Date(data.birthDate) : null;
    }
    return this.prisma.client.update({
      where: { id },
      data,
    });
  }

  /**
   * Client segments for dashboard: New, Never visited, Sleeping (3–6 months no booking), Missing (6+ months no booking).
   * Counts are mutually exclusive; blacklisted clients are excluded.
   */
  async getClientSegments(
    studioId: string,
    userRole?: string,
    userStudioId?: string,
  ) {
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userRole === UserRole.ADMIN && userStudioId !== studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }
      if (userRole === UserRole.MASTER) {
        throw new ForbiddenException('Masters cannot access client segments');
      }
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const clients = await this.prisma.client.findMany({
      where: { studioId, isBlacklisted: false },
      select: { id: true, createdAt: true },
    });
    const clientIds = clients.map((c) => c.id);
    if (clientIds.length === 0) {
      return {
        new: 0,
        neverVisited: 0,
        sleeping: 0,
        missing: 0,
      };
    }

    const lastAppointmentByClient = await this.prisma.appointment.groupBy({
      by: ['clientId'],
      where: { clientId: { in: clientIds } },
      _max: { startAt: true },
    });
    const lastByClient = new Map(
      lastAppointmentByClient.map((r) => [r.clientId, r._max.startAt]),
    );

    let newCount = 0;
    let neverVisited = 0;
    let sleeping = 0;
    let missing = 0;

    for (const c of clients) {
      const lastAt = lastByClient.get(c.id);
      const createdInLastWeek = c.createdAt >= sevenDaysAgo;

      if (!lastAt) {
        if (createdInLastWeek) newCount++;
        else neverVisited++;
        continue;
      }
      if (lastAt < sixMonthsAgo) missing++;
      else if (lastAt < threeMonthsAgo) sleeping++;
      else if (createdInLastWeek) newCount++;
    }

    return {
      new: newCount,
      neverVisited,
      sleeping,
      missing,
    };
  }

  async getClientStatistics(id: string, userRole?: string, userStudioId?: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    // Check access
    // OWNER, DEPUTY_OWNER and MANAGER have access to all studios
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      // ADMIN can only update clients from their own studio
      if (userRole === UserRole.ADMIN && userStudioId !== client.studioId) {
        throw new ForbiddenException('Access denied to this client');
      }
      // MASTER cannot update clients
      if (userRole === UserRole.MASTER) {
        throw new ForbiddenException('Masters cannot update clients');
      }
    }

    // Only completed (DONE) visits for card stats: visits count and average check
    const appointments = await this.prisma.appointment.findMany({
      where: {
        clientId: id,
        status: 'DONE',
      },
      include: {
        service: true,
        upsells: true,
      },
    });

    // Resolve main-service price per appointment (staff override or service default)
    const staffServiceKeys = [
      ...new Set(
        appointments.map((a) => ({ studioId: a.studioId, staffUserId: a.staffUserId, serviceId: a.serviceId })),
      ),
    ];
    const overrides = staffServiceKeys.length
      ? await this.prisma.staffServiceOverride.findMany({
          where: {
            isActive: true,
            OR: staffServiceKeys.map((k) => ({
              studioId: k.studioId,
              staffUserId: k.staffUserId,
              serviceId: k.serviceId,
            })),
          },
        })
      : [];
    const overridePriceByKey = new Map(
      overrides.map((o) => [`${o.studioId}:${o.staffUserId}:${o.serviceId}`, o.price]),
    );

    // Calculate statistics: only service price + additional services (upsells); prepayment is excluded
    const totalVisits = appointments.length;
    const totalRevenue = appointments.reduce((sum, a) => {
      const key = `${a.studioId}:${a.staffUserId}:${a.serviceId}`;
      const servicePrice = overridePriceByKey.get(key) ?? a.service.defaultPrice ?? 0;
      const upsellsTotal = a.upsells.reduce((acc, u) => acc + u.totalAmount, 0);
      return sum + servicePrice + upsellsTotal;
    }, 0);

    const averageCheck = totalVisits > 0 ? Math.round(totalRevenue / totalVisits) : 0;

    return {
      totalVisits,
      averageCheck,
      totalSpent: totalRevenue,
    };
  }

  async getClientAppointments(
    id: string,
    upcomingOnly: boolean = false,
    userRole?: string,
    userStudioId?: string,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    // Check access
    // OWNER, DEPUTY_OWNER and MANAGER have access to all studios
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      // ADMIN can only update clients from their own studio
      if (userRole === UserRole.ADMIN && userStudioId !== client.studioId) {
        throw new ForbiddenException('Access denied to this client');
      }
      // MASTER cannot update clients
      if (userRole === UserRole.MASTER) {
        throw new ForbiddenException('Masters cannot update clients');
      }
    }

    const where: any = {
      clientId: id,
    };

    // If upcomingOnly, filter by future dates and specific statuses
    if (upcomingOnly) {
      where.startAt = {
        gte: new Date(),
      };
      where.status = {
        in: ['BOOKED', 'ARRIVED'],
      };
    }

    return this.prisma.appointment.findMany({
      where,
      include: {
        staff: {
          include: {
            staffProfile: true,
          },
        },
        service: true,
        arrivedByUser: {
          select: {
            id: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        startAt: upcomingOnly ? 'asc' : 'desc',
      },
    });
  }

  async getBonusHistory(clientId: string, userRole?: string, userStudioId?: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, studioId: true },
    });
    if (!client) throw new NotFoundException(`Client with ID ${clientId} not found`);
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userRole === UserRole.ADMIN && userStudioId !== client.studioId) {
        throw new ForbiddenException('Access denied to this client');
      }
      if (userRole === UserRole.MASTER) throw new ForbiddenException('Access denied');
    }
    return this.prisma.bonusHistoryEntry.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async bonusAdjustment(
    clientId: string,
    dto: { amount: number; comment?: string },
    userId: string,
    userRole?: string,
    userStudioId?: string,
  ) {
    if (userRole !== UserRole.OWNER) {
      throw new ForbiddenException('Only owner can manually adjust bonus balance');
    }
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, studioId: true, bonuses: true },
    });
    if (!client) throw new NotFoundException(`Client with ID ${clientId} not found`);
    const newBalance = client.bonuses + dto.amount;
    if (newBalance < 0) {
      throw new BadRequestException('Adjustment would result in negative bonus balance');
    }
    await this.prisma.$transaction([
      this.prisma.client.update({
        where: { id: clientId },
        data: { bonuses: newBalance },
      }),
      this.prisma.bonusHistoryEntry.create({
        data: {
          clientId,
          studioId: client.studioId,
          amount: dto.amount,
          type: 'MANUAL_ADJUSTMENT',
          performedByUserId: userId,
          comment: dto.comment ?? null,
        },
      }),
    ]);
    return this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, bonuses: true },
    });
  }
}




