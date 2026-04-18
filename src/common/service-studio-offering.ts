import { NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { Service, ServiceCategory } from '@prisma/client';

export async function getDisabledServiceIdsForStudio(
  prisma: PrismaService,
  studioId: string,
): Promise<Set<string>> {
  const rows = await prisma.studioDisabledService.findMany({
    where: { studioId },
    select: { serviceId: true },
  });
  return new Set(rows.map((r) => r.serviceId));
}

export async function getDisabledCategoryIdsForStudio(
  prisma: PrismaService,
  studioId: string,
): Promise<Set<string>> {
  const rows = await prisma.studioDisabledCategory.findMany({
    where: { studioId },
    select: { categoryId: true },
  });
  return new Set(rows.map((r) => r.categoryId));
}

/**
 * Услуга доступна в филиале: активны категория и услуга в каталоге сети,
 * нет отключения категории и нет отключения услуги в этом филиале.
 */
export function isServiceOfferedInStudio(
  service: { id: string; isActive: boolean; categoryId: string },
  category: { id: string; isActive: boolean },
  disabledServiceIds: Set<string>,
  disabledCategoryIds: Set<string>,
): boolean {
  if (!category.isActive) return false;
  if (!service.isActive) return false;
  if (disabledCategoryIds.has(category.id)) return false;
  return !disabledServiceIds.has(service.id);
}

/** Проверка для записи / слотов: услуга с категорией и отключениями по филиалу. */
export async function assertServiceBookableAtStudio(
  prisma: PrismaService,
  studioId: string,
  serviceId: string,
  organizationId: string,
): Promise<Service & { category: ServiceCategory }> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, organizationId },
    include: { category: true },
  });
  if (!service || !service.isActive || !service.category.isActive) {
    throw new NotFoundException(
      'Service not found, does not belong to this organization, or is inactive',
    );
  }
  const [dSvc, dCat] = await Promise.all([
    prisma.studioDisabledService.findUnique({
      where: { studioId_serviceId: { studioId, serviceId: service.id } },
    }),
    prisma.studioDisabledCategory.findUnique({
      where: { studioId_categoryId: { studioId, categoryId: service.categoryId } },
    }),
  ]);
  if (dSvc || dCat) {
    throw new NotFoundException('Service is not offered at this studio');
  }
  return service;
}
