import {
  ClientStaffDiaryEntry,
  ClientStaffDiaryVisibility,
  StaffProfile,
  User,
} from '@prisma/client';
import {
  canViewAllClientStaffDiaryEntries,
  UserRole,
} from '../common/decorators/roles.decorator';

type DiaryStaff = Pick<User, 'id'> & {
  staffProfile: Pick<StaffProfile, 'firstName' | 'lastName'> | null;
};

export function formatStaffDiaryAuthorName(staff: DiaryStaff): string {
  const first = staff.staffProfile?.firstName?.trim();
  const last = staff.staffProfile?.lastName?.trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || staff.id;
}

export function shouldIncludeDiaryAuthor(
  entry: Pick<ClientStaffDiaryEntry, 'visibility' | 'staffUserId'>,
  userRole?: string,
  viewerStaffId?: string,
): boolean {
  if (canViewAllClientStaffDiaryEntries(userRole)) {
    return true;
  }
  if (entry.visibility === ClientStaffDiaryVisibility.SHARED) {
    return true;
  }
  if (userRole === UserRole.MASTER && viewerStaffId && entry.staffUserId !== viewerStaffId) {
    return true;
  }
  return false;
}

export function mapClientStaffDiaryEntry(
  entry: ClientStaffDiaryEntry & { staff: DiaryStaff },
  userRole?: string,
  viewerStaffId?: string,
) {
  const base = {
    id: entry.id,
    clientId: entry.clientId,
    staffUserId: entry.staffUserId,
    appointmentId: entry.appointmentId,
    visibility: entry.visibility,
    body: entry.body,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
  if (!shouldIncludeDiaryAuthor(entry, userRole, viewerStaffId)) {
    return base;
  }
  return {
    ...base,
    author: {
      staffUserId: entry.staffUserId,
      name: formatStaffDiaryAuthorName(entry.staff),
    },
  };
}

/** Фильтр записей дневника по роли читателя. */
export function buildClientStaffDiaryReadWhere(
  clientId: string,
  organizationId: string,
  userRole?: string,
  viewerStaffId?: string,
): Record<string, unknown> {
  const base = { clientId, organizationId };

  if (canViewAllClientStaffDiaryEntries(userRole)) {
    return base;
  }

  if (userRole === UserRole.MASTER && viewerStaffId) {
    return {
      ...base,
      OR: [
        { visibility: ClientStaffDiaryVisibility.SHARED },
        { visibility: ClientStaffDiaryVisibility.PRIVATE, staffUserId: viewerStaffId },
      ],
    };
  }

  if (userRole === UserRole.ADMIN || userRole === UserRole.MANAGER) {
    return {
      ...base,
      visibility: ClientStaffDiaryVisibility.SHARED,
    };
  }

  return { ...base, id: '__none__' };
}
