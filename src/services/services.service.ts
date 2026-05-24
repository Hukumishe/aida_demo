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
import { getStaffServiceIdsForStudio } from '../common/staff-service-offering';
import { generateId, IdPrefix } from '../common/id-generator';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { CreateServiceSubcategoryDto } from './dto/create-service-subcategory.dto';
import { UpdateServiceSubcategoryDto } from './dto/update-service-subcategory.dto';
import { UserRole, isDeveloperRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';
import { AppointmentStatus, ServiceAudience } from '@prisma/client';

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

  private async validateSubcategoryForCategory(
    subcategoryId: string | null | undefined,
    categoryId: string,
    organizationId: string,
  ) {
    if (!subcategoryId) return;
    const sub = await this.prisma.serviceSubcategory.findUnique({
      where: { id: subcategoryId },
      include: { category: { select: { organizationId: true } } },
    });
    if (!sub || sub.category.organizationId !== organizationId) {
      throw new BadRequestException('Подкатегория не найдена или не принадлежит этой организации');
    }
    if (sub.categoryId !== categoryId) {
      throw new BadRequestException('Подкатегория должна принадлежать выбранной категории');
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
    staffUserId?: string,
  ) {
    try {
      const organizationId = await this.resolveOrganizationId(
        userRole,
        userOrganizationId,
        organizationIdQuery,
      );

      const staffFilterStudioId = studioIdForOffering?.trim() || userStudioId?.trim();
      let staffServiceIds: string[] | null = null;
      if (staffUserId?.trim()) {
        if (!staffFilterStudioId) {
          throw new BadRequestException(
            'Для фильтра услуг по мастеру укажите studioId в query',
          );
        }
        const sid = staffFilterStudioId;
        await assertUserOrganizationMatchesStudio(
          this.prisma,
          sid,
          userOrganizationId,
          userRole,
        );
        staffServiceIds = await getStaffServiceIdsForStudio(
          this.prisma,
          sid,
          staffUserId.trim(),
        );
        if (staffServiceIds.length === 0) {
          return [];
        }
      }

      const services = await this.prisma.service.findMany({
        where: {
          organizationId,
          ...(staffServiceIds ? { id: { in: staffServiceIds } } : {}),
        },
        include: { category: true, subcategory: true },
        orderBy: [{ name: 'asc' }],
      });

      const offeringStudioId =
        studioIdForOffering?.trim() ||
        (staffUserId?.trim() ? staffFilterStudioId : undefined);
      if (!offeringStudioId) {
        return services;
      }

      const sid = offeringStudioId;
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
      const offered = services.filter((s) =>
        isServiceOfferedInStudio(s, s.category, disabledIds, disabledCategoryIds),
      );
      return offered.map((s) => ({
        ...s,
        isOfferedInStudio: true,
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
    await this.validateSubcategoryForCategory(
      createServiceDto.subcategoryId,
      createServiceDto.categoryId,
      organizationId,
    );

    const audience = createServiceDto.audience ?? ServiceAudience.WOMEN;

    const created = await this.prisma.service.create({
      data: {
        id: generateId(IdPrefix.Service),
        organizationId,
        name: createServiceDto.name,
        description: createServiceDto.description?.trim() || null,
        defaultDurationMin: createServiceDto.defaultDurationMin,
        defaultPrice: createServiceDto.defaultPrice,
        requiredStaffCount: createServiceDto.requiredStaffCount ?? 1,
        categoryId: createServiceDto.categoryId,
        subcategoryId: createServiceDto.subcategoryId ?? null,
        audience,
      },
      include: { category: true, subcategory: true },
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

    const { defaultDurationMin, categoryId, description, ...rest } = updateServiceDto as UpdateServiceDto & {
      defaultDurationMin?: number;
    };
    if (defaultDurationMin !== undefined) {
      // игнор — стандартная длительность не меняется здесь
    }

    if (categoryId !== undefined) {
      await this.assertCategoryBelongsToOrganization(categoryId, organizationId);
    }
    const nextCategoryId = categoryId ?? service.categoryId;
    const subcategoryId = updateServiceDto.subcategoryId;
    if (subcategoryId !== undefined) {
      await this.validateSubcategoryForCategory(subcategoryId, nextCategoryId, organizationId);
    }

    const data: Record<string, unknown> = { ...rest };
    if (categoryId !== undefined) {
      data.categoryId = categoryId;
    }
    if (subcategoryId !== undefined) {
      data.subcategoryId = subcategoryId ?? null;
    }
    if (description !== undefined) {
      data.description = description === null ? null : String(description).trim() || null;
    }

    return this.prisma.service.update({
      where: { id },
      data: data as any,
      include: { category: true, subcategory: true },
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
      include: {
        subcategories: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
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

  async createSubcategory(
    categoryId: string,
    dto: CreateServiceSubcategoryDto,
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
    await this.assertCategoryBelongsToOrganization(categoryId, organizationId);
    return this.prisma.serviceSubcategory.create({
      data: {
        id: generateId(IdPrefix.ServiceSubcategory),
        categoryId,
        name: dto.name.trim(),
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateSubcategory(
    categoryId: string,
    subcategoryId: string,
    dto: UpdateServiceSubcategoryDto,
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
    await this.assertCategoryBelongsToOrganization(categoryId, organizationId);
    const sub = await this.prisma.serviceSubcategory.findUnique({
      where: { id: subcategoryId },
      include: { category: { select: { organizationId: true } } },
    });
    if (!sub || sub.categoryId !== categoryId || sub.category.organizationId !== organizationId) {
      throw new NotFoundException('Подкатегория не найдена');
    }
    return this.prisma.serviceSubcategory.update({
      where: { id: subcategoryId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteSubcategory(
    categoryId: string,
    subcategoryId: string,
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
    await this.assertCategoryBelongsToOrganization(categoryId, organizationId);
    const sub = await this.prisma.serviceSubcategory.findUnique({
      where: { id: subcategoryId },
      include: { category: { select: { organizationId: true } }, _count: { select: { services: true } } },
    });
    if (!sub || sub.categoryId !== categoryId || sub.category.organizationId !== organizationId) {
      throw new NotFoundException('Подкатегория не найдена');
    }
    if (sub._count.services > 0) {
      throw new BadRequestException(
        'Нельзя удалить подкатегорию: к ней привязаны услуги. Сначала перенесите услуги в другую подкатегорию или очистите поле.',
      );
    }
    await this.prisma.serviceSubcategory.delete({ where: { id: subcategoryId } });
    return { success: true };
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
        description: dto.description?.trim() || null,
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
          ...(dto.description !== undefined && {
            description:
              dto.description === null ? null : dto.description.trim() || null,
          }),
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
    });
    if (!service || service.organizationId !== organizationId) {
      throw new NotFoundException('Service not found in this organization');
    }

    const activeAppointments = await this.prisma.appointment.count({
      where: {
        serviceId: id,
        status: { in: [AppointmentStatus.BOOKED, AppointmentStatus.ARRIVED] },
      },
    });
    if (activeAppointments > 0) {
      throw new BadRequestException(
        'Нельзя удалить услугу: по ней есть активные записи (BOOKED/ARRIVED).',
      );
    }

    await this.prisma.service.delete({
      where: { id },
    });
    return { success: true };
  }
}
