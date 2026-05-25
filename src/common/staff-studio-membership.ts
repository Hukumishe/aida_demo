import { NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

/**
 * Сотрудник «работает в филиале», если это его основной studioId
 * или есть запись в user_studio_memberships (мульти-филиал).
 */
export async function assertStaffWorksAtStudio(
  prisma: PrismaService,
  staffUserId: string,
  studioId: string,
): Promise<void> {
  const staff = await prisma.user.findUnique({
    where: { id: staffUserId },
    select: { id: true, studioId: true },
  });

  if (!staff) {
    throw new NotFoundException('Staff member not found or does not belong to this studio');
  }

  if (staff.studioId === studioId) {
    return;
  }

  const membership = await prisma.userStudioMembership.findUnique({
    where: {
      userId_studioId: { userId: staffUserId, studioId },
    },
    select: { id: true },
  });

  if (membership) {
    return;
  }

  throw new NotFoundException('Staff member not found or does not belong to this studio');
}

/** Основной филиал + user_studio_memberships (без дублей). */
export async function getStudioIdsWhereStaffWorks(
  prisma: PrismaService,
  staffUserId: string,
): Promise<string[]> {
  const staff = await prisma.user.findUnique({
    where: { id: staffUserId },
    select: { studioId: true },
  });
  if (!staff) {
    return [];
  }
  const ids = new Set<string>();
  if (staff.studioId) {
    ids.add(staff.studioId);
  }
  const memberships = await prisma.userStudioMembership.findMany({
    where: { userId: staffUserId },
    select: { studioId: true },
  });
  for (const m of memberships) {
    ids.add(m.studioId);
  }
  return [...ids];
}
