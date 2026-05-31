import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { isDeveloperRole } from './decorators/roles.decorator';

export async function getOrganizationIdForStudio(
  prisma: PrismaService,
  studioId: string,
): Promise<string> {
  const row = await prisma.studio.findUnique({
    where: { id: studioId },
    select: { organizationId: true },
  });
  if (!row) {
    throw new NotFoundException('Studio not found');
  }
  return row.organizationId;
}

/**
 * Сверка организации студии с организацией вызывающего (JWT или X-Organization-Id).
 * Нужна для ролей вроде SERVICE, у которых нет привязки к одному studioId, но есть organizationId.
 * DEVELOPER не ограничивается по организации.
 */
export async function assertUserOrganizationMatchesStudio(
  prisma: PrismaService,
  studioId: string,
  userOrganizationId: string | undefined,
  userRole: string | undefined,
): Promise<void> {
  if (!userOrganizationId || isDeveloperRole(userRole)) {
    return;
  }
  const orgId = await getOrganizationIdForStudio(prisma, studioId);
  if (orgId !== userOrganizationId) {
    throw new ForbiddenException('Access denied to this studio');
  }
}

/** То же, когда organizationId студии уже загружен (без лишнего запроса). */
export function assertUserOrganizationMatchesStudioOrganizationId(
  studioOrganizationId: string,
  userOrganizationId: string | undefined,
  userRole: string | undefined,
): void {
  if (!userOrganizationId || isDeveloperRole(userRole)) {
    return;
  }
  if (studioOrganizationId !== userOrganizationId) {
    throw new ForbiddenException('Access denied to this studio');
  }
}

/** Операции по clientId без studio в пути — клиент должен быть в организации вызывающего. */
export function assertUserOrganizationMatchesClientOrganizationId(
  clientOrganizationId: string,
  userOrganizationId: string | undefined,
  userRole: string | undefined,
): void {
  if (!userOrganizationId || isDeveloperRole(userRole)) {
    return;
  }
  if (clientOrganizationId !== userOrganizationId) {
    throw new ForbiddenException('Access denied to this client');
  }
}

export function assertUserOrganizationMatchesOrganizationId(
  organizationId: string,
  userOrganizationId: string | undefined,
  userRole: string | undefined,
): void {
  if (!userOrganizationId || isDeveloperRole(userRole)) {
    return;
  }
  if (organizationId !== userOrganizationId) {
    throw new ForbiddenException('Access denied to this organization');
  }
}
