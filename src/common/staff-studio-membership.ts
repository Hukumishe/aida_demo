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
