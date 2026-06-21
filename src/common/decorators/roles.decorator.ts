import { SetMetadata } from '@nestjs/common';

export enum UserRole {
  DEVELOPER = 'DEVELOPER', // Платформа: организации, полный доступ
  OWNER = 'OWNER',
  DEPUTY_OWNER = 'DEPUTY_OWNER',
  SERVICE = 'SERVICE', // Те же права что у владельца; доступ к панели промптов
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  MASTER = 'MASTER',
  MARKETER = 'MARKETER', // Маркетолог: управление лендингом, акциями, FAQ на уровне организации
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * «Уровень владельца» для бизнес-доступа в тенанте: OWNER, DEPUTY_OWNER, SERVICE и DEVELOPER.
 * DEVELOPER по возможностям внутри сети совпадает с владельцем (плюс кросс-тенант и /organizations).
 */
export function isOwnerLevelRole(role: string | undefined): boolean {
  return (
    role === UserRole.DEVELOPER ||
    role === UserRole.OWNER ||
    role === UserRole.DEPUTY_OWNER ||
    role === UserRole.SERVICE
  );
}

/** Платформенная роль: доступ ко всем организациям и создание организаций */
export function isDeveloperRole(role: string | undefined): boolean {
  return role === UserRole.DEVELOPER;
}

/** Штраф мастера за опоздание в «Параметрах системы»: OWNER, DEPUTY_OWNER, DEVELOPER, SERVICE. */
export function canEditMasterLateFineAmount(role: string | undefined): boolean {
  return isOwnerLevelRole(role);
}

/** Личный дневник: OWNER, DEPUTY, DEVELOPER, SERVICE — все записи; MASTER — свои PRIVATE + все SHARED. */
export function canViewAllClientStaffDiaryEntries(role: string | undefined): boolean {
  return isOwnerLevelRole(role);
}

/** Общие заметки дневника: ADMIN/MANAGER + роли из canUseClientStaffDiary. */
export function canViewSharedClientStaffDiaryEntries(role: string | undefined): boolean {
  return (
    canUseClientStaffDiary(role) ||
    role === UserRole.ADMIN ||
    role === UserRole.MANAGER
  );
}

export function canUseClientStaffDiary(role: string | undefined): boolean {
  return canViewAllClientStaffDiaryEntries(role) || role === UserRole.MASTER;
}

/**
 * Проверяет, может ли роль управлять владельцами (создавать/удалять OWNER)
 * Только OWNER может управлять владельцами
 */
export function canManageOwners(role: string | undefined): boolean {
  return role === UserRole.OWNER || role === UserRole.DEVELOPER;
}

/**
 * Проверяет, может ли роль управлять заместителями (создавать/удалять DEPUTY_OWNER)
 * Только OWNER может управлять заместителями
 */
export function canManageDeputies(role: string | undefined): boolean {
  return role === UserRole.OWNER || role === UserRole.DEVELOPER;
}




