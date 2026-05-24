import { BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

/** Услуга должна быть привязана к мастеру в филиале (staff_services). */
export async function assertStaffOffersService(
  prisma: PrismaService,
  studioId: string,
  staffUserId: string,
  serviceId: string,
): Promise<void> {
  const link = await prisma.staffService.findUnique({
    where: {
      studioId_staffUserId_serviceId: { studioId, staffUserId, serviceId },
    },
    select: { id: true },
  });
  if (!link) {
    throw new BadRequestException('Услуга недоступна для выбранного мастера');
  }
}

export async function getStaffServiceIdsForStudio(
  prisma: PrismaService,
  studioId: string,
  staffUserId: string,
): Promise<string[]> {
  const rows = await prisma.staffService.findMany({
    where: { studioId, staffUserId },
    select: { serviceId: true },
  });
  return rows.map((r) => r.serviceId);
}
