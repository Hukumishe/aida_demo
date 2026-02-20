import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateStudioDto } from './dto/create-studio.dto';
import { UserRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';

@Injectable()
export class StudiosService {
  constructor(private prisma: PrismaService) {}

  async findAll(userRole: string, userStudioId?: string) {
    if (isOwnerLevelRole(userRole)) {
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
        timezone: createStudioDto.timezone || 'Asia/Almaty',
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

    // OWNER and DEPUTY_OWNER can access any studio
    if (isOwnerLevelRole(userRole)) {
      return studio;
    }

    // MANAGER and MASTER can only access their studio
    if (userStudioId !== id) {
      throw new ForbiddenException('Access denied to this studio');
    }

    return studio;
  }
}


