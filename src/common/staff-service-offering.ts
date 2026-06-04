import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { generateId, IdPrefix } from './id-generator';
import { getStudioIdsWhereStaffWorks } from './staff-studio-membership';
import {
  assertServiceBookableAtStudio,
  getDisabledCategoryIdsForStudio,
  getDisabledServiceIdsForStudio,
  isServiceOfferedInStudio,
} from './service-studio-offering';

/** Уникальные услуги мастера по всем филиалам, где он работает. */
export async function getStaffServiceIdsUnion(
  prisma: PrismaService,
  staffUserId: string,
): Promise<string[]> {
  const rows = await prisma.staffService.findMany({
    where: { staffUserId },
    select: { serviceId: true },
    distinct: ['serviceId'],
  });
  return rows.map((r) => r.serviceId);
}

/**
 * Услуги мастера для записи в филиале studioId:
 * объединение привязок по всем его филиалам, с фильтром «доступна в этом филиале».
 */
export async function getStaffServiceIdsForStudio(
  prisma: PrismaService,
  studioId: string,
  staffUserId: string,
): Promise<string[]> {
  const unionIds = await getStaffServiceIdsUnion(prisma, staffUserId);
  if (unionIds.length === 0) {
    return [];
  }

  const studio = await prisma.studio.findUnique({
    where: { id: studioId },
    select: { organizationId: true },
  });
  if (!studio) {
    return [];
  }

  const [disabledServiceIds, disabledCategoryIds] = await Promise.all([
    getDisabledServiceIdsForStudio(prisma, studioId),
    getDisabledCategoryIdsForStudio(prisma, studioId),
  ]);

  const services = await prisma.service.findMany({
    where: {
      id: { in: unionIds },
      organizationId: studio.organizationId,
      isActive: true,
      category: { isActive: true },
    },
    include: { category: true },
  });

  return services
    .filter((s) =>
      isServiceOfferedInStudio(s, s.category, disabledServiceIds, disabledCategoryIds),
    )
    .map((s) => s.id);
}

/** Услуга в объединённом списке мастера и доступна для записи в выбранном филиале. */
export async function assertStaffOffersService(
  prisma: PrismaService,
  studioId: string,
  staffUserId: string,
  serviceId: string,
): Promise<void> {
  const unionIds = await getStaffServiceIdsUnion(prisma, staffUserId);
  if (!unionIds.includes(serviceId)) {
    throw new BadRequestException('Услуга недоступна для выбранного мастера');
  }
  await assertServiceBookableAtStudio(prisma, studioId, serviceId, (
    await prisma.studio.findUniqueOrThrow({
      where: { id: studioId },
      select: { organizationId: true },
    })
  ).organizationId);
}

/**
 * Привязать услугу мастеру во всех филиалах, где он работает и где услуга не отключена.
 * @returns число новых строк staff_services
 */
export async function assignStaffServiceAcrossStudios(
  prisma: PrismaService,
  staffUserId: string,
  serviceId: string,
  organizationId: string,
): Promise<number> {
  const studioIds = await getStudioIdsWhereStaffWorks(prisma, staffUserId);
  if (studioIds.length === 0) {
    throw new BadRequestException('У сотрудника не указан филиал');
  }

  let created = 0;
  for (const studioId of studioIds) {
    try {
      await assertServiceBookableAtStudio(
        prisma,
        studioId,
        serviceId,
        organizationId,
      );
    } catch (e) {
      if (e instanceof NotFoundException) {
        continue;
      }
      throw e;
    }

    const existing = await prisma.staffService.findUnique({
      where: {
        studioId_staffUserId_serviceId: { studioId, staffUserId, serviceId },
      },
      select: { id: true },
    });
    if (existing) {
      continue;
    }

    await prisma.staffService.create({
      data: {
        id: generateId(IdPrefix.StaffService),
        studioId,
        staffUserId,
        serviceId,
      },
    });
    created += 1;
  }

  return created;
}

/**
 * Мастера филиала, которые оказывают все перечисленные услуги (staff_services в studioId).
 */
export async function getStaffUserIdsOfferingAllServicesInStudio(
  prisma: PrismaService,
  studioId: string,
  serviceIds: string[],
): Promise<string[]> {
  const ids = [...new Set(serviceIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) {
    return [];
  }

  const rows = await prisma.staffService.findMany({
    where: { studioId, serviceId: { in: ids } },
    select: { staffUserId: true, serviceId: true },
  });

  const countByStaff = new Map<string, Set<string>>();
  for (const row of rows) {
    let set = countByStaff.get(row.staffUserId);
    if (!set) {
      set = new Set();
      countByStaff.set(row.staffUserId, set);
    }
    set.add(row.serviceId);
  }

  const required = ids.length;
  return [...countByStaff.entries()]
    .filter(([, offered]) => offered.size >= required && ids.every((id) => offered.has(id)))
    .map(([staffUserId]) => staffUserId);
}

/** Снять услугу с мастера во всех филиалах. */
export async function removeStaffServiceAcrossStudios(
  prisma: PrismaService,
  staffUserId: string,
  serviceId: string,
): Promise<number> {
  const result = await prisma.staffService.deleteMany({
    where: { staffUserId, serviceId },
  });
  return result.count;
}
