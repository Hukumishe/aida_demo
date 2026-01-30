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
    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
    }

    return this.prisma.service.findMany({
      where: { studioId },
      orderBy: { name: 'asc' },
    });
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


