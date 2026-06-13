import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { UserRole, isOwnerLevelRole } from './decorators/roles.decorator';
import { staffWorksAtStudio } from './staff-studio-membership';

/**
 * Проверка доступа к филиалу в сервисном слое (дополняет StudioAccessGuard).
 * MASTER/ADMIN: основной studioId или user_studio_memberships.
 */
export async function assertUserStudioAccessForResource(
  prisma: PrismaService,
  opts: {
    userRole?: string;
    userId?: string;
    userStudioId?: string;
    userOrganizationId?: string;
    studioId: string;
  },
): Promise<void> {
  const { userRole, userId, userStudioId, userOrganizationId, studioId } = opts;

  if (isOwnerLevelRole(userRole)) {
    return;
  }

  if (userRole === UserRole.MANAGER) {
    const studio = await prisma.studio.findUnique({
      where: { id: studioId },
      select: { organizationId: true },
    });
    if (!studio || studio.organizationId !== userOrganizationId) {
      throw new ForbiddenException('Access denied to this studio');
    }
    return;
  }

  if (userRole === UserRole.ADMIN || userRole === UserRole.MASTER) {
    if (userStudioId === studioId) {
      return;
    }
    if (userId && (await staffWorksAtStudio(prisma, userId, studioId))) {
      return;
    }
    throw new ForbiddenException('Access denied to this studio');
  }

  if (userStudioId !== studioId) {
    throw new ForbiddenException('Access denied to this studio');
  }
}
