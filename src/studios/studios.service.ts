import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateStudioDto } from './dto/create-studio.dto';
import { UserRole } from '../common/decorators/roles.decorator';

@Injectable()
export class StudiosService {
  constructor(private prisma: PrismaService) {}

  async findAll(userRole: string, userStudioId?: string) {
    if (userRole === UserRole.OWNER) {
      return this.prisma.studio.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }

    // MANAGER and MASTER can only see their studio
    if (!userStudioId) {
      return [];
    }

    return this.prisma.studio.findMany({
      where: { id: userStudioId },
    });
  }

  async create(createStudioDto: CreateStudioDto) {
    return this.prisma.studio.create({
      data: {
        name: createStudioDto.name,
        address: createStudioDto.address,
        timezone: createStudioDto.timezone || 'Europe/Moscow',
      },
    });
  }

  async findOne(id: string, userRole: string, userStudioId?: string) {
    const studio = await this.prisma.studio.findUnique({
      where: { id },
    });

    if (!studio) {
      return null;
    }

    // OWNER can access any studio
    if (userRole === UserRole.OWNER) {
      return studio;
    }

    // MANAGER and MASTER can only access their studio
    if (userStudioId !== id) {
      throw new ForbiddenException('Access denied to this studio');
    }

    return studio;
  }
}

