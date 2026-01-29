import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UserRole } from '../common/decorators/roles.decorator';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(studioId: string, query?: string, userRole?: string, userStudioId?: string) {
    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
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
    if (userRole !== UserRole.OWNER && userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
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

    return this.prisma.client.create({
      data: {
        studioId,
        firstName: createClientDto.firstName,
        lastName: createClientDto.lastName,
        phone: createClientDto.phone,
        notes: createClientDto.notes,
      },
    });
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
    if (userRole !== UserRole.OWNER && userStudioId !== client.studioId) {
      throw new ForbiddenException('Access denied to this client');
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
    if (userRole !== UserRole.OWNER && userStudioId !== client.studioId) {
      throw new ForbiddenException('Access denied to this client');
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
}

