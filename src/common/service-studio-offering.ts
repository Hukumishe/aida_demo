import { PrismaService } from './prisma/prisma.service';

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

/** Услуга доступна в филиале: активна в каталоге орг и нет записи об отключении в этом филиале. */
export function isServiceOfferedInStudio(
  service: { isActive: boolean },
  disabledIds: Set<string>,
  serviceId: string,
): boolean {
  if (!service.isActive) return false;
  return !disabledIds.has(serviceId);
}
