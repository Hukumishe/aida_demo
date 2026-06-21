import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { staffWorksAtStudio } from '../common/staff-studio-membership';

export type LandingMasterStaffRow = {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
  studioId: string | null;
  isActive: boolean;
  staffProfile: {
    userId: string;
    firstName: string;
    lastName: string | null;
    avatar: string | null;
    title: string | null;
    bio: string | null;
    rank: string | null;
    category: string | null;
    providesServices: boolean;
  } | null;
  studio: { id: string; name: string } | null;
  studioMemberships: Array<{
    studioId: string;
    studio: { id: string; name: string };
  }>;
};

export type LandingMasterListItem = {
  staffUserId: string;
  isVisible: boolean;
  order: number;
  primaryStudioId: string | null;
  primaryStudioName: string | null;
  workStudios: { id: string; name: string }[];
  staff: LandingMasterStaffRow;
};

export function buildWorkStudiosFromStaff(user: LandingMasterStaffRow): {
  id: string;
  name: string;
}[] {
  const out: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  if (user.studio) {
    out.push({ id: user.studio.id, name: user.studio.name });
    seen.add(user.studio.id);
  }
  for (const m of user.studioMemberships) {
    if (!seen.has(m.studio.id)) {
      seen.add(m.studio.id);
      out.push({ id: m.studio.id, name: m.studio.name });
    }
  }
  return out;
}

export function mapStaffToLandingMasterItems(
  staff: LandingMasterStaffRow[],
  configs: Array<{ staffUserId: string; isVisible: boolean; order: number }>,
): LandingMasterListItem[] {
  const byStaffId = new Map(configs.map((c) => [c.staffUserId, c]));

  return staff.map((u) => {
    const cfg = byStaffId.get(u.id);
    const workStudios = buildWorkStudiosFromStaff(u);
    return {
      staffUserId: u.id,
      isVisible: cfg?.isVisible ?? false,
      order: cfg?.order ?? 999,
      primaryStudioId: u.studioId,
      primaryStudioName: u.studio?.name ?? null,
      workStudios,
      staff: u,
    };
  });
}

const landingStaffInclude = {
  staffProfile: true,
  studio: { select: { id: true, name: true } },
  studioMemberships: {
    include: { studio: { select: { id: true, name: true } } },
  },
} as const;

export async function findOrganizationLandingStaff(
  prisma: PrismaService,
  organizationId: string,
): Promise<LandingMasterStaffRow[]> {
  const orgStudios = await prisma.studio.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const studioIds = orgStudios.map((s) => s.id);
  if (studioIds.length === 0) {
    return [];
  }

  return prisma.user.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [
        { studioId: { in: studioIds } },
        { studioMemberships: { some: { studioId: { in: studioIds } } } },
      ],
    },
    include: landingStaffInclude,
    orderBy: [{ studioId: 'asc' }, { createdAt: 'asc' }],
  }) as Promise<LandingMasterStaffRow[]>;
}

export async function assertLandingMasterStaffIdsBelongToOrganization(
  prisma: PrismaService,
  organizationId: string,
  staffUserIds: string[],
): Promise<void> {
  if (staffUserIds.length === 0) {
    return;
  }

  const uniqueIds = [...new Set(staffUserIds)];
  const orgStudios = await prisma.studio.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const studioIds = new Set(orgStudios.map((s) => s.id));

  const staff = await prisma.user.findMany({
    where: {
      id: { in: uniqueIds },
      organizationId,
      isActive: true,
    },
    select: {
      id: true,
      studioId: true,
      studioMemberships: { select: { studioId: true } },
    },
  });

  if (staff.length !== uniqueIds.length) {
    throw new BadRequestException(
      'Один или несколько сотрудников не найдены в организации или неактивны',
    );
  }

  for (const user of staff) {
    const worksInOrg =
      (user.studioId != null && studioIds.has(user.studioId)) ||
      user.studioMemberships.some((m) => studioIds.has(m.studioId));
    if (!worksInOrg) {
      throw new BadRequestException(
        `Сотрудник ${user.id} не привязан ни к одному филиалу организации`,
      );
    }
  }
}

export async function filterLandingMastersForStudio(
  prisma: PrismaService,
  studioId: string,
  items: LandingMasterListItem[],
): Promise<LandingMasterListItem[]> {
  const filtered: LandingMasterListItem[] = [];
  for (const item of items) {
    if (await staffWorksAtStudio(prisma, item.staffUserId, studioId)) {
      filtered.push(item);
    }
  }
  filtered.sort(
    (a, b) => a.order - b.order || a.staffUserId.localeCompare(b.staffUserId),
  );
  return filtered;
}
