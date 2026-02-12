import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { UserRole } from '../common/decorators/roles.decorator';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(studioId: string, userRole?: string, userStudioId?: string) {
    try {
      // Check access
      if (userRole !== UserRole.OWNER && userStudioId !== studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }

      // Validate studioId
      if (!studioId) {
        throw new NotFoundException('Studio ID is required');
      }

      return await this.prisma.service.findMany({
        where: { 
          studioId,
          // Возвращаем все услуги, включая неактивные (можно отфильтровать на frontend если нужно)
        },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      // Если это уже NestJS исключение, пробрасываем дальше
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      // Логируем неожиданные ошибки
      console.error('Error in ServicesService.findAll:', error);
      throw error;
    }
  }

  async create(
    studioId: string,
    createServiceDto: CreateServiceDto,
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

    return this.prisma.service.create({
      data: {
        studioId,
        name: createServiceDto.name,
        defaultDurationMin: createServiceDto.defaultDurationMin,
        defaultPrice: createServiceDto.defaultPrice,
        requiredStaffCount: createServiceDto.requiredStaffCount ?? 1,
      },
    });
  }

  async update(
    id: string,
    updateServiceDto: UpdateServiceDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== service.studioId) {
      throw new ForbiddenException('Access denied to this service');
    }

    return this.prisma.service.update({
      where: { id },
      data: updateServiceDto,
    });
  }
}




