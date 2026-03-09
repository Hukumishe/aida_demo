import { SetMetadata } from '@nestjs/common';

export enum UserRole {
  OWNER = 'OWNER',
  DEPUTY_OWNER = 'DEPUTY_OWNER',
  SERVICE = 'SERVICE', // Те же права что у владельца; доступ к панели промптов
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  MASTER = 'MASTER',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Проверяет, является ли роль уровнем владельца (OWNER, DEPUTY_OWNER или SERVICE)
 */
export function isOwnerLevelRole(role: string | undefined): boolean {
  return (
    role === UserRole.OWNER ||
    role === UserRole.DEPUTY_OWNER ||
    role === UserRole.SERVICE
  );
}

/**
 * Проверяет, может ли роль управлять владельцами (создавать/удалять OWNER)
 * Только OWNER может управлять владельцами
 */
export function canManageOwners(role: string | undefined): boolean {
  return role === UserRole.OWNER;
}

/**
 * Проверяет, может ли роль управлять заместителями (создавать/удалять DEPUTY_OWNER)
 * Только OWNER может управлять заместителями
 */
export function canManageDeputies(role: string | undefined): boolean {
  return role === UserRole.OWNER;
}




