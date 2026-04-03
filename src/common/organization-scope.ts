import { NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

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
