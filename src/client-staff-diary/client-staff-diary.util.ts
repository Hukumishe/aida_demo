import {
  ClientStaffDiaryEntry,
  StaffProfile,
  User,
} from '@prisma/client';

type DiaryStaff = Pick<User, 'id'> & {
  staffProfile: Pick<StaffProfile, 'firstName' | 'lastName'> | null;
};

export function formatStaffDiaryAuthorName(staff: DiaryStaff): string {
  const first = staff.staffProfile?.firstName?.trim();
  const last = staff.staffProfile?.lastName?.trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || staff.id;
}

export function mapClientStaffDiaryEntry(
  entry: ClientStaffDiaryEntry & { staff: DiaryStaff },
  includeAuthor: boolean,
) {
  const base = {
    id: entry.id,
    clientId: entry.clientId,
    staffUserId: entry.staffUserId,
    appointmentId: entry.appointmentId,
    body: entry.body,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
  if (!includeAuthor) {
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
