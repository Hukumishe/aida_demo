import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  assertUserOrganizationMatchesStudio,
  assertUserOrganizationMatchesStudioOrganizationId,
  getOrganizationIdForStudio,
} from '../common/organization-scope';
import {
  getDisabledServiceIdsForStudio,
  getDisabledCategoryIdsForStudio,
  isServiceOfferedInStudio,
} from '../common/service-studio-offering';
import { generateId, IdPrefix } from '../common/id-generator';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { UserRole, isDeveloperRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';
import { ServiceAudience } from '@prisma/client';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  /** Доступ к редактированию каталога услуг организации (как раньше при совпадении studio в пути). */
  private assertOrganizationCatalogAccess(userRole?: string, userStudioId?: string) {
    if (isOwnerLevelRole(userRole) || userRole === UserRole.MANAGER) {
      return;
    }
    if (userRole === UserRole.ADMIN || userRole === UserRole.MASTER) {
      if (userStudioId) {
        return;
      }
    }
    throw new ForbiddenException('Access denied');
  }

  private async resolveOrganizationId(
    userRole: string | undefined,
    userOrganizationId: string | undefined,
    organizationIdQuery: string | undefined,
  ): Promise<string> {
    if (isDeveloperRole(userRole) && organizationIdQuery?.trim()) {
      const organizationId = organizationIdQuery.trim();
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      });
      if (!org) {
        throw new NotFoundException(`Organization with ID ${organizationId} not found`);
      }
      return organizationId;
    }
    if (!userOrganizationId?.trim()) {
      throw new BadRequestException('Organization context required');
    }
    const organizationId = userOrganizationId.trim();
    assertUserOrganizationMatchesStudioOrganizationId(
      organizationId,
      userOrganizationId,
      userRole,
    );
    return organizationId;
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

  /**
   * Каталог услуг организации (один на все филиалы).
   * Query `studioId` — опционально: добавить `isOfferedInStudio` для выбранного филиала.
   * Query `organizationId` — только DEVELOPER: чужая организация.
   */
  async findAll(
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
    studioIdForOffering?: string,
  ) {
    try {
      const organizationId = await this.resolveOrganizationId(
        userRole,
        userOrganizationId,
        organizationIdQuery,
      );

      const services = await this.prisma.service.findMany({
        where: { organizationId },
        include: { category: true },
        orderBy: [{ name: 'asc' }],
      });

      if (!studioIdForOffering?.trim()) {
        return services;
      }

      const sid = studioIdForOffering.trim();
      await assertUserOrganizationMatchesStudio(
        this.prisma,
        sid,
        userOrganizationId,
        userRole,
      );

      const [disabledIds, disabledCategoryIds] = await Promise.all([
        getDisabledServiceIdsForStudio(this.prisma, sid),
        getDisabledCategoryIdsForStudio(this.prisma, sid),
      ]);
      return services.map((s) => ({
        ...s,
        isOfferedInStudio: isServiceOfferedInStudio(
          s,
          s.category,
          disabledIds,
          disabledCategoryIds,
        ),
      }));
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error in ServicesService.findAll:', error);
      throw error;
    }
  }

  async create(
    createServiceDto: CreateServiceDto,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ) {
    this.assertOrganizationCatalogAccess(userRole, userStudioId);

    const organizationId = await this.resolveOrganizationId(
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );

    await this.assertCategoryBelongsToOrganization(createServiceDto.categoryId, organizationId);

    const audience = createServiceDto.audience ?? ServiceAudience.WOMEN;

    const created = await this.prisma.service.create({
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
    return { ...created, isOfferedInStudio: true };
  }

  async update(
    id: string,
    updateServiceDto: UpdateServiceDto,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ) {
    this.assertOrganizationCatalogAccess(userRole, userStudioId);

    const organizationId = await this.resolveOrganizationId(
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );

    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    if (service.organizationId !== organizationId) {
      throw new NotFoundException('Service not found in this organization');
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

  /**
   * Включить/выключить услугу только в данном филиале.
   * Каталог организации (`Service.isActive`) и другие филиалы не затрагиваются.
   */
  async setStudioServiceOffering(
    serviceId: string,
    studioId: string,
    offered: boolean,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
  ) {
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userRole === UserRole.ADMIN || userRole === UserRole.MASTER) {
        if (userStudioId !== studioId) {
          throw new ForbiddenException('Access denied to this studio');
        }
      } else {
        throw new ForbiddenException('Access denied');
      }
    }

    await assertUserOrganizationMatchesStudio(
      this.prisma,
      studioId,
      userOrganizationId,
      userRole,
    );

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service || service.organizationId !== organizationId) {
      throw new NotFoundException('Service not found in this organization');
    }

    if (offered) {
      await this.prisma.studioDisabledService.deleteMany({
        where: { studioId, serviceId },
      });
    } else {
      await this.prisma.studioDisabledService.upsert({
        where: {
          studioId_serviceId: { studioId, serviceId },
        },
        create: { studioId, serviceId },
        update: {},
      });
    }

    const [disabledIds, disabledCategoryIds] = await Promise.all([
      getDisabledServiceIdsForStudio(this.prisma, studioId),
      getDisabledCategoryIdsForStudio(this.prisma, studioId),
    ]);
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: service.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Category not found for service');
    }
    return {
      ...service,
      isOfferedInStudio: isServiceOfferedInStudio(
        service,
        category,
        disabledIds,
        disabledCategoryIds,
      ),
    };
  }

  /**
   * Включить/выключить категорию только в данном филиале (как услуги).
   * Каталог сети (`ServiceCategory.isActive`) и другие филиалы не меняются.
   */
  async setStudioCategoryOffering(
    categoryId: string,
    studioId: string,
    offered: boolean,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
  ) {
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userRole === UserRole.ADMIN || userRole === UserRole.MASTER) {
        if (userStudioId !== studioId) {
          throw new ForbiddenException('Access denied to this studio');
        }
      } else {
        throw new ForbiddenException('Access denied');
      }
    }

    await assertUserOrganizationMatchesStudio(
      this.prisma,
      studioId,
      userOrganizationId,
      userRole,
    );

    const organizationId = await getOrganizationIdForStudio(this.prisma, studioId);

    const cat = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
    });
    if (!cat || cat.organizationId !== organizationId) {
      throw new NotFoundException('Category not found in this organization');
    }

    if (offered) {
      await this.prisma.studioDisabledCategory.deleteMany({
        where: { studioId, categoryId },
      });
    } else {
      await this.prisma.studioDisabledCategory.upsert({
        where: {
          studioId_categoryId: { studioId, categoryId },
        },
        create: { studioId, categoryId },
        update: {},
      });
    }

    const disabledCategoryIds = await getDisabledCategoryIdsForStudio(this.prisma, studioId);
    return {
      ...cat,
      isOfferedInStudio: cat.isActive && !disabledCategoryIds.has(cat.id),
    };
  }

  async findCategories(
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
    studioIdForOffering?: string,
  ) {
    const organizationId = await this.resolveOrganizationId(
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );
    const categories = await this.prisma.serviceCategory.findMany({
      where: { organizationId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    if (!studioIdForOffering?.trim()) {
      return categories;
    }
    const sid = studioIdForOffering.trim();
    await assertUserOrganizationMatchesStudio(
      this.prisma,
      sid,
      userOrganizationId,
      userRole,
    );
    const disabledCategoryIds = await getDisabledCategoryIdsForStudio(this.prisma, sid);
    return categories.map((c) => ({
      ...c,
      isOfferedInStudio: c.isActive && !disabledCategoryIds.has(c.id),
    }));
  }

  async createCategory(
    dto: CreateServiceCategoryDto,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ) {
    this.assertOrganizationCatalogAccess(userRole, userStudioId);

    const organizationId = await this.resolveOrganizationId(
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );

    return this.prisma.serviceCategory.create({
      data: {
        id: generateId(IdPrefix.ServiceCategory),
        organizationId,
        name: dto.name.trim(),
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateCategory(
    categoryId: string,
    dto: UpdateServiceCategoryDto,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ) {
    this.assertOrganizationCatalogAccess(userRole, userStudioId);

    const organizationId = await this.resolveOrganizationId(
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );

    const cat = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
    });
    if (!cat || cat.organizationId !== organizationId) {
      throw new NotFoundException('Категория не найдена');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceCategory.update({
        where: { id: categoryId },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
      if (dto.isActive !== undefined) {
        await tx.service.updateMany({
          where: { categoryId },
          data: { isActive: dto.isActive },
        });
      }
      return updated;
    });
  }

  async deleteCategory(
    categoryId: string,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ) {
    this.assertOrganizationCatalogAccess(userRole, userStudioId);

    const organizationId = await this.resolveOrganizationId(
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );

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

  async delete(
    id: string,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ) {
    this.assertOrganizationCatalogAccess(userRole, userStudioId);

    const organizationId = await this.resolveOrganizationId(
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );

    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            appointments: true,
            appointmentUpsells: true,
            noShowIncomes: true,
          },
        },
      },
    });
    if (!service || service.organizationId !== organizationId) {
      throw new NotFoundException('Service not found in this organization');
    }

    const hasHistory =
      service._count.appointments > 0 ||
      service._count.appointmentUpsells > 0 ||
      service._count.noShowIncomes > 0;

    if (hasHistory) {
      throw new BadRequestException(
        'Нельзя удалить услугу: она уже используется в истории. Отключите услугу (isActive=false) вместо удаления.',
      );
    }

    await this.prisma.service.delete({
      where: { id },
    });
    return { success: true };
  }
}
