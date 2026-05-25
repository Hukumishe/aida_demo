import { ForbiddenException } from '@nestjs/common';
import { UserRole, isOwnerLevelRole } from './decorators/roles.decorator';

/** Мастер не редактирует графики работы (только просмотр своего). */
export function assertMasterCannotEditWorkSchedule(userRole?: string): void {
  if (userRole === UserRole.MASTER) {
    throw new ForbiddenException('Мастер не может изменять графики работы');
  }
}

/** Мастер не редактирует профиль, услуги и привязки (в т.ч. свой). */
export function assertMasterCannotEditStaff(actorRole?: string): void {
  if (actorRole === UserRole.MASTER) {
    throw new ForbiddenException(
      'Мастер может только просматривать профиль и услуги; редактирование недоступно',
    );
  }
}

/** Мастер видит только свою карточку сотрудника. */
export function assertMasterCanOnlyViewSelf(
  actorRole: string | undefined,
  targetStaffUserId: string,
  actorUserId: string | undefined,
): void {
  if (actorRole === UserRole.MASTER && actorUserId && targetStaffUserId !== actorUserId) {
    throw new ForbiddenException('Мастер может просматривать только свой профиль');
  }
}

export type StaffProfilePermissions = {
  canEditProfile: boolean;
  canEditServices: boolean;
  canEditServiceOverrides: boolean;
  canDismissStaff: boolean;
};

export function buildStaffProfilePermissions(
  actorRole: string,
  targetRole: string,
): StaffProfilePermissions {
  if (actorRole === UserRole.MASTER) {
    return {
      canEditProfile: false,
      canEditServices: false,
      canEditServiceOverrides: false,
      canDismissStaff: false,
    };
  }
  if (actorRole === UserRole.ADMIN && targetRole === UserRole.MASTER) {
    return {
      canEditProfile: false,
      canEditServices: false,
      canEditServiceOverrides: false,
      canDismissStaff: false,
    };
  }
  const canManage =
    isOwnerLevelRole(actorRole) ||
    actorRole === UserRole.MANAGER ||
    actorRole === UserRole.DEVELOPER ||
    (actorRole === UserRole.ADMIN && targetRole !== UserRole.MASTER);
  return {
    canEditProfile: canManage,
    canEditServices: canManage,
    canEditServiceOverrides: canManage,
    canDismissStaff: isOwnerLevelRole(actorRole) || actorRole === UserRole.MANAGER,
  };
}
