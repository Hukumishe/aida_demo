import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { getOrganizationIdForStudio } from '../common/organization-scope';
import { generateId, IdPrefix } from '../common/id-generator';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { isOwnerLevelRole } from '../common/decorators/roles.decorator';
import { ServiceAudience } from '@prisma/client';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  private assertStudioAccess(studioId: string, userRole?: string, userStudioId?: string) {
    if (!isOwnerLevelRole(userRole) && userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
    }
  }

  private async assertCategoryBelongsToOrganization(
    categoryId: string,
    organizationId: string,
  ): Promise<void> {
    const cat = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
    });
    if (!cat || cat.organizationId !== organizationId) {
      throw new BadRequestException('Категория не найдена или не принадлежит этой организации');
    }
  }

  async findAll(studioId: string, userRole?: string, userStudioId?: string) {
    try {
      this.assertStudioAccess(studioId, userRole, userStudioId);

      if (!studioId) {
        throw new NotFoundException('Studio ID is required');
      }

      const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

      return await this.prisma.service.findMany({
        where: { organizationId },
        include: { category: true },
        orderBy: [{ name: 'asc' }],
      });
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
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
    this.assertStudioAccess(studioId, userRole, userStudioId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    await this.assertCategoryBelongsToOrganization(createServiceDto.categoryId, organizationId);

    const audience = createServiceDto.audience ?? ServiceAudience.WOMEN;

    return this.prisma.service.create({
      data: {
        id: generateId(IdPrefix.Service),
        organizationId,
        name: createServiceDto.name,
        defaultDurationMin: createServiceDto.defaultDurationMin,
        defaultPrice: createServiceDto.defaultPrice,
        requiredStaffCount: createServiceDto.requiredStaffCount ?? 1,
        categoryId: createServiceDto.categoryId,
        audience,
      },
      include: { category: true },
    });
  }

  async update(
    studioId: string,
    id: string,
    updateServiceDto: UpdateServiceDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.assertStudioAccess(studioId, userRole, userStudioId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    if (service.organizationId !== organizationId) {
      throw new NotFoundException('Service not found in this studio');
    }

    const { defaultDurationMin, categoryId, ...rest } = updateServiceDto as UpdateServiceDto & {
      defaultDurationMin?: number;
    };
    if (defaultDurationMin !== undefined) {
      // игнор — стандартная длительность не меняется здесь
    }

    if (categoryId !== undefined) {
      await this.assertCategoryBelongsToOrganization(categoryId, organizationId);
    }

    const data: Record<string, unknown> = { ...rest };
    if (categoryId !== undefined) {
      data.categoryId = categoryId;
    }

    return this.prisma.service.update({
      where: { id },
      data: data as any,
      include: { category: true },
    });
  }

  async findCategories(studioId: string, userRole?: string, userStudioId?: string) {
    this.assertStudioAccess(studioId, userRole, userStudioId);
    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);
    return this.prisma.serviceCategory.findMany({
      where: { organizationId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(
    studioId: string,
    dto: CreateServiceCategoryDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.assertStudioAccess(studioId, userRole, userStudioId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    return this.prisma.serviceCategory.create({
      data: {
        id: generateId(IdPrefix.ServiceCategory),
        organizationId,
        name: dto.name.trim(),
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateCategory(
    studioId: string,
    categoryId: string,
    dto: UpdateServiceCategoryDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.assertStudioAccess(studioId, userRole, userStudioId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const cat = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
    });
    if (!cat || cat.organizationId !== organizationId) {
      throw new NotFoundException('Категория не найдена');
    }

    return this.prisma.serviceCategory.update({
      where: { id: categoryId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteCategory(
    studioId: string,
    categoryId: string,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.assertStudioAccess(studioId, userRole, userStudioId);

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const cat = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
      include: { _count: { select: { services: true } } },
    });
    if (!cat || cat.organizationId !== organizationId) {
      throw new NotFoundException('Категория не найдена');
    }
    if (cat._count.services > 0) {
      throw new BadRequestException(
        'Нельзя удалить категорию: к ней привязаны услуги. Сначала перенесите услуги в другую категорию.',
      );
    }

    await this.prisma.serviceCategory.delete({
      where: { id: categoryId },
    });
    return { success: true };
  }
}
