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

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

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

    const where: any = { studioId };

    if (query) {
      where.OR = [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query, mode: 'insensitive' } },
      ];
    }

    return this.prisma.client.findMany({
      where,
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
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

    try {
      return await this.prisma.client.create({
        data: {
          studioId,
          firstName: createClientDto.firstName,
          lastName: createClientDto.lastName,
          phone: createClientDto.phone,
          notes: createClientDto.notes,
          bonuses: createClientDto.bonuses ?? 0,
          discount: createClientDto.discount ?? 0,
          balance: createClientDto.balance ?? 0,
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

    // Hide phone for MASTER (though they shouldn't access this endpoint)
    if (userRole === UserRole.MASTER) {
      return {
        ...client,
        phone: undefined,
      };
    }

    return client;
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

    return this.prisma.client.update({
      where: { id },
      data: updateClientDto,
    });
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

    // Get all appointments for this client
    const appointments = await this.prisma.appointment.findMany({
      where: {
        clientId: id,
        status: {
          not: 'CANCELLED', // Exclude cancelled appointments
        },
      },
      include: {
        service: true,
      },
    });

    // Calculate statistics
    const totalVisits = appointments.length;
    
    // Calculate average check (average of prepaymentAmount or service.defaultPrice)
    const totalRevenue = appointments.reduce((sum, a) => {
      const amount = a.prepaymentAmount || a.service.defaultPrice || 0;
      return sum + amount;
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
}




