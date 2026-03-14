import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateId, IdPrefix } from '../common/id-generator';
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
        id: generateId(IdPrefix.Studio),
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

  async getSettings(studioId: string, userRole: string, userStudioId?: string) {
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { id: true, globalBonusPaymentLimitPercent: true },
    });
    if (!studio) throw new NotFoundException('Studio not found');
    if (!isOwnerLevelRole(userRole) && userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
    }
    return { globalBonusPaymentLimitPercent: studio.globalBonusPaymentLimitPercent ?? 30 };
  }

  async updateSettings(
    studioId: string,
    dto: { globalBonusPaymentLimitPercent?: number },
    userRole: string,
  ) {
    if (!isOwnerLevelRole(userRole)) {
      throw new ForbiddenException('Only owner level role can change global bonus payment limit');
    }
    const studio = await this.prisma.studio.findUnique({ where: { id: studioId } });
    if (!studio) throw new NotFoundException('Studio not found');
    return this.prisma.studio.update({
      where: { id: studioId },
      data: {
        globalBonusPaymentLimitPercent: dto.globalBonusPaymentLimitPercent,
      },
    });
  }
}


